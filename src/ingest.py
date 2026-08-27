import argparse
import hashlib
import json
import shutil

import chromadb
from sentence_transformers import SentenceTransformer

from src.chunking import build_chunks
from src.config import (
    CHROMA_DIR,
    COLLECTION_NAME,
    DATA_DIR,
    EMBEDDING_MODEL,
    MANIFEST_PATH,
    SLIDES_DIR,
)
from src.pdf_loader import iter_slide_pdfs, load_pdf_pages


def _file_hash(path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def _load_manifest() -> dict:
    if MANIFEST_PATH.exists():
        return json.loads(MANIFEST_PATH.read_text())
    return {}


def _save_manifest(manifest: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="Wipe the vector store and manifest, then re-embed everything from scratch.",
    )
    args = parser.parse_args()

    if args.rebuild and CHROMA_DIR.exists():
        shutil.rmtree(CHROMA_DIR)
    if args.rebuild and MANIFEST_PATH.exists():
        MANIFEST_PATH.unlink()

    if not SLIDES_DIR.exists():
        print(f"Slides folder not found: {SLIDES_DIR}")
        return

    manifest = _load_manifest()
    client = chromadb.PersistentClient(path=str(CHROMA_DIR))
    collection = client.get_or_create_collection(COLLECTION_NAME)
    model = SentenceTransformer(EMBEDDING_MODEL)

    pdfs = list(iter_slide_pdfs(SLIDES_DIR))
    if not pdfs:
        print(f"No PDFs found in {SLIDES_DIR}")
        return

    decks_processed = 0
    chunks_added = 0

    for pdf_path in pdfs:
        file_hash = _file_hash(pdf_path)
        key = str(pdf_path.relative_to(SLIDES_DIR))

        if manifest.get(key) == file_hash:
            continue

        pages = load_pdf_pages(pdf_path)
        chunks = build_chunks(pages)

        if not chunks:
            manifest[key] = file_hash
            decks_processed += 1
            continue

        texts = [c.text for c in chunks]
        embeddings = model.encode(texts, show_progress_bar=False).tolist()
        ids = [c.chunk_id for c in chunks]
        metadatas = [
            {
                "source_file": c.source_file,
                "deck_title": c.deck_title,
                "page_number": c.page_number,
                "section_header": c.section_header or "",
            }
            for c in chunks
        ]

        collection.upsert(
            ids=ids, embeddings=embeddings, documents=texts, metadatas=metadatas
        )

        manifest[key] = file_hash
        decks_processed += 1
        chunks_added += len(chunks)
        print(f"  {pdf_path.name}: {len(chunks)} chunks")

    _save_manifest(manifest)

    total_chunks = collection.count()
    print(
        f"\nDone. {decks_processed} deck(s) processed this run, "
        f"{chunks_added} chunk(s) added. Collection now has {total_chunks} total chunks."
    )


if __name__ == "__main__":
    main()
