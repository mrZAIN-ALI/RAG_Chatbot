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
        created_at TIMESTAMPTZ DEFAULT NOW()
    );

Run with: uvicorn api.main:app --reload --port 8000
"""

import os
import uuid
from typing import List
from datetime import datetime

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from supabase import Client

from api.models import (
    CreateProjectRequest,
    CreateProjectResponse,
    ProjectInfo,
    GetProjectsResponse,
    DeleteProjectResponse,
    UploadResponse,
    ChatRequest,
    ChatResponse,
    Message,
    GetHistoryResponse,
    ErrorResponse,
)
from api.dependencies import (
    get_supabase_client,
    get_env,
    get_active_llm_config,
    get_retrieval_config,
)

# Import document_processor functions (wrapped, not modified)
from document_processor import (
    upload_document,
    retrieve_and_rerank,
    generate_answer,
)


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
            created_at TIMESTAMPTZ DEFAULT NOW()
        );
    """
    db: Client = get_supabase_client()
    
    sql = """
    CREATE TABLE IF NOT EXISTS public.project_config (
        project_id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        tone TEXT,
        restrictions TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
    );
    """
    
    try:
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
    
    try:
        result = db.table("project_config").insert({
            "project_id": project_id,
            "name": request.name,
            "description": request.description,
            "tone": request.tone,
            "restrictions": request.restrictions,
        }).execute()
        
        return CreateProjectResponse(project_id=project_id, name=request.name)
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create project: {str(e)}",
        )


@app.get(
    "/api/projects",
    response_model=GetProjectsResponse,
    summary="List all projects",
    responses={
        200: {"description": "Projects retrieved successfully"},
    },
)
async def get_projects(db: Client = Depends(get_supabase_client)) -> GetProjectsResponse:
    """
    Retrieve all projects from project_config table.
    
    Args:
        db: Supabase client dependency
        
    Returns:
        GetProjectsResponse with list of ProjectInfo objects
        
    Raises:
        HTTPException: If database query fails
    """
    try:
        result = db.table("project_config").select("*").order_by(
            "created_at", desc=True
        ).execute()
        
        projects = [
            ProjectInfo(
                project_id=row["project_id"],
                name=row["name"],
                description=row.get("description"),
                created_at=row.get("created_at"),
            )
            for row in result.data
        ]
        
        return GetProjectsResponse(projects=projects)
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to retrieve projects: {str(e)}",
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
        # Delete project config
        db.table("project_config").delete().eq("project_id", project_id).execute()
        
        # Delete all messages for this project
        db.table("messages").delete().eq("project_id", project_id).execute()
        
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
        result = upload_document(file_contents, project_id)
        
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
        # Temporarily override LLM provider/model via environment
        # (In production, might prefer dependency injection)
        os.environ["LLM_PROVIDER"] = request.provider
        
        if request.model:
            os.environ[f"{request.provider.upper()}_MODEL"] = request.model
        
        # Set provider-specific API key (override from request if provided)
        os.environ[f"{request.provider.upper()}_API_KEY"] = request.api_key
        
        # Call retrieve_and_rerank to get top context chunks
        retrieval_result = retrieve_and_rerank(
            query=request.message,
            project_id=request.project_id,
        )
        
        # Get previous conversation context (last 5 messages)
        try:
            history_result = db.table("messages").select("role, content").eq(
                "project_id", request.project_id
            ).order_by("timestamp", desc=True).limit(5).execute()
            
            conversation_history = [
                {"role": row["role"], "content": row["content"]}
                for row in reversed(history_result.data)
            ]
        except:
            conversation_history = []
        
        # Generate answer using active LLM provider
        answer_result = generate_answer(
            query=request.message,
            context_chunks=retrieval_result.get("reranked_chunks", []),
            conversation_history=conversation_history,
            project_id=request.project_id,
        )
        
        # Store message in history
        try:
            db.table("messages").insert({
                "project_id": request.project_id,
                "role": "user",
                "content": request.message,
                "timestamp": datetime.utcnow().isoformat(),
            }).execute()
            
            db.table("messages").insert({
                "project_id": request.project_id,
                "role": "assistant",
                "content": answer_result.get("answer", ""),
                "timestamp": datetime.utcnow().isoformat(),
            }).execute()
        except:
            pass  # Non-critical; chat still succeeds even if history save fails
        
        return ChatResponse(
            answer=answer_result.get("answer", ""),
            confidence=answer_result.get("confidence", 0.0),
        )
    
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
    response_model=GetHistoryResponse,
    summary="Get chat history",
    responses={
        200: {"description": "History retrieved successfully"},
    },
)
async def get_chat_history(
    project_id: str,
    db: Client = Depends(get_supabase_client),
) -> GetHistoryResponse:
    """
    Retrieve full chat message history for a project.
    
    Returns messages ordered by timestamp (oldest first).
    
    Args:
        project_id: Project UUID
        db: Supabase client dependency
        
    Returns:
        GetHistoryResponse with list of Message objects
        
    Raises:
        HTTPException: If database query fails
    """
    try:
        result = db.table("messages").select("role, content, timestamp").eq(
            "project_id", project_id
        ).order_by("timestamp", desc=False).execute()
        
        messages = [
            Message(
                role=row["role"],
                content=row["content"],
                timestamp=row["timestamp"],
            )
            for row in result.data
        ]
        
        return GetHistoryResponse(messages=messages)
    
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
        headers={"Cache-Control": "public, max-age=3600"},
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
        dict: {"status": "ok", "timestamp": ISO8601}
    """
    return {
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
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
