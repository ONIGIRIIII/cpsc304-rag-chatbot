from dataclasses import dataclass

from src.config import CHUNK_OVERLAP_CHARS, MAX_CHUNK_CHARS, MIN_CHUNK_CHARS
from src.pdf_loader import PageText


@dataclass
class Chunk:
    chunk_id: str
    text: str
    source_file: str
    deck_title: str
    page_number: int
    section_header: str | None


def _looks_like_header(text: str) -> bool:
    return len(text) < MIN_CHUNK_CHARS


def _split_overflow(text: str, max_chars: int, overlap: int) -> list[str]:
    if len(text) <= max_chars:
        return [text]
    parts = []
    start = 0
    while start < len(text):
        end = min(start + max_chars, len(text))
        parts.append(text[start:end])
        if end == len(text):
            break
        start = end - overlap
    return parts


def build_chunks(pages: list[PageText]) -> list[Chunk]:
    chunks: list[Chunk] = []
    current_section_header: str | None = None

    for page in pages:
        text = page.text
        if not text:
            continue

        if _looks_like_header(text):
            current_section_header = text.replace("\n", " ").strip()
            continue

        prefix = f"[Deck: {page.deck_title}"
        if current_section_header:
            prefix += f" | Section: {current_section_header}"
        prefix += f" | Slide {page.page_number}]\n"

        sub_texts = _split_overflow(text, MAX_CHUNK_CHARS, CHUNK_OVERLAP_CHARS)
        for i, sub_text in enumerate(sub_texts):
            chunk_id = f"{page.source_file}::p{page.page_number}::{i}"
            chunks.append(
                Chunk(
                    chunk_id=chunk_id,
                    text=prefix + sub_text,
                    source_file=page.source_file,
                    deck_title=page.deck_title,
                    page_number=page.page_number,
                    section_header=current_section_header,
                )
            )

    return chunks
