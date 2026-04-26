"""Real integration tests for the running DocMind FastAPI backend."""

from __future__ import annotations

import json
import os
import uuid
from pathlib import Path

import httpx
import pytest


LOW_CONFIDENCE_PREFIX = (
    "I could not find information related to this in the business details. "
    "I am here to assist with questions about this business, its products, "
    "services, policies, and uploaded information. "
)
ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env"
RUNTIME_DIR = ROOT / ".runtime"
PID_FILES = (
    RUNTIME_DIR / "docmind-runner.pids.json",
    ROOT / ".docmind-runner.pids.json",
)
SAMPLE_PDF = ROOT / "tests" / "fixtures" / "sample.pdf"


def _parse_env_file(path: Path) -> dict[str, str]:
    """Parse a simple .env file without mutating process state."""
    if not path.exists():
        return {}

    values: dict[str, str] = {}
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


RUNTIME_ENV = _parse_env_file(ENV_FILE)
RUNTIME_ENV.update(os.environ)


def _resolve_api_base() -> str:
    """Resolve the live FastAPI base URL from env, runner metadata, or fallback."""
    explicit = RUNTIME_ENV.get("DOCMIND_API_BASE")
    if explicit:
        return explicit.rstrip("/")

    for pid_file in PID_FILES:
        if not pid_file.exists():
            continue

        try:
            pid_data = json.loads(pid_file.read_text(encoding="utf-8"))
            api_base = pid_data.get("apiBase")
            if api_base:
                return str(api_base).rstrip("/")
        except (OSError, json.JSONDecodeError):
            pass

    return "http://127.0.0.1:8000"


API_BASE = _resolve_api_base()


def _is_configured_secret(value: str | None) -> bool:
    """Return whether an env value looks like a real credential instead of a placeholder."""
    if not value:
        return False

    lowered = value.strip().lower()
    placeholder_tokens = ("your_", "placeholder", "changeme", "replace", "example")
    if any(token in lowered for token in placeholder_tokens):
        return False

    return len(value.strip()) >= 20


def _provider_config(provider: str) -> dict[str, str] | None:
    """Return provider credentials/model from the runtime environment if available."""
    normalized = provider.lower()
    if normalized == "gemini":
        api_key = RUNTIME_ENV.get("GEMINI_API_KEY")
        if not _is_configured_secret(api_key):
            return None
        return {
            "provider": "gemini",
            "model": RUNTIME_ENV.get("GEMINI_MODEL", "gemini-2.5-flash"),
            "api_key": api_key,
        }

    if normalized == "groq":
        api_key = RUNTIME_ENV.get("GROQ_API_KEY")
        if not _is_configured_secret(api_key):
            return None
        return {
            "provider": "groq",
            "model": RUNTIME_ENV.get("GROQ_MODEL", "llama3-8b-8192"),
            "api_key": api_key,
        }

    return None


def _pick_default_provider() -> dict[str, str]:
    """Choose the first available provider for real-chat integration tests."""
    for provider_name in ("gemini", "groq"):
        config = _provider_config(provider_name)
        if config:
            return config
    pytest.skip("No supported provider key found in .env. Add GEMINI_API_KEY or GROQ_API_KEY.")


