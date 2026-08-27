from collections.abc import Iterator

import ollama

from src.config import OLLAMA_MODEL
from src.retriever import RetrievedChunk

SYSTEM_PROMPT = (
    "You are a study assistant for CPSC 304 (Databases). Answer the "
    "student's question using ONLY the provided lecture slide excerpts below. "
    "If the answer isn't contained in the excerpts, say plainly that the "
    "slides don't cover it rather than guessing. Be clear and concise, "
    "the way you would explain it to a student studying for an exam."
)


def _build_prompt(question: str, chunks: list[RetrievedChunk]) -> str:
    context_blocks = "\n\n".join(c.text for c in chunks)
    return (
        f"Context from lecture slides:\n\n{context_blocks}\n\n"
        f"Question: {question}"
    )


def unique_sources(chunks: list[RetrievedChunk]) -> list[dict]:
    seen = set()
    sources = []
    for c in chunks:
        key = (c.deck_title, c.page_number)
        if key in seen:
            continue
        seen.add(key)
        sources.append({"deck": c.deck_title, "page": c.page_number})
    sources.sort(key=lambda s: (s["deck"], s["page"]))
    return sources


def stream_answer(question: str, chunks: list[RetrievedChunk]) -> Iterator[str]:
    if not chunks:
        yield "The slides don't seem to cover this topic."
        return

    prompt = _build_prompt(question, chunks)
    stream = ollama.chat(
        model=OLLAMA_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        stream=True,
    )
    for part in stream:
        token = part.get("message", {}).get("content", "")
        if token:
            yield token
