"""
FastAPI backend for DocMind RAG Chatbot.

Wraps existing document_processor.py logic with REST API endpoints.
All secrets are read from .env. Supabase is used for persistence.

Database schema (project_config):
    CREATE TABLE IF NOT EXISTS public.project_config (
        project_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        tone TEXT,
        restrictions TEXT,
        provider TEXT DEFAULT 'gemini',
        model TEXT DEFAULT 'gemini-2.5-flash',
        api_key TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE public.project_config
        ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'gemini',
        ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'gemini-2.5-flash',
        ADD COLUMN IF NOT EXISTS api_key TEXT;

Run with: uvicorn api.main:app --reload --port 8000
"""

import os
import uuid
import json
from typing import List
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from supabase import Client

from api.models import (
    CreateProjectRequest,
    CreateProjectResponse,
    ProjectInfo,
    WidgetConfigResponse,
    DeleteProjectResponse,
    UploadResponse,
    ChatRequest,
    ChatResponse,
    Message,
)
from api.dependencies import (
    get_supabase_client,
    get_env,
    get_active_llm_config,
    get_retrieval_config,
)

def upload_document(file_contents: bytes, project_id: str, filename: str = "uploaded_file") -> dict:
    """
    Lazily call the existing document_processor upload helper.

    Importing lazily keeps the API app startable in test/dev environments before
    runtime secrets are configured, while preserving document_processor.py.
    """
    from document_processor import upload_document_for_api

    return upload_document_for_api(file_contents, project_id, filename)


def retrieve_and_rerank(query: str, project: str, supabase_client: Client):
    """Lazily call the existing document_processor retrieval function."""
    from document_processor import retrieve_and_rerank as retrieve_and_rerank_from_processor

    return retrieve_and_rerank_from_processor(query, project, supabase_client)


def generate_answer(
    question: str,
    relevant_chunks: list[str],
    recent_messages: list[dict] | None = None,
    project: str | None = None,
    supabase_client: Client | None = None,
):
    """Lazily call the existing document_processor answer generation function."""
    from document_processor import generate_answer as generate_answer_from_processor

    return generate_answer_from_processor(
        question,
        relevant_chunks,
        recent_messages=recent_messages,
        project=project,
        supabase_client=supabase_client,
    )


def get_last_retrieval_confidence() -> float:
    """Read the latest retrieval confidence from document_processor metadata."""
    try:
        from document_processor import LAST_RETRIEVAL_META

        return float(LAST_RETRIEVAL_META.get("confidence", 0.0) or 0.0)
    except Exception:
        return 0.0

LOCAL_PROJECT_STORE = Path("artifacts/docmind_projects.json")


def _is_missing_project_table_error(error: Exception) -> bool:
    """Return whether a Supabase error indicates project_config is absent."""
    text = str(error)
    return "project_config" in text and ("PGRST205" in text or "schema cache" in text or "does not exist" in text)


