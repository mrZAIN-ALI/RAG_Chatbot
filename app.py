import streamlit as st
from dotenv import load_dotenv
import os
from supabase import create_client, Client
from document_processor import upload_document, retrieve_relevant_chunks, generate_answer  # Import the functions

# Load environment variables from .env file
load_dotenv()

# Load API keys and URLs
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_API_KEY = os.getenv("SUPABASE_API_KEY")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_API_KEY)

st.set_page_config(page_title="RAG 2.0", page_icon="🤖", layout="wide")

st.markdown(
    """
    <style>
    .stApp {
        background: #343541;
    }
    [data-testid="stSidebar"] {
        background: #202123;
    }
    [data-testid="stChatMessage"] {
        border-radius: 12px;
    }
    .main-title {
        color: #ececf1;
        font-size: 2rem;
        font-weight: 700;
        margin-bottom: 0.25rem;
    }
    .subtitle {
        color: #b6b6c2;
        margin-bottom: 1rem;
    }
    </style>
    """,
    unsafe_allow_html=True,
)


def fetch_projects():
    try:
        response = supabase.table("messages").select("project").execute()
        projects = sorted({row["project"] for row in response.data if row.get("project")})
        return projects
    except Exception as e:
        st.sidebar.error(f"Error loading projects: {e}")
        return []


def create_project(project_name):
    try:
        existing = supabase.table("messages") \
            .select("id") \
            .eq("project", project_name) \
            .limit(1) \
            .execute()

        if existing.data:
            return True

        supabase.table("messages").insert([{
            "project": project_name,
            "role": "system",
            "content": "Project created."
        }]).execute()
        return True
    except Exception as e:
        st.sidebar.error(f"Error creating project: {e}")
        return False


def fetch_document_count(project_name):
    try:
        response = supabase.table("messages") \
            .select("id") \
            .eq("project", project_name) \
            .eq("role", "document") \
            .execute()
        return len(response.data or [])
    except Exception:
        return 0

# Function to load chat history from Supabase
def load_chat_history(project_name):
    try:
        response = supabase.table("messages") \
            .select("*") \
            .eq("project", project_name) \
            .order("timestamp") \
            .execute()

        messages = response.data
        if not messages:
            return []

        return [
            {"role": msg["role"], "content": msg["content"]}
            for msg in messages
            if msg.get("role") in ["user", "assistant"]
        ]
    except Exception as e:
        st.error(f"An error occurred while loading chat history: {e}")
        return []

# Function to save chat history to Supabase
def save_chat_history(role, content):
    try:
        if not st.session_state["current_project"]:
            st.error("No project selected.")
            return False

        response = supabase.table("messages").insert([{
            "project": st.session_state["current_project"],
            "role": role,
            "content": content
        }]).execute()

        if response.data:
            return True
        return False
    except Exception as e:
        st.error(f"Error saving chat message: {e}")
        return False

# Function to delete a project from Supabase
def delete_project(project_name):
    try:
        supabase.table("messages") \
            .delete() \
            .eq("project", project_name) \
            .execute()
        return True
    except Exception as e:
        st.error(f"Error deleting project: {e}")
        return False

if "projects" not in st.session_state:
    st.session_state["projects"] = fetch_projects()

if "current_project" not in st.session_state:
    st.session_state["current_project"] = st.session_state["projects"][0] if st.session_state["projects"] else None

if "is_generating" not in st.session_state:
    st.session_state["is_generating"] = False


st.sidebar.title("Projects")

with st.sidebar.form("create_project_form", clear_on_submit=True):
    new_project_name = st.text_input("New project name")
    create_project_clicked = st.form_submit_button("Create Project")

if create_project_clicked:
    if not new_project_name.strip():
        st.sidebar.warning("Please enter a project name.")
    else:
        with st.sidebar:
            with st.spinner("Creating project..."):
                if create_project(new_project_name.strip()):
                    st.session_state["projects"] = fetch_projects()
                    st.session_state["current_project"] = new_project_name.strip()
                    st.sidebar.success(f"Project '{new_project_name.strip()}' is ready.")
                    st.rerun()

if st.session_state["projects"]:
    current_index = 0
    if st.session_state["current_project"] in st.session_state["projects"]:
        current_index = st.session_state["projects"].index(st.session_state["current_project"])

    selected_project = st.sidebar.selectbox(
        "Select a Project",
        st.session_state["projects"],
        index=current_index,
    )
    st.session_state["current_project"] = selected_project

    if st.sidebar.button("Delete Selected Project"):
        with st.sidebar:
            with st.spinner("Deleting project..."):
                if delete_project(selected_project):
                    history_key = f"history_{selected_project}"
                    if history_key in st.session_state:
                        del st.session_state[history_key]
                    st.session_state["projects"] = fetch_projects()
                    st.session_state["current_project"] = st.session_state["projects"][0] if st.session_state["projects"] else None
                    st.rerun()

if st.session_state.get("current_project"):
    st.sidebar.markdown("---")
    st.sidebar.subheader("Upload Document")
    upload_document()
else:
    st.sidebar.markdown("---")
    st.sidebar.info("Create and select a project to enable document upload.")

st.markdown('<div class="main-title">RAG 2.0 Chat</div>', unsafe_allow_html=True)

if st.session_state.get("current_project"):
    st.markdown(
        f'<div class="subtitle">Project: {st.session_state["current_project"]}</div>',
        unsafe_allow_html=True,
    )

    document_count = fetch_document_count(st.session_state["current_project"])
    st.info(
        f"This chatbot is currently representing documents uploaded to project '{st.session_state['current_project']}'. "
        f"Stored document chunks: {document_count}."
    )

    history_key = f"history_{st.session_state['current_project']}"
    if history_key not in st.session_state:
        with st.spinner("Loading previous chat..."):
            st.session_state[history_key] = load_chat_history(st.session_state["current_project"])

    for message in st.session_state[history_key]:
        role = "assistant" if message["role"] == "assistant" else "user"
        with st.chat_message(role):
            st.markdown(message["content"])

    user_input = st.chat_input("Ask something about your uploaded documents...", disabled=st.session_state["is_generating"])

    if user_input:
        st.session_state[history_key].append({"role": "user", "content": user_input})
        save_chat_history("user", user_input)

        st.session_state["is_generating"] = True
        try:
            response_text = ""
            with st.chat_message("assistant"):
                with st.spinner("Thinking..."):
                    relevant_chunks = retrieve_relevant_chunks(user_input, st.session_state["current_project"])

                    if not relevant_chunks:
                        response_text = (
                            "Error: I could not find document context for this project yet. "
                            "Upload a document after creating/selecting the project and try again."
                        )
                    else:
                        response_text = generate_answer(user_input, relevant_chunks)

                    if response_text.startswith("Error:"):
                        st.error(response_text)
                    else:
                        st.markdown(response_text)

            st.session_state[history_key].append({"role": "assistant", "content": response_text})
            save_chat_history("assistant", response_text)
        except Exception as e:
            response_text = f"Error: Unexpected failure while generating response: {e}"
            with st.chat_message("assistant"):
                st.error(response_text)
            st.session_state[history_key].append({"role": "assistant", "content": response_text})
            save_chat_history("assistant", response_text)
        finally:
            st.session_state["is_generating"] = False

        st.rerun()
else:
    st.markdown('<div class="subtitle">Create a project from the sidebar to start chatting.</div>', unsafe_allow_html=True)