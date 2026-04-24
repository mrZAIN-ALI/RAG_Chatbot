"""Run full-stack acceptance tests with a managed FastAPI backend."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]
API_BASE = os.environ.get("DOCMIND_API_BASE", "http://127.0.0.1:8000").rstrip("/")
API_LOG = ROOT / ".docmind-test-api.log"
API_ERR_LOG = ROOT / ".docmind-test-api.err.log"


def health_ok() -> bool:
    """Return whether the configured API base responds with status ok."""
    try:
        with urllib.request.urlopen(f"{API_BASE}/health", timeout=2) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return response.status == 200 and payload.get("status") == "ok"
    except (OSError, urllib.error.URLError, json.JSONDecodeError):
        return False


def wait_for_health(timeout_seconds: int = 90) -> bool:
    """Wait for FastAPI to become healthy."""
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        if health_ok():
            return True
        time.sleep(0.5)
    return False


def start_backend() -> subprocess.Popen[bytes] | None:
    """Start a local backend unless DOCMIND_API_BASE points somewhere else."""
    parsed = urlparse(API_BASE)
    if parsed.hostname not in {"127.0.0.1", "localhost"}:
        return None

    port = str(parsed.port or 8000)
    API_LOG.unlink(missing_ok=True)
    API_ERR_LOG.unlink(missing_ok=True)

    stdout = API_LOG.open("wb")
    stderr = API_ERR_LOG.open("wb")
    return subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "api.main:app",
            "--host",
            parsed.hostname or "127.0.0.1",
            "--port",
            port,
        ],
        cwd=ROOT,
        stdout=stdout,
        stderr=stderr,
    )


def run_command(command: list[str]) -> int:
    """Run one command with the API base exposed to child tests."""
    env = os.environ.copy()
    env["DOCMIND_API_BASE"] = API_BASE
    return subprocess.run(command, cwd=ROOT, env=env).returncode


def npx_command() -> str:
    """Return the platform-specific npx executable."""
    executable = "npx.cmd" if os.name == "nt" else "npx"
    resolved = shutil.which(executable)
    if not resolved:
        raise RuntimeError(f"Could not find {executable} on PATH.")
    return resolved


def main() -> int:
    backend = None
    started_backend = False

    try:
        if not health_ok():
            backend = start_backend()
            if backend is None:
                print(f"Backend is not healthy at {API_BASE}/health", file=sys.stderr)
                return 1
            started_backend = True

        if not wait_for_health():
            print(f"Timed out waiting for {API_BASE}/health", file=sys.stderr)
            print(f"Backend stdout: {API_LOG}", file=sys.stderr)
            print(f"Backend stderr: {API_ERR_LOG}", file=sys.stderr)
            return 1

        commands = [
            [sys.executable, "-m", "pytest", "tests/test_integration.py", "-v"],
            [npx_command(), "playwright", "test", "tests/test_widget_integration.js"],
        ]

        for command in commands:
            exit_code = run_command(command)
            if exit_code != 0:
                return exit_code

        return 0
    finally:
        if started_backend and backend is not None:
            backend.terminate()
            try:
                backend.wait(timeout=10)
            except subprocess.TimeoutExpired:
                backend.kill()
                backend.wait(timeout=10)


if __name__ == "__main__":
    raise SystemExit(main())
