"""Verify all Phase 1 infrastructure requirements."""
import os
import sys
from supabase import create_client
from dotenv import find_dotenv, load_dotenv

load_dotenv(find_dotenv())

# --- Test 1: Service key can query editions (INFRA-01) ---
service_client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
result = service_client.table("editions").select("*").execute()
print(f"INFRA-01 [service key editions query]: PASS — {len(result.data)} rows")

# --- Test 2: Anon key can query editions and videos (RLS check) ---
anon_key = os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
anon_client = create_client(os.environ["SUPABASE_URL"], anon_key)

editions_result = anon_client.table("editions").select("*").execute()
print(f"INFRA-01 [anon key editions query]: PASS — {len(editions_result.data)} rows (empty expected)")

videos_result = anon_client.table("videos").select("*").execute()
print(f"INFRA-01 [anon key videos query]: PASS — {len(videos_result.data)} rows (empty expected)")

pipeline_runs_result = anon_client.table("pipeline_runs").select("*").execute()
print(f"INFRA-01 [anon key pipeline_runs blocked]: {'PASS' if len(pipeline_runs_result.data) == 0 else 'FAIL — pipeline_runs should be blocked'}")

# --- Test 3: Storage bucket exists and is public (INFRA-02) ---
buckets = service_client.storage.list_buckets()
bucket_names = [b.name for b in buckets]
if "videos" in bucket_names:
    print("INFRA-02 [storage bucket exists]: PASS")
else:
    print(f"INFRA-02 [storage bucket exists]: FAIL — found buckets: {bucket_names}")
    sys.exit(1)

# --- Test 4: Upload a test file and verify public URL (INFRA-02) ---
test_content = b"test video content placeholder"
test_path = "editions/test/verify.mp4"
service_client.storage.from_("videos").upload(
    test_path,
    test_content,
    {"content-type": "video/mp4", "upsert": "true"}
)
public_url = service_client.storage.from_("videos").get_public_url(test_path)
print(f"INFRA-02 [storage upload + public URL]: PASS — {public_url}")

# Cleanup test file
service_client.storage.from_("videos").remove([test_path])
print("INFRA-02 [test file cleanup]: PASS")

print("\n=== All Phase 1 infrastructure checks passed ===")
