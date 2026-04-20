"""
Pydantic models for FastAPI request and response bodies.
Provides type validation and automatic OpenAPI documentation.
"""

from pydantic import BaseModel, Field
from typing import Optional, List


# ============================================================================
# PROJECT ENDPOINTS
# ============================================================================

class CreateProjectRequest(BaseModel):
    """Request body for POST /api/projects."""
    name: str = Field(..., min_length=1, description="Project name")
    description: Optional[str] = Field(None, description="Project description")
    tone: Optional[str] = Field(None, description="Chatbot tone/personality")
    restrictions: Optional[str] = Field(None, description="Content restrictions")


class CreateProjectResponse(BaseModel):
    """Response body for POST /api/projects."""
    project_id: str = Field(..., description="Unique project identifier")
    name: str = Field(..., description="Project name")


class ProjectInfo(BaseModel):
    """Single project in GET /api/projects response."""
    project_id: str = Field(..., description="Unique project identifier")
    name: str = Field(..., description="Project name")
    description: Optional[str] = Field(None, description="Project description")
    created_at: Optional[str] = Field(None, description="ISO 8601 timestamp")


class GetProjectsResponse(BaseModel):
    """Response body for GET /api/projects."""
    projects: List[ProjectInfo] = Field(..., description="List of projects")


class DeleteProjectResponse(BaseModel):
    """Response body for DELETE /api/projects/{project_id}."""
    deleted: bool = Field(..., description="Whether deletion succeeded")


# ============================================================================
# UPLOAD ENDPOINT
# ============================================================================

class UploadResponse(BaseModel):
    """Response body for POST /api/upload."""
    chunks_stored: int = Field(..., description="Number of document chunks stored")
    filename: str = Field(..., description="Name of uploaded file")


# ============================================================================
# CHAT ENDPOINT
# ============================================================================

class ChatRequest(BaseModel):
    """Request body for POST /api/chat."""
    project_id: str = Field(..., description="Target project ID")
    message: str = Field(..., min_length=1, description="User message/query")
    provider: str = Field(default="gemini", description="LLM provider (gemini/openai/groq)")
    model: Optional[str] = Field(None, description="Model override (optional)")
    api_key: str = Field(..., description="API key for the selected provider")


class ChatResponse(BaseModel):
    """Response body for POST /api/chat."""
    answer: str = Field(..., description="Generated answer from RAG pipeline")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Answer confidence score (0-1)")


# ============================================================================
# HISTORY ENDPOINT
# ============================================================================

class Message(BaseModel):
    """Single message in chat history."""
    role: str = Field(..., description="Message role (user/assistant)")
    content: str = Field(..., description="Message content")
    timestamp: str = Field(..., description="ISO 8601 timestamp")


class GetHistoryResponse(BaseModel):
    """Response body for GET /api/history/{project_id}."""
    messages: List[Message] = Field(..., description="Ordered list of messages")


# ============================================================================
# ERROR RESPONSE
# ============================================================================

class ErrorResponse(BaseModel):
    """Standard error response body."""
    detail: str = Field(..., description="Error message")
    status_code: int = Field(..., description="HTTP status code")