def _read_local_projects() -> list[dict]:
    """Read fallback project records from the local JSON store."""
    if not LOCAL_PROJECT_STORE.exists():
        return []
    try:
        return json.loads(LOCAL_PROJECT_STORE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []


def _write_local_projects(projects: list[dict]) -> None:
    """Write fallback project records to the local JSON store."""
    LOCAL_PROJECT_STORE.parent.mkdir(parents=True, exist_ok=True)
    LOCAL_PROJECT_STORE.write_text(json.dumps(projects, indent=2), encoding="utf-8")


def _save_local_project(project: dict) -> None:
    """Insert or replace one fallback project in the local JSON store."""
    projects = [item for item in _read_local_projects() if item.get("project_id") != project.get("project_id")]
    projects.insert(0, project)
    _write_local_projects(projects)


def _delete_local_project(project_id: str) -> None:
    """Remove one fallback project from the local JSON store."""
    _write_local_projects([
        project for project in _read_local_projects()
        if project.get("project_id") != project_id
    ])


def _get_local_project_row(project_id: str) -> dict:
    """Fetch one project row from the local fallback store."""
    for project in _read_local_projects():
        if project.get("project_id") == project_id:
            return project
    return {}


def _is_missing_project_config_column_error(error: Exception) -> bool:
    """Return whether Supabase rejected optional project_config columns."""
    text = str(error).lower()
    optional_columns = ("provider", "model", "api_key")
    return "project_config" in text and any(column in text for column in optional_columns)


def _default_welcome_message(project: dict) -> str:
    """Build a public welcome message from the project questionnaire."""
    name = project.get("name") or "this website"
    description = (project.get("description") or "").strip()
    tone = (project.get("tone") or "").strip()

    if description:
        return f"Welcome to {name}. I can help you with {description}"
    if tone:
        return f"Welcome to {name}. Ask me anything and I will respond in a {tone.lower()} tone."
    return f"Welcome to {name}. Ask me anything about this website or organization."


def _get_project_row(project_id: str, db: Client) -> dict:
    """Fetch one project_config row, falling back to the local project store."""
    try:
        result = db.table("project_config").select("*").eq("project_id", project_id).limit(1).execute()
        if result.data:
            db_project = dict(result.data[0])
            local_project = _get_local_project_row(project_id)
            for key in ("provider", "model", "api_key"):
                if not db_project.get(key) and local_project.get(key):
                    db_project[key] = local_project[key]
            return db_project
    except Exception as e:
        if not _is_missing_project_table_error(e):
            raise

    return _get_local_project_row(project_id)


# ============================================================================
# FASTAPI APP INITIALIZATION
# ============================================================================

app = FastAPI(
    title="DocMind API",
    description="RAG Chatbot REST API Backend",
    version="1.0.0",
)

# Enable CORS for widget embedding from any origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins (required for widget embedding)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# STARTUP EVENT: Create project_config table
# ============================================================================

@app.on_event("startup")
async def create_project_config_table():
    """
    Create the project_config table on startup if it doesn't exist.
    
    SQL Schema:
        CREATE TABLE IF NOT EXISTS public.project_config (
            project_id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            tone TEXT,
            restrictions TEXT,
            provider TEXT DEFAULT 'gemini',
            model TEXT DEFAULT 'gemini-2.5-flash',
            api_key TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    """
    sql = """
    CREATE TABLE IF NOT EXISTS public.project_config (
        project_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        tone TEXT,
        restrictions TEXT,
        provider TEXT DEFAULT 'gemini',
        model TEXT DEFAULT 'gemini-2.5-flash',
        api_key TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE public.project_config
        ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'gemini',
        ADD COLUMN IF NOT EXISTS model TEXT DEFAULT 'gemini-2.5-flash',
        ADD COLUMN IF NOT EXISTS api_key TEXT;
    """
    
    try:
        db: Client = get_supabase_client()
        db.rpc("exec_sql", {"sql": sql}).execute()
    except Exception:
        # Table might already exist or exec_sql not available
        # This is expected in development; schema creation can be manual
        pass


# ============================================================================
# PROJECT ENDPOINTS
# ============================================================================

@app.post(
    "/api/projects",
    response_model=CreateProjectResponse,
    summary="Create new project",
    responses={
        200: {"description": "Project created successfully"},
        422: {"description": "Validation error (missing/invalid fields)"},
    },
)
async def create_project(
    request: CreateProjectRequest,
    db: Client = Depends(get_supabase_client),
) -> CreateProjectResponse:
    """
    Create a new RAG project with configuration.
    
    Args:
        request: CreateProjectRequest with name, description, tone, restrictions
        db: Supabase client dependency
        
    Returns:
        CreateProjectResponse with project_id and name
        
    Raises:
        HTTPException: If database operation fails
    """
    project_id = str(uuid.uuid4())
    
    project_row = {
        "project_id": project_id,
        "name": request.name,
        "description": request.description,
        "tone": request.tone,
        "restrictions": request.restrictions,
        "provider": request.provider,
        "model": request.model,
        "api_key": request.api_key,
        "created_at": datetime.utcnow().isoformat(),
    }

    try:
        project_insert = {
            "project_id": project_id,
            "name": request.name,
            "description": request.description,
            "tone": request.tone,
            "restrictions": request.restrictions,
            "provider": request.provider,
            "model": request.model,
            "api_key": request.api_key,
        }
        try:
            db.table("project_config").insert(project_insert).execute()
        except Exception as e:
            if not _is_missing_project_config_column_error(e):
                raise
            _save_local_project(project_row)
            db.table("project_config").insert({
                "project_id": project_id,
                "name": request.name,
                "description": request.description,
                "tone": request.tone,
                "restrictions": request.restrictions,
            }).execute()
        
        return CreateProjectResponse(project_id=project_id, name=request.name)
    
    except Exception as e:
        if _is_missing_project_table_error(e):
            _save_local_project(project_row)
            return CreateProjectResponse(project_id=project_id, name=request.name)

        raise HTTPException(
            status_code=500,
            detail=f"Failed to create project: {str(e)}",
        )


@app.get(
    "/api/projects",
    response_model=List[ProjectInfo],
    summary="List all projects",
    responses={
        200: {"description": "Projects retrieved successfully"},
    },
)
async def get_projects(db: Client = Depends(get_supabase_client)) -> List[ProjectInfo]:
    """
    Retrieve all projects from project_config table.
    
    Args:
        db: Supabase client dependency
        
    Returns:
        List of ProjectInfo objects
        
    Raises:
        HTTPException: If database query fails
    """
    try:
        result = db.table("project_config").select("*").order(
            "created_at", desc=True
        ).execute()
        
        projects = [
            ProjectInfo(
                project_id=row["project_id"],
                name=row["name"],
                description=row.get("description"),
            )
            for row in result.data
        ]
        
        return projects
    
    except Exception as e:
        if _is_missing_project_table_error(e):
            projects = [
                ProjectInfo(
                    project_id=row["project_id"],
                    name=row["name"],
                    description=row.get("description"),
                )
                for row in _read_local_projects()
            ]
            return projects

        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve projects: {str(e)}",
        )