async def _assert_backend_available() -> None:
    """Skip the suite when the target backend is not reachable."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(f"{API_BASE}/health")
        if response.status_code != 200:
            pytest.skip(f"FastAPI backend is not healthy at {API_BASE}/health")
    except httpx.HTTPError as exc:
        pytest.skip(f"FastAPI backend is not reachable at {API_BASE}: {exc}")


async def _create_project(client: httpx.AsyncClient, llm_config: dict[str, str]) -> str:
    """Create one temporary project and return its id."""
    project_name = f"DocMind Integration {uuid.uuid4().hex[:8]}"
    response = await client.post(
        "/api/projects",
        json={
            "name": project_name,
            "description": "DocMind return policy knowledge base",
            "tone": "Professional",
            "restrictions": "Do not answer unrelated policy questions with certainty.",
            "provider": llm_config["provider"],
            "model": llm_config["model"],
            "api_key": llm_config["api_key"],
        },
    )
    response.raise_for_status()
    payload = response.json()
    return payload["project_id"]


async def _upload_sample_pdf(client: httpx.AsyncClient, project_id: str) -> dict:
    """Upload the shared PDF fixture to the target project."""
    if not SAMPLE_PDF.exists():
        pytest.skip(f"Missing PDF fixture: {SAMPLE_PDF}")

    with SAMPLE_PDF.open("rb") as handle:
        response = await client.post(
            "/api/upload",
            data={"project_id": project_id},
            files={"file": ("sample.pdf", handle, "application/pdf")},
        )

    response.raise_for_status()
    return response.json()


async def _delete_project(client: httpx.AsyncClient, project_id: str) -> None:
    """Delete a temporary integration project without raising on cleanup failures."""
    try:
        await client.delete(f"/api/projects/{project_id}")
    except httpx.HTTPError:
        pass


@pytest.mark.asyncio
async def test_full_rag_flow() -> None:
    """Create, upload, chat, and delete a real project through the running API."""
    await _assert_backend_available()
    llm_config = _pick_default_provider()
    project_id: str | None = None

    async with httpx.AsyncClient(base_url=API_BASE, timeout=180.0) as client:
        try:
            project_id = await _create_project(client, llm_config)

            upload_payload = await _upload_sample_pdf(client, project_id)
            assert upload_payload["chunks_stored"] > 0

            chat_response = await client.post(
                "/api/chat",
                json={
                    "project_id": project_id,
                    "message": "How many days do customers have to return unused physical products?",
                },
            )
            chat_response.raise_for_status()
            chat_payload = chat_response.json()

            assert isinstance(chat_payload["answer"], str)
            assert chat_payload["answer"].strip()
            assert 0.0 <= float(chat_payload["confidence"]) <= 1.0

            delete_response = await client.delete(f"/api/projects/{project_id}")
            delete_response.raise_for_status()
            assert delete_response.json()["deleted"] is True
            deleted_project_id = project_id
            project_id = None

            projects_response = await client.get("/api/projects")
            projects_response.raise_for_status()
            projects = projects_response.json()
            assert all(item["project_id"] != deleted_project_id for item in projects)
        finally:
            if project_id:
                await _delete_project(client, project_id)


@pytest.mark.asyncio
async def test_low_confidence_flow() -> None:
    """Unrelated questions should receive the low-confidence warning prefix."""
    await _assert_backend_available()
    llm_config = _pick_default_provider()
    project_id: str | None = None

    async with httpx.AsyncClient(base_url=API_BASE, timeout=180.0) as client:
        try:
            project_id = await _create_project(client, llm_config)
            await _upload_sample_pdf(client, project_id)

            chat_response = await client.post(
                "/api/chat",
                json={
                    "project_id": project_id,
                    "message": "What is the orbital period of Neptune in Earth years?",
                },
            )
            chat_response.raise_for_status()
            chat_payload = chat_response.json()

            assert chat_payload["answer"].startswith(LOW_CONFIDENCE_PREFIX)
            assert 0.0 <= float(chat_payload["confidence"]) <= 1.0
        finally:
            if project_id:
                await _delete_project(client, project_id)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("provider_name", "api_key_env"),
    [
        ("gemini", "GEMINI_API_KEY"),
        ("groq", "GROQ_API_KEY"),
    ],
)
async def test_multiple_providers(provider_name: str, api_key_env: str) -> None:
    """Run one real chat turn for each provider key available in the runtime environment."""
    await _assert_backend_available()
    llm_config = _provider_config(provider_name)
    if llm_config is None or not _is_configured_secret(RUNTIME_ENV.get(api_key_env)):
        pytest.skip(f"{provider_name} is not configured in .env")

    project_id: str | None = None

    async with httpx.AsyncClient(base_url=API_BASE, timeout=180.0) as client:
        try:
            project_id = await _create_project(client, llm_config)
            await _upload_sample_pdf(client, project_id)

            chat_response = await client.post(
                "/api/chat",
                json={
                    "project_id": project_id,
                    "message": "When are approved refunds sent back to the customer?",
                },
            )
            chat_response.raise_for_status()
            chat_payload = chat_response.json()

            assert isinstance(chat_payload["answer"], str)
            assert chat_payload["answer"].strip()
            assert 0.0 <= float(chat_payload["confidence"]) <= 1.0
        finally:
            if project_id:
                await _delete_project(client, project_id)
