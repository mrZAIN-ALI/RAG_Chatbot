"""
Comprehensive API test suite for FastAPI backend.

Tests all endpoints with mocked Supabase and document_processor calls.
No real API calls or database operations are made.

Run with: pytest tests/test_api.py -v

Requirements:
  pytest
  httpx
  pytest-asyncio
"""

import pytest
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from io import BytesIO
from datetime import datetime

import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from api.main import app
from api.dependencies import get_supabase_client


@pytest_asyncio.fixture
async def client():
    """
    Fixture providing async HTTP client for testing with dependency overrides.
    
    Sets up mocked Supabase client for all requests.
    """
    # Create mock Supabase client
    mock_db = MagicMock()
    
    # Override get_supabase_client dependency
    app.dependency_overrides[get_supabase_client] = lambda: mock_db
    
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as test_client:
        yield test_client, mock_db
    
    # Clean up overrides
    app.dependency_overrides.clear()


# ============================================================================
# TEST 1: Create Project - Valid Request
# ============================================================================

@pytest.mark.asyncio
async def test_create_project_returns_project_id(client):
    """
    Test: POST /api/projects with valid body
    Expected: Response status 200, contains project_id and name
    """
    test_client, mock_db = client
    
    # Mock the Supabase insert chain
    mock_db.table().insert().execute = MagicMock(return_value=MagicMock())
    
    response = await test_client.post(
        "/api/projects",
        json={
            "name": "Test Project",
            "description": "A test project",
            "tone": "professional",
            "restrictions": "None",
        },
    )
    
    assert response.status_code == 200
    data = response.json()
    assert "project_id" in data
    assert data["name"] == "Test Project"
    assert len(data["project_id"]) > 0


# ============================================================================
# TEST 2: Create Project - Missing Name (422 Error)
# ============================================================================

@pytest.mark.asyncio
async def test_create_project_missing_name_returns_422(client):
    """
    Test: POST /api/projects with empty name
    Expected: Response status 422 (validation error)
    """
    test_client, mock_db = client
    
    response = await test_client.post(
        "/api/projects",
        json={
            "name": "",  # Invalid: empty name
            "description": "A test project",
            "tone": "professional",
            "restrictions": "None",
        },
    )
    
    assert response.status_code == 422


# ============================================================================
# TEST 3: Upload PDF - Valid File
# ============================================================================

@pytest.mark.asyncio
async def test_upload_valid_pdf_returns_chunks_stored(client):
    """
    Test: POST /api/upload with mocked PDF bytes and project_id
    Expected: Response contains chunks_stored: 5
    """
    test_client, mock_db = client
    
    with patch("api.main.upload_document") as mock_upload:
        mock_upload.return_value = {"chunks_stored": 5}
        
        pdf_bytes = b"mock pdf content"
        
        response = await test_client.post(
            "/api/upload",
            data={"project_id": "test-project-123"},
            files={"file": ("test.pdf", BytesIO(pdf_bytes), "application/pdf")},
        )
    
    assert response.status_code == 200
    data = response.json()
    assert data["chunks_stored"] == 5
    assert data["filename"] == "test.pdf"


# ============================================================================
# TEST 4: Upload - Missing File (422 Error)
# ============================================================================

@pytest.mark.asyncio
async def test_upload_no_file_returns_422(client):
    """
    Test: POST /api/upload with no file
    Expected: Response status 422 (validation error)
    """
    test_client, mock_db = client
    
    response = await test_client.post(
        "/api/upload",
        data={"project_id": "test-project-123"},
        # No file provided
    )
    
    assert response.status_code == 422


# ============================================================================
# TEST 5: Chat - Valid Request Returns Answer and Confidence
# ============================================================================

@pytest.mark.asyncio
async def test_chat_returns_answer_and_confidence(client):
    """
    Test: POST /api/chat with valid body
    Expected: Response contains answer and confidence (0-1)
    """
    test_client, mock_db = client
    
    # Mock Supabase message history query
    mock_db.table().select().eq().order_by().limit().execute = MagicMock(
        return_value=MagicMock(data=[])
    )
    # Mock Supabase insert calls
    mock_db.table().insert().execute = MagicMock(return_value=MagicMock())
    
    with patch("api.main.retrieve_and_rerank") as mock_retrieve:
        with patch("api.main.generate_answer") as mock_generate:
            mock_retrieve.return_value = {
                "reranked_chunks": ["chunk1", "chunk2"],
            }
            mock_generate.return_value = {
                "answer": "This is a test answer",
                "confidence": 0.85,
            }
            
            response = await test_client.post(
                "/api/chat",
                json={
                    "project_id": "test-project-123",
                    "message": "What is this about?",
                    "provider": "gemini",
                    "model": "gemini-2.5-flash",
                    "api_key": "test-api-key",
                },
            )
    
    assert response.status_code == 200
    data = response.json()
    assert "answer" in data
    assert "confidence" in data
    assert data["answer"] == "This is a test answer"
    assert data["confidence"] == 0.85
    assert 0.0 <= data["confidence"] <= 1.0


