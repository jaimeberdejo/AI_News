"""
Supabase client for the pipeline (service key — bypasses RLS).
Usage: from pipeline.db import get_db
"""
import os
from supabase import create_client, Client
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv(raise_error_if_not_found=True))

_client: Client | None = None


def get_db() -> Client:
    """Return a singleton Supabase client initialized with the service key.

    The service key bypasses RLS entirely — never expose this key in frontend code.
    find_dotenv() traverses parent directories, so this works whether the script
    runs from repo root or from pipeline/.
    """
    global _client
    if _client is None:
        _client = create_client(
            os.environ["SUPABASE_URL"],
            os.environ["SUPABASE_SERVICE_KEY"],
        )
    return _client
