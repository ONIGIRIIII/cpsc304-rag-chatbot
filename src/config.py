from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent

SLIDES_DIR = PROJECT_ROOT / "Slides"
DATA_DIR = PROJECT_ROOT / "data"
CHROMA_DIR = DATA_DIR / "chroma_db"
MANIFEST_PATH = DATA_DIR / "ingest_manifest.json"

COLLECTION_NAME = "cpsc304_slides"

EMBEDDING_MODEL = "all-MiniLM-L6-v2"

OLLAMA_MODEL = "llama3.1:8b"

MIN_CHUNK_CHARS = 30
MAX_CHUNK_CHARS = 1200
CHUNK_OVERLAP_CHARS = 150

TOP_K = 5
