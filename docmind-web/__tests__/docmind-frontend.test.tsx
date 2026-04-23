import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import HomePage from "@/app/page";
import DashboardPage from "@/app/dashboard/page";
import StepOne from "@/components/StepOne";
import StepThree from "@/components/StepThree";
import StepTwo from "@/components/StepTwo";
import { Toaster } from "@/components/ui/toaster";
import * as api from "@/lib/api";

describe("DocMind frontend", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("test_landing_page_renders_cta_button", () => {
    render(<HomePage />);
    expect(screen.getByRole("link", { name: "Build Your Chatbot" })).toBeInTheDocument();
  });

  test("test_step_one_continue_disabled_without_name", () => {
    render(<StepOne onCreated={() => undefined} />);

    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Bot name"), { target: { value: "Support Bot" } });
    expect(continueButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "test-key" } });
    expect(continueButton).toBeEnabled();
  });

  test("test_step_one_calls_create_project_on_continue", async () => {
    const createSpy = vi.spyOn(api, "createProject").mockResolvedValue({
      project_id: "proj-123",
      name: "Support Bot",
    });

    render(<StepOne onCreated={() => undefined} />);

    fireEvent.change(screen.getByLabelText("Bot name"), { target: { value: "Support Bot" } });
    fireEvent.change(screen.getByLabelText("What should this bot know about?"), {
      target: { value: "Product docs" },
    });
    fireEvent.change(screen.getByLabelText("Tone"), { target: { value: "Technical" } });
    fireEvent.change(screen.getByLabelText("Topics this bot should NOT answer"), {
      target: { value: "Medical advice" },
    });
    fireEvent.change(screen.getByLabelText("AI provider"), { target: { value: "gemini" } });
    fireEvent.change(screen.getByLabelText("Model name"), { target: { value: "gemini-2.5-flash" } });
    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "test-key" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => {
      expect(createSpy).toHaveBeenCalledWith({
        name: "Support Bot",
        description: "Product docs",
        tone: "Technical",
        restrictedTopics: "Medical advice",
        provider: "gemini",
        model: "gemini-2.5-flash",
        apiKey: "test-key",
      });
    });
  });

  test("test_step_two_continue_disabled_before_upload", () => {
    render(<StepTwo projectId="proj-1" onContinue={() => undefined} />);

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  test("test_step_two_shows_chunk_count_after_upload", async () => {
    vi.spyOn(api, "uploadDocument").mockResolvedValue({ chunks_stored: 7 });
    render(<StepTwo projectId="proj-1" onContinue={() => undefined} />);

    const file = new File(["hello"], "doc.txt", { type: "text/plain" });
    const dropArea = screen.getByText("Drag and drop files here").closest("label");
    if (!dropArea) throw new Error("Drop area not found");

    fireEvent.drop(dropArea, { dataTransfer: { files: [file] } });

    expect(await screen.findByText("doc.txt: 7 chunks stored")).toBeInTheDocument();
  });

  test("test_step_three_shows_script_tag", () => {
    render(<StepThree projectId="proj-77" onDashboard={() => undefined} />);
    expect(screen.getByText(/widget\.js\?id=proj-77/)).toBeInTheDocument();
  });

  test("test_step_three_copy_button_writes_to_clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    render(<StepThree projectId="proj-88" onDashboard={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy to clipboard" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        '<script src="http://localhost:8000/widget.js?id=proj-88"></script>'
      );
    });
  });

  test("test_dashboard_shows_empty_state_when_no_projects", async () => {
    vi.spyOn(api, "getProjects").mockResolvedValue([]);

    render(<DashboardPage />);

    expect(await screen.findByText("No projects yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Build your first chatbot" })).toBeInTheDocument();
  });

  test("test_dashboard_renders_project_cards", async () => {
    vi.spyOn(api, "getProjects").mockResolvedValue([
      { project_id: "p1", name: "Bot One", description: "A" },
      { project_id: "p2", name: "Bot Two", description: "B" },
    ]);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getAllByTestId("project-card")).toHaveLength(2);
    });
  });

  test("test_api_error_shows_toast", async () => {
    vi.spyOn(api, "createProject").mockRejectedValue(new Error("API failed"));

    render(
      <>
        <StepOne onCreated={() => undefined} />
        <Toaster />
      </>
    );

    fireEvent.change(screen.getByLabelText("API key"), { target: { value: "test-key" } });
    fireEvent.change(screen.getByLabelText("Bot name"), { target: { value: "Broken Bot" } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("API failed")).toBeInTheDocument();
  });
});
