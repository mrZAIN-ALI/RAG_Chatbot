export interface CreateProjectPayload {
  name: string;
  description: string;
  tone: "Professional" | "Friendly" | "Technical";
  restrictedTopics: string;
  provider: string;
  model: string;
  apiKey: string;
}

export interface CreateProjectResponse {
  project_id: string;
  name: string;
}

export interface UploadDocumentResponse {
  chunks_stored: number;
}

export interface SendMessageResponse {
  answer: string;
  confidence: number;
}

export interface Message {
  id?: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

export interface Project {
  project_id: string;
  name: string;
  description?: string;
}

interface GetProjectsResponse {
  projects: Project[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

function getErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = payload.detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
  }

  return fallback;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const fallback = `Request failed with status ${response.status}`;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const payload: unknown = await response.json();
      throw new Error(getErrorMessage(payload, fallback));
    }

    const errorText = await response.text();
    throw new Error(getErrorMessage(errorText, fallback));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export async function createProject(data: CreateProjectPayload): Promise<CreateProjectResponse> {
  const response = await fetch(`${API_BASE}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: data.name,
      description: data.description,
      tone: data.tone,
      restrictions: data.restrictedTopics,
      provider: data.provider,
      model: data.model,
      api_key: data.apiKey,
    }),
  });
  return handleResponse<CreateProjectResponse>(response);
}

export async function uploadDocument(file: File, project_id: string): Promise<UploadDocumentResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("project_id", project_id);

  const response = await fetch(`${API_BASE}/api/upload`, {
    method: "POST",
    body: formData,
  });
  return handleResponse<UploadDocumentResponse>(response);
}

export async function sendMessage(
  project_id: string,
  message: string,
  provider: string,
  model: string,
  api_key: string
): Promise<SendMessageResponse> {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project_id, message, provider, model, api_key }),
  });
  return handleResponse<SendMessageResponse>(response);
}

export async function getHistory(project_id: string): Promise<Message[]> {
  const response = await fetch(`${API_BASE}/api/history/${encodeURIComponent(project_id)}`);
  const payload = await handleResponse<{ messages: Message[] } | Message[]>(response);
  return Array.isArray(payload) ? payload : payload.messages;
}

export async function getProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE}/api/projects`);
  const payload = await handleResponse<GetProjectsResponse | Project[]>(response);
  return Array.isArray(payload) ? payload : payload.projects;
}

export async function deleteProject(project_id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/projects/${encodeURIComponent(project_id)}`, {
    method: "DELETE",
  });
  await handleResponse<void>(response);
}
