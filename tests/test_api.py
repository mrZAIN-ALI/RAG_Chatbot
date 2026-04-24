"""Tests for the DocMind FastAPI backend."""

from io import BytesIO
from unittest.mock import MagicMock, patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from api.dependencies import get_supabase_client
from api.main import app


@pytest_asyncio.fixture
async def client():
    """Provide an async test client with Supabase mocked."""
    mock_db = MagicMock()
    app.dependency_overrides[get_supabase_client] = lambda: mock_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as test_client:
        yield test_client, mock_db

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_create_project_returns_project_id(client):
    """POST /api/projects returns a generated project_id and name."""
    test_client, mock_db = client
    mock_db.table().insert().execute.return_value = MagicMock()

    response = await test_client.post(
        "/api/projects",
        json={
            "name": "Support Bot",
            "description": "Docs",
            "tone": "Professional",
            "restrictions": "None",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["project_id"]
    assert data["name"] == "Support Bot"


@pytest.mark.asyncio
async def test_create_project_missing_name_returns_422(client):
    """POST /api/projects rejects an empty name."""
    test_client, _mock_db = client

    response = await test_client.post(
        "/api/projects",
        json={"name": "", "description": "Docs", "tone": "Professional", "restrictions": ""},
    )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_upload_valid_pdf_returns_chunks_stored(client):
    """POST /api/upload returns the mocked chunk count for a PDF."""
    test_client, _mock_db = client

    with patch("api.main.upload_document", return_value={"chunks_stored": 5}):
        response = await test_client.post(
            "/api/upload",
            data={"project_id": "project-1"},
            files={"file": ("guide.pdf", BytesIO(b"%PDF mock"), "application/pdf")},
        )

    assert response.status_code == 200
    assert response.json() == {"chunks_stored": 5, "filename": "guide.pdf"}


@pytest.mark.asyncio
async def test_upload_no_file_returns_422(client):
    """POST /api/upload rejects requests without a file."""
    test_client, _mock_db = client

    response = await test_client.post("/api/upload", data={"project_id": "project-1"})

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_chat_returns_answer_and_confidence(client):
    """POST /api/chat returns an answer and confidence from mocked RAG functions."""
    test_client, mock_db = client
    mock_db.table().select().eq().limit().execute.return_value = MagicMock(data=[])
    mock_db.table().select().eq().order().limit().execute.return_value = MagicMock(data=[])
    mock_db.table().insert().execute.return_value = MagicMock()

    with patch("api.main.retrieve_and_rerank", return_value=[{"content": "chunk"}]), patch(
        "api.main.generate_answer",
        return_value={"answer": "Mock answer", "confidence": 0.82},
    ):
        response = await test_client.post(
            "/api/chat",
            json={
                "project_id": "project-1",
                "message": "What is this?",
                "provider": "gemini",
                "model": "gemini-2.0-flash",
                "api_key": "test-key",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["answer"] == "Mock answer"
    assert isinstance(data["confidence"], float)


@pytest.mark.asyncio
async def test_chat_missing_api_key_returns_422(client):
    """POST /api/chat requires api_key."""
    test_client, mock_db = client
    mock_db.table().select().eq().limit().execute.return_value = MagicMock(data=[])

    with patch.dict("os.environ", {"GEMINI_API_KEY": ""}):
        response = await test_client.post(
            "/api/chat",
            json={
                "project_id": "project-1",
                "message": "Hi",
                "provider": "gemini",
                "model": "gemini-2.0-flash",
            },
        )

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_chat_provider_error_returns_502(client):
    """POST /api/chat surfaces provider failures as HTTP errors."""
    test_client, mock_db = client
    mock_db.table().select().eq().limit().execute.return_value = MagicMock(data=[])
    mock_db.table().select().eq().order().limit().execute.return_value = MagicMock(data=[])

    with patch("api.main.retrieve_and_rerank", return_value=[{"content": "chunk"}]), patch(
        "api.main.generate_answer",
        return_value='Error: Failed to generate answer: 400 API key not valid.',
    ):
        response = await test_client.post(
            "/api/chat",
            json={
                "project_id": "project-1",
                "message": "What is this?",
                "provider": "gemini",
                "model": "gemini-2.5-flash",
                "api_key": "bad-key",
            },
        )

    assert response.status_code == 502
    assert "API key not valid" in response.json()["detail"]


@pytest.mark.asyncio
async def test_get_history_returns_list(client):
    """GET /api/history/{project_id} returns message rows as a list."""
    test_client, mock_db = client
    mock_db.table().select().eq().order().execute.return_value = MagicMock(
        data=[
            {"role": "user", "content": "One", "timestamp": "2026-01-01T00:00:00"},
            {"role": "assistant", "content": "Two", "timestamp": "2026-01-01T00:00:01"},
            {"role": "user", "content": "Three", "timestamp": "2026-01-01T00:00:02"},
        ]
    )

    response = await test_client.get("/api/history/project-1")

    assert response.status_code == 200
    assert isinstance(response.json(), list)
    assert len(response.json()) == 3


@pytest.mark.asyncio
async def test_delete_project_returns_deleted_true(client):
    """DELETE /api/projects/{project_id} returns deleted=true."""
    test_client, mock_db = client
    mock_db.table().delete().eq().execute.return_value = MagicMock()

    response = await test_client.delete("/api/projects/project-1")

    assert response.status_code == 200
    assert response.json() == {"deleted": True}


@pytest.mark.asyncio
async def test_widget_js_served_as_javascript(client):
    """GET /widget.js serves JavaScript content."""
    test_client, _mock_db = client

    response = await test_client.get("/widget.js")

    assert response.status_code == 200
    assert "application/javascript" in response.headers["content-type"]


@pytest.mark.asyncio
async def test_health_endpoint_returns_ok(client):
    """GET /health returns the Railway health-check payload."""
    test_client, _mock_db = client

    response = await test_client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_cors_headers_present(client):
    """Requests with an Origin header include CORS headers."""
    test_client, _mock_db = client

    response = await test_client.get("/health", headers={"Origin": "https://example.com"})

    assert response.status_code == 200
    assert "access-control-allow-origin" in response.headers
