const fs = require("fs");
const http = require("http");
const path = require("path");
const { test, expect } = require("@playwright/test");


const ROOT = path.resolve(__dirname, "..");
const ENV_FILE = path.join(ROOT, ".env");
const PID_FILES = [
  path.join(ROOT, ".runtime", "docmind-runner.pids.json"),
  path.join(ROOT, ".docmind-runner.pids.json"),
];
const SAMPLE_PDF = path.join(ROOT, "tests", "fixtures", "sample.pdf");
const BAD_KEY_MODEL = "gemini-2.5-flash";


function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const values = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) {
      continue;
    }
    const [key, ...rest] = line.split("=");
    values[key.trim()] = rest.join("=").trim().replace(/^['"]|['"]$/g, "");
  }
  return values;
}


const runtimeEnv = { ...parseEnvFile(ENV_FILE), ...process.env };


function resolveApiBase() {
  if (runtimeEnv.DOCMIND_API_BASE) {
    return runtimeEnv.DOCMIND_API_BASE.replace(/\/$/, "");
  }

  for (const pidFile of PID_FILES) {
    if (!fs.existsSync(pidFile)) {
      continue;
    }

    try {
      const pidData = JSON.parse(fs.readFileSync(pidFile, "utf8"));
      if (pidData.apiBase) {
        return String(pidData.apiBase).replace(/\/$/, "");
      }
    } catch (error) {
      // Ignore malformed runner metadata.
    }
  }

  return "http://127.0.0.1:8000";
}


const API_BASE = resolveApiBase();


function isConfiguredSecret(value) {
  if (!value) {
    return false;
  }

  const lowered = String(value).trim().toLowerCase();
  const placeholderTokens = ["your_", "placeholder", "changeme", "replace", "example"];
  if (placeholderTokens.some((token) => lowered.includes(token))) {
    return false;
  }

  return String(value).trim().length >= 20;
}


function pickProviderConfig() {
  if (isConfiguredSecret(runtimeEnv.GEMINI_API_KEY)) {
    return {
      provider: "gemini",
      model: runtimeEnv.GEMINI_MODEL || "gemini-2.5-flash",
      apiKey: runtimeEnv.GEMINI_API_KEY,
    };
  }

  if (isConfiguredSecret(runtimeEnv.GROQ_API_KEY)) {
    return {
      provider: "groq",
      model: runtimeEnv.GROQ_MODEL || "llama3-8b-8192",
      apiKey: runtimeEnv.GROQ_API_KEY,
    };
  }

  test.skip(true, "No supported provider key found in .env for widget integration tests.");
}


async function assertBackendAvailable() {
  const response = await fetch(`${API_BASE}/health`);
  if (!response.ok) {
    throw new Error(`FastAPI backend is not healthy at ${API_BASE}/health`);
  }
}


async function createProject(config, namePrefix = "Widget Integration") {
  const requestBody = {
    name: `${namePrefix} ${Date.now()} ${Math.random().toString(16).slice(2, 8)}`,
    description: "DocMind return policy knowledge base",
    tone: "Professional",
    restrictions: "Avoid guessing when the policy is unrelated.",
    provider: config.provider || "gemini",
    model: config.model || "gemini-2.5-flash",
  };

  if (Object.prototype.hasOwnProperty.call(config, "apiKey")) {
    requestBody.api_key = config.apiKey;
  }

  const response = await fetch(`${API_BASE}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Project creation failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}


async function uploadSamplePdf(projectId) {
  const form = new FormData();
  const pdfBuffer = fs.readFileSync(SAMPLE_PDF);
  form.append("file", new Blob([pdfBuffer], { type: "application/pdf" }), "sample.pdf");
  form.append("project_id", projectId);

  const response = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}


async function deleteProject(projectId) {
  await fetch(`${API_BASE}/api/projects/${encodeURIComponent(projectId)}`, {
    method: "DELETE",
  });
}


function startHostServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      const requestUrl = new URL(request.url, "http://127.0.0.1");
      const projectId = requestUrl.searchParams.get("project") || "";

      const html = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>DocMind Widget Host</title>
  </head>
  <body>
    <script src="${API_BASE}/widget.js?id=${encodeURIComponent(projectId)}"></script>
  </body>
</html>`;

      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      response.end(html);
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        origin: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}


test.describe("DocMind widget integration", () => {
  let hostServer;
  const projectIds = [];

  test.beforeAll(async () => {
    await assertBackendAvailable();
    if (!fs.existsSync(SAMPLE_PDF)) {
      throw new Error(`Missing PDF fixture: ${SAMPLE_PDF}`);
    }
    hostServer = await startHostServer();
  });

  test.afterAll(async () => {
    for (const projectId of projectIds.splice(0)) {
      await deleteProject(projectId);
    }
    if (hostServer) {
      await new Promise((resolve, reject) => hostServer.server.close((error) => (error ? reject(error) : resolve())));
    }
  });

  test("widget injects into real page", async ({ page }) => {
    const created = await createProject({}, "Widget Inject");
    projectIds.push(created.project_id);

    await page.goto(`${hostServer.origin}/?project=${encodeURIComponent(created.project_id)}`);

    await expect(page.locator(".docmind-button")).toBeVisible();
  });

  test("full widget chat flow", async ({ page }) => {
    test.setTimeout(180000);

    const config = pickProviderConfig();
    const created = await createProject(config, "Widget Chat");
    projectIds.push(created.project_id);
    const uploadPayload = await uploadSamplePdf(created.project_id);
    expect(uploadPayload.chunks_stored).toBeGreaterThan(0);

    await page.goto(`${hostServer.origin}/?project=${encodeURIComponent(created.project_id)}`);
    await page.locator(".docmind-button").click();
    await expect(page.locator(".docmind-panel")).toHaveClass(/docmind-open/);

    const assistantMessages = page.locator(".docmind-message.docmind-assistant .docmind-message-bubble");
    const initialCount = await assistantMessages.count();

    await page.locator(".docmind-message-input").fill("How many days do customers have to return unused physical products?");
    await page.locator(".docmind-send-button").click();

    await expect(assistantMessages).toHaveCount(initialCount + 1, { timeout: 120000 });
    await expect(assistantMessages.last()).not.toHaveText("", { timeout: 120000 });
  });

  test("widget shows error on bad api key", async ({ page }) => {
    test.setTimeout(180000);

    const badConfig = {
      provider: "gemini",
      model: BAD_KEY_MODEL,
      apiKey: "invalid-docmind-key",
    };
    const created = await createProject(badConfig, "Widget Bad Key");
    projectIds.push(created.project_id);
    await uploadSamplePdf(created.project_id);

    await page.goto(`${hostServer.origin}/?project=${encodeURIComponent(created.project_id)}`);
    await page.locator(".docmind-button").click();
    await page.locator(".docmind-message-input").fill("What is the return window?");
    await page.locator(".docmind-send-button").click();

    const errorBubble = page.locator(".docmind-error .docmind-message-bubble").last();
    await expect(errorBubble).toBeVisible({ timeout: 120000 });
    await expect(errorBubble).toContainText(/key|wrong|rejected|invalid|setup/i, { timeout: 120000 });
  });
});
