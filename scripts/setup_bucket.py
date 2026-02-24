"""Create the videos storage bucket in Supabase."""
import os
from supabase import create_client
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())

client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])

try:
    result = client.storage.create_bucket(
        "videos",
        options={
            "public": True,
            "file_size_limit": 15728640,  # 15 MB
            "allowed_mime_types": ["video/mp4"]
        }
    )
    print("Bucket created:", result)
except Exception as e:
    if "already exists" in str(e).lower() or "duplicate" in str(e).lower():
        print("Bucket already exists — OK")
    else:
        raise