# ============================================================================
# TEST 6: Chat - Missing API Key (422 Error)
# ============================================================================

@pytest.mark.asyncio
async def test_chat_missing_api_key_returns_422(client):
    """
    Test: POST /api/chat with no api_key field
    Expected: Response status 422 (validation error)
    """
    test_client, mock_db = client
    
    response = await test_client.post(
        "/api/chat",
        json={
            "project_id": "test-project-123",
            "message": "What is this about?",
            "provider": "gemini",
            "model": "gemini-2.5-flash",
            # Missing api_key
        },
    )
    
    assert response.status_code == 422


# ============================================================================
# TEST 7: Get History - Returns List of Messages
# ============================================================================

@pytest.mark.asyncio
async def test_get_history_returns_list(client):
    """
    Test: GET /api/history/{project_id}
    Expected: Response is list of 3 messages (mocked)
    """
    test_client, mock_db = client
    
    mock_messages = [
        {
            "role": "user",
            "content": "First question",
            "timestamp": "2024-01-01T10:00:00",
        },
        {
            "role": "assistant",
            "content": "First answer",
            "timestamp": "2024-01-01T10:00:05",
        },
        {
            "role": "user",
            "content": "Second question",
            "timestamp": "2024-01-01T10:01:00",
        },
    ]
    
    mock_db.table().select().eq().order_by().execute = MagicMock(
        return_value=MagicMock(data=mock_messages)
    )
    
    response = await test_client.get("/api/history/test-project-123")
    
    assert response.status_code == 200
    data = response.json()
    assert "messages" in data
    assert len(data["messages"]) == 3
    assert data["messages"][0]["role"] == "user"
    assert data["messages"][1]["role"] == "assistant"


# ============================================================================
# TEST 8: Delete Project - Returns deleted=true
# ============================================================================

@pytest.mark.asyncio
async def test_delete_project_returns_deleted_true(client):
    """
    Test: DELETE /api/projects/{project_id}
    Expected: Response status 200, deleted: true
    """
    test_client, mock_db = client
    
    # Mock Supabase delete chain
    mock_db.table().delete().eq().execute = MagicMock(
        return_value=MagicMock()
    )
    
    response = await test_client.delete("/api/projects/test-project-123")
    
    assert response.status_code == 200
    data = response.json()
    assert data["deleted"] is True


# ============================================================================
# TEST 9: Get Widget JavaScript - Served with Correct Content Type
# ============================================================================

@pytest.mark.asyncio
async def test_widget_js_served_as_javascript(client):
    """
    Test: GET /widget.js
    Expected: Content-Type is application/javascript
    """
    test_client, mock_db = client
    
    response = await test_client.get("/widget.js")
    
    assert response.status_code == 200
    assert "application/javascript" in response.headers.get("content-type", "")


# ============================================================================
# TEST 10: CORS Headers Present on Any Request
# ============================================================================

@pytest.mark.asyncio
async def test_cors_headers_present(client):
    """
    Test: Any request with Origin header
    Expected: Access-Control-Allow-Origin in response headers
    """
    test_client, mock_db = client
    
    response = await test_client.get(
        "/health",
        headers={"Origin": "http://example.com"},
    )
    
    assert response.status_code == 200
    # CORS middleware should add these headers
    assert "access-control-allow-origin" in response.headers


# ============================================================================
# BONUS: Get Projects List
# ============================================================================

@pytest.mark.asyncio
async def test_get_projects_returns_list(client):
    """
    Test: GET /api/projects
    Expected: Response is list of ProjectInfo objects
    """
    test_client, mock_db = client
    
    mock_projects = [
        {
            "project_id": "proj-1",
            "name": "Project One",
            "description": "First project",
            "created_at": "2024-01-01T10:00:00",
        },
        {
            "project_id": "proj-2",
            "name": "Project Two",
            "description": "Second project",
            "created_at": "2024-01-02T10:00:00",
        },
    ]
    
    mock_db.table().select().order_by().execute = MagicMock(
        return_value=MagicMock(data=mock_projects)
    )
    
    response = await test_client.get("/api/projects")
    
    assert response.status_code == 200
    data = response.json()
    assert "projects" in data
    assert len(data["projects"]) == 2
    assert data["projects"][0]["name"] == "Project One"


# ============================================================================
# BONUS: Health Check
# ============================================================================

@pytest.mark.asyncio
async def test_health_check(client):
    """
    Test: GET /health
    Expected: Response status 200 with ok status
    """
    test_client, mock_db = client
    
    response = await test_client.get("/health")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "timestamp" in data


# ============================================================================
# BONUS: API Root Endpoint
# ============================================================================

@pytest.mark.asyncio
async def test_root_endpoint(client):
    """
    Test: GET /
    Expected: Returns API info with docs links and active LLM config
    """
    test_client, mock_db = client
    
    response = await test_client.get("/")
    
    assert response.status_code == 200
    data = response.json()
    assert "message" in data
    assert "docs" in data
    assert "active_llm_provider" in data
    assert "active_model" in data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