@app.get(
    "/api/projects/{project_id}/widget-config",
    response_model=WidgetConfigResponse,
    summary="Get public widget config",
    responses={
        200: {"description": "Widget config retrieved successfully"},
        404: {"description": "Project not found"},
    },
)
async def get_widget_config(
    project_id: str,
    db: Client = Depends(get_supabase_client),
) -> WidgetConfigResponse:
    """
    Return public widget configuration for a project.

    This endpoint intentionally does not return the stored API key.
    """
    project = _get_project_row(project_id, db)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return WidgetConfigResponse(
        project_id=project_id,
        name=project.get("name") or "DocMind Assistant",
        description=project.get("description"),
        tone=project.get("tone"),
        restrictions=project.get("restrictions"),
        provider=project.get("provider"),
        model=project.get("model"),
        welcome_message=_default_welcome_message(project),
    )


@app.delete(
    "/api/projects/{project_id}",
    response_model=DeleteProjectResponse,
    summary="Delete project",
    responses={
        200: {"description": "Project deleted successfully"},
        404: {"description": "Project not found"},
    },
)
async def delete_project(
    project_id: str,
    db: Client = Depends(get_supabase_client),
) -> DeleteProjectResponse:
    """
    Delete a project and all its associated messages.
    
    Cascading delete:
    - Removes project from project_config table
    - Removes all messages for that project from messages table
    
    Args:
        project_id: Project UUID to delete
        db: Supabase client dependency
        
    Returns:
        DeleteProjectResponse with deleted=true
        
    Raises:
        HTTPException: If project not found or database operation fails
    """
    try:
        try:
            db.table("project_config").delete().eq("project_id", project_id).execute()
        except Exception as e:
            if not _is_missing_project_table_error(e):
                raise
        _delete_local_project(project_id)
        
        # Delete all messages for this project
        try:
            db.table("messages").delete().eq("project", project_id).execute()
        except Exception:
            pass
        
        return DeleteProjectResponse(deleted=True)
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete project: {str(e)}",
        )


