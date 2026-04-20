"""
Shared FastAPI dependencies: Supabase client initialization,
environment variable loading, and dependency injection.
"""

import os
from typing import Optional
from functools import lru_cache

from dotenv import load_dotenv
from supabase import create_client, Client


# Load environment variables from .env file
load_dotenv()


@lru_cache(maxsize=1)
def get_supabase_client() -> Client:
    """
    Initialize and return a cached Supabase client.
    Reads SUPABASE_URL and SUPABASE_API_KEY from environment.
    
    Returns:
        Client: Supabase client instance (cached, singleton pattern)
        
    Raises:
        ValueError: If SUPABASE_URL or SUPABASE_API_KEY not set
    """
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_API_KEY")
    
    if not supabase_url or not supabase_key:
        raise ValueError(
            "Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_API_KEY in .env"
        )
    
    return create_client(supabase_url, supabase_key)


def get_env(key: str, default: Optional[str] = None) -> str:
    """
    Safely retrieve environment variables.
    
    Args:
        key: Environment variable name
        default: Default value if key not found
        
    Returns:
        str: Environment variable value or default
        
    Raises:
        ValueError: If key not found and no default provided
    """
    value = os.getenv(key, default)
    if value is None:
        raise ValueError(f"Environment variable '{key}' not set and no default provided")
    return value


@lru_cache(maxsize=1)
def get_active_llm_config() -> dict:
    """
    Get the currently active LLM provider and model configuration.
    
    Returns:
        dict: {"provider": str, "model": str}
    """
    provider = os.getenv("LLM_PROVIDER", "gemini")
    
    # Map provider to its model env var
    model_env_key = f"{provider.upper()}_MODEL"
    model_defaults = {
        "gemini": "gemini-2.5-flash",
        "openai": "gpt-3.5-turbo",
        "groq": "llama3-8b-8192",
    }
    
    model = os.getenv(model_env_key, model_defaults.get(provider, "gemini-2.5-flash"))
    
    return {"provider": provider, "model": model}


@lru_cache(maxsize=1)
def get_retrieval_config() -> dict:
    """
    Get RAG pipeline configuration from environment.
    
    Returns:
        dict: Retrieval parameters {top_k, rerank_top_n, summary_threshold, low_confidence_threshold}
    """
    return {
        "top_k": int(os.getenv("RETRIEVAL_TOP_K", "20")),
        "rerank_top_n": int(os.getenv("RERANK_TOP_N", "5")),
        "summary_threshold": int(os.getenv("SUMMARY_THRESHOLD", "10")),
        "low_confidence_threshold": float(os.getenv("LOW_CONFIDENCE_THRESHOLD", "0.25")),
    }
