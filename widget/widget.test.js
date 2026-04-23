const fs = require("fs");

describe("DocMind widget", () => {
  let widgetCode;
  let mockFetch;

  const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));
  const settleHistory = async () => {
    await flushPromises();
    await flushPromises();
    mockFetch.mockClear();
  };

  const mountWidget = () => {
    const scriptTag = document.createElement("script");
    scriptTag.src = "https://api.example.test/widget.js?id=project-123";
    document.head.appendChild(scriptTag);

    const script = document.createElement("script");
    script.textContent = widgetCode;
    document.body.appendChild(script);
  };

  const setMessage = (value) => {
    const input = document.querySelector(".docmind-message-input");
    input.value = value;
    input.dispatchEvent(new Event("input"));
    return input;
  };

  beforeAll(() => {
    widgetCode = fs.readFileSync(`${__dirname}/widget.js`, "utf8");
  });

  beforeEach(() => {
    document.documentElement.innerHTML = "<head></head><body></body>";
    sessionStorage.clear();
    mockFetch = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });
    global.fetch = mockFetch;
    mountWidget();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("floating button is injected into DOM on load", () => {
    expect(document.querySelector(".docmind-button")).toBeTruthy();
  });

  test("chat panel hidden by default", () => {
    expect(document.querySelector(".docmind-panel").classList.contains("docmind-open")).toBe(false);
  });

  test("panel opens on button click", () => {
    document.querySelector(".docmind-button").click();
    expect(document.querySelector(".docmind-panel").classList.contains("docmind-open")).toBe(true);
  });

  test("panel closes on close button click", () => {
    document.querySelector(".docmind-button").click();
    document.querySelector(".docmind-close-button").click();
    expect(document.querySelector(".docmind-panel").classList.contains("docmind-open")).toBe(false);
  });

  test("send button disabled when input empty", () => {
    setMessage("");
    expect(document.querySelector(".docmind-send-button").disabled).toBe(true);
  });

  test("fetch called with correct body on send", async () => {
    await settleHistory();
    setMessage("Hello");
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ answer: "Hi", confidence: 0.9 }) });

    document.querySelector(".docmind-send-button").click();
    await flushPromises();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.test/api/chat",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: "project-123",
          message: "Hello",
        }),
      })
    );
  });

  test("assistant message appears after fetch resolves", async () => {
    await settleHistory();
    setMessage("Hello");
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ answer: "Assistant answer", confidence: 0.9 }) });

    document.querySelector(".docmind-send-button").click();
    await flushPromises();

    expect(document.querySelector(".docmind-assistant .docmind-message-bubble").textContent).toBe("Assistant answer");
  });

  test("assistant markdown is rendered as formatted html", async () => {
    await settleHistory();
    setMessage("Hello");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ answer: "**Skills**\n- Python\n- `RAG`", confidence: 0.9 }),
    });

    document.querySelector(".docmind-send-button").click();
    await flushPromises();

    const bubble = document.querySelector(".docmind-assistant .docmind-message-bubble");
    expect(bubble.querySelector("strong").textContent).toBe("Skills");
    expect(bubble.querySelectorAll("li")).toHaveLength(2);
    expect(bubble.querySelector("code").textContent).toBe("RAG");
  });

  test("inline gemini markdown bullets are rendered as a list", async () => {
    await settleHistory();
    setMessage("Hello");
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        answer: "Summary: **Key highlights:** * **Work Experience:** Built apps. * **Projects:** Made DocMind.",
        confidence: 0.9,
      }),
    });

    document.querySelector(".docmind-send-button").click();
    await flushPromises();

    const bubble = document.querySelector(".docmind-assistant .docmind-message-bubble");
    expect(bubble.querySelector("strong").textContent).toBe("Key highlights:");
    expect(bubble.querySelectorAll("li")).toHaveLength(2);
  });

  test("chat history loads when panel opens", async () => {
    document.documentElement.innerHTML = "<head></head><body></body>";
    mockFetch.mockClear();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: "MedicalBot", welcome_message: "Welcome to MedicalBot." }),
    });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { role: "document", content: "Hidden document text", timestamp: "2026-01-01T00:00:00" },
        { role: "user", content: "Previous question", timestamp: "2026-01-01T00:00:01" },
        { role: "assistant", content: "**Previous answer**", timestamp: "2026-01-01T00:00:02" },
      ],
    });
    mountWidget();

    document.querySelector(".docmind-button").click();
    await flushPromises();
    await flushPromises();

    expect(mockFetch).toHaveBeenCalledWith("https://api.example.test/api/projects/project-123/widget-config");
    expect(mockFetch).toHaveBeenCalledWith("https://api.example.test/api/history/project-123");
    expect(document.querySelector(".docmind-messages").textContent).toContain("Previous question");
    expect(document.querySelector(".docmind-messages").textContent).toContain("Previous answer");
    expect(document.querySelector(".docmind-messages").textContent).not.toContain("Hidden document text");
  });

  test("error message shown when fetch rejects", async () => {
    await settleHistory();
    setMessage("Hello");
    mockFetch.mockRejectedValueOnce(new Error("Network down"));

    document.querySelector(".docmind-send-button").click();
    await flushPromises();

    expect(document.querySelector(".docmind-error .docmind-message-bubble").textContent).toContain("Something went wrong");
  });

  test("api key error message shown when backend rejects key", async () => {
    await settleHistory();
    setMessage("Hello");
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ detail: "Error: Failed to generate answer: API_KEY_INVALID" }),
    });

    document.querySelector(".docmind-send-button").click();
    await flushPromises();

    expect(document.querySelector(".docmind-error .docmind-message-bubble").textContent).toContain("Gemini API key was rejected");
  });

  test("welcome message appears when history is empty", async () => {
    document.documentElement.innerHTML = "<head></head><body></body>";
    mockFetch.mockClear();
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ name: "MedicalBot", welcome_message: "Welcome to MedicalBot. Ask about the clinic." }),
    });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => [] });

    mountWidget();
    document.querySelector(".docmind-button").click();
    await flushPromises();
    await flushPromises();

    expect(document.querySelector(".docmind-header-title").textContent).toBe("MedicalBot Assistant");
    expect(document.querySelector(".docmind-messages").textContent).toContain("Welcome to MedicalBot");
  });

  test("visitor credentials are not shown in the widget", async () => {
    await settleHistory();
    expect(document.querySelector(".docmind-provider-input")).toBeNull();
    expect(document.querySelector(".docmind-model-input")).toBeNull();
    expect(document.querySelector(".docmind-apikey-input")).toBeNull();
  });

  test("Enter key triggers send", async () => {
    await settleHistory();
    const input = setMessage("Hello");
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ answer: "Hi", confidence: 0.9 }) });

    input.dispatchEvent(new KeyboardEvent("keypress", { key: "Enter" }));
    await flushPromises();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