# ============================================================================
# DOCUMENT UPLOAD ENDPOINT
# ============================================================================

@app.post(
    "/api/upload",
    response_model=UploadResponse,
    summary="Upload PDF document",
    responses={
        200: {"description": "Document uploaded and chunked successfully"},
        422: {"description": "Missing file or project_id"},
        500: {"description": "Upload processing failed"},
    },
)
async def upload_document_endpoint(
    file: UploadFile = File(...),
    project_id: str = Form(...),
    db: Client = Depends(get_supabase_client),
) -> UploadResponse:
    """
    Upload a PDF document and process it through the RAG pipeline.
    
    Calls document_processor.upload_document() to:
    - Extract text from PDF
    - Split into sentence-aware chunks (400 words, 12% overlap)
    - Generate embeddings via SentenceTransformers
    - Store chunks and embeddings in vector store
    
    Args:
        file: PDF file upload (multipart/form-data)
        project_id: Target project UUID
        db: Supabase client dependency
        
    Returns:
        UploadResponse with chunks_stored count and filename
        
    Raises:
        HTTPException: If file processing fails
    """
    try:
        # Read file contents into memory
        file_contents = await file.read()
        
        # Call wrapped document_processor function
        result = upload_document(file_contents, project_id, file.filename or "uploaded_file")
        
        return UploadResponse(
            chunks_stored=result.get("chunks_stored", 0),
            filename=file.filename or "unknown",
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to upload document: {str(e)}",
        )


# ============================================================================
# CHAT ENDPOINT
# ============================================================================

@app.post(
    "/api/chat",
    response_model=ChatResponse,
    summary="Chat with RAG system",
    responses={
        200: {"description": "Chat completed successfully"},
        422: {"description": "Missing required fields"},
        500: {"description": "Chat processing failed"},
    },
)
async def chat(
    request: ChatRequest,
    db: Client = Depends(get_supabase_client),
) -> ChatResponse:
    """
    Send a message to the RAG pipeline and get an AI-generated answer.
    
    Pipeline:
    1. Query rewriting (via LLMProvider)
    2. Retrieval (top-k semantic search from vector store)
    3. Reranking (cross-encoder re-scoring)
    4. Answer generation (LLMProvider with context)
    5. Confidence scoring
    
    Args:
        request: ChatRequest with project_id, message, provider, model, api_key
        db: Supabase client dependency
        
    Returns:
        ChatResponse with answer and confidence score (0-1)
        
    Raises:
        HTTPException: If chat processing fails
    """
    try:
        project_config = _get_project_row(request.project_id, db)
        provider = (
            request.provider
            or project_config.get("provider")
            or os.getenv("LLM_PROVIDER")
            or "gemini"
        ).strip().lower()
        model = (
            request.model
            or project_config.get("model")
            or os.getenv(f"{provider.upper()}_MODEL")
        )
        api_key = (
            request.api_key
            or project_config.get("api_key")
            or os.getenv(f"{provider.upper()}_API_KEY")
        )

        if not api_key:
            raise HTTPException(
                status_code=422,
                detail="Missing API key. Configure it during chatbot creation or provide api_key in the chat request.",
            )

        # Temporarily override LLM provider/model via environment
        # (In production, might prefer dependency injection)
        os.environ["LLM_PROVIDER"] = provider
        
        if model:
            os.environ[f"{provider.upper()}_MODEL"] = model
        
        # Set provider-specific API key (override from request if provided)
        os.environ[f"{provider.upper()}_API_KEY"] = api_key
        
        # Call retrieve_and_rerank to get top context chunks
        reranked_rows = retrieve_and_rerank(request.message, request.project_id, db)
        context_chunks = [row["content"] if isinstance(row, dict) else str(row) for row in reranked_rows]
        
        # Get previous conversation context (last 5 messages)
        try:
            history_result = db.table("messages").select("role, content").eq(
                "project", request.project_id
            ).order("timestamp", desc=True).limit(5).execute()
            
            conversation_history = [
                {"role": row["role"], "content": row["content"]}
                for row in reversed(history_result.data)
            ]
        except:
            conversation_history = []
        
        # Generate answer using active LLM provider
        answer_result = generate_answer(
            request.message,
            context_chunks,
            recent_messages=conversation_history,
            project=request.project_id,
            supabase_client=db,
        )
        if isinstance(answer_result, dict):
            answer_text = answer_result.get("answer", "")
            confidence = answer_result.get("confidence", 0.0)
        else:
            answer_text = str(answer_result)
            confidence = get_last_retrieval_confidence()

        if answer_text.strip().lower().startswith("error:"):
            raise HTTPException(status_code=502, detail=answer_text)
        
        # Store message in history
        try:
            db.table("messages").insert({
                "project": request.project_id,
                "role": "user",
                "content": request.message,
                "timestamp": datetime.utcnow().isoformat(),
            }).execute()
            
            db.table("messages").insert({
                "project": request.project_id,
                "role": "assistant",
                "content": answer_text,
                "timestamp": datetime.utcnow().isoformat(),
            }).execute()
        except:
            pass  # Non-critical; chat still succeeds even if history save fails
        
        return ChatResponse(
            answer=answer_text,
            confidence=confidence,
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Chat failed: {str(e)}",
        )


# ============================================================================
# CHAT HISTORY ENDPOINT
# ============================================================================

@app.get(
    "/api/history/{project_id}",
    response_model=List[Message],
    summary="Get chat history",
    responses={
        200: {"description": "History retrieved successfully"},
    },
)
async def get_chat_history(
    project_id: str,
    db: Client = Depends(get_supabase_client),
) -> List[Message]:
    """
    Retrieve full chat message history for a project.
    
    Returns messages ordered by timestamp (oldest first).
    
    Args:
        project_id: Project UUID
        db: Supabase client dependency
        
    Returns:
        List of Message objects
        
    Raises:
        HTTPException: If database query fails
    """
    try:
        result = db.table("messages").select("role, content, timestamp").eq(
            "project", project_id
        ).order("timestamp", desc=False).execute()
        
        messages = [
            Message(
                role=row["role"],
                content=row["content"],
                timestamp=row["timestamp"],
            )
            for row in result.data
        ]
        
        return messages
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve history: {str(e)}",
        )


# ============================================================================
# WIDGET ENDPOINT
# ============================================================================

@app.get(
    "/widget.js",
    summary="Serve widget JavaScript",
    responses={
        200: {"description": "Widget JavaScript served"},
    },
)
async def get_widget_js():
    """
    Serve the widget.js file for embedded chat widget.
    
    Allows the widget to be embedded on external websites.
    Content-Type automatically set to application/javascript.
    
    Returns:
        FileResponse with widget.js and proper MIME type
        
    Raises:
        HTTPException: If file not found
    """
    widget_path = os.path.join(os.path.dirname(__file__), "..", "widget", "widget.js")
    
    if not os.path.exists(widget_path):
        raise HTTPException(
            status_code=404,
            detail="widget.js not found",
        )
    
    return FileResponse(
        widget_path,
        media_type="application/javascript",
        headers={"Cache-Control": "no-store"},
    )


# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get(
    "/health",
    summary="Health check",
    responses={
        200: {"description": "Service is healthy"},
    },
)
async def health_check():
    """
    Simple health check endpoint for monitoring.
    
    Returns:
        dict: {"status": "ok", "version": "1.0.0"}
    """
    return {
        "status": "ok",
        "version": "1.0.0",
    }


# ============================================================================
# ROOT ENDPOINT
# ============================================================================

@app.get("/", summary="API root")
async def root():
    """
    Root endpoint with API documentation links.
    
    Returns:
        dict: Links to docs and active configuration
    """
    config = get_active_llm_config()
    return {
        "message": "DocMind RAG API",
        "docs": "/docs",
        "openapi": "/openapi.json",
        "active_llm_provider": config["provider"],
        "active_model": config["model"],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
