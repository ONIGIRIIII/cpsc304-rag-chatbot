import json

import ollama
from fastapi import FastAPI
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from src.config import OLLAMA_MODEL, PROJECT_ROOT, TOP_K
from src.rag_chain import stream_answer, unique_sources
from src.retriever import Retriever

app = FastAPI()

_retriever: Retriever | None = None


def get_retriever() -> Retriever:
    global _retriever
    if _retriever is None:
        _retriever = Retriever()
    return _retriever


class ChatRequest(BaseModel):
    question: str


@app.get("/api/health")
def health():
    retriever_ok = False
    ollama_ok = False
    error = None

    try:
        retriever_ok = get_retriever().is_ready()
    except Exception as e:
        error = f"retriever: {e}"

    try:
        ollama.list()
        ollama_ok = True
    except Exception as e:
        error = f"{error or ''} ollama: {e}".strip()

    return {
        "retriever_ready": retriever_ok,
        "ollama_ready": ollama_ok,
        "model": OLLAMA_MODEL,
        "error": error,
    }


@app.post("/api/chat")
def chat(req: ChatRequest):
    retriever = get_retriever()
    chunks = retriever.query(req.question, top_k=TOP_K)
    sources = unique_sources(chunks)

    def event_stream():
        for token in stream_answer(req.question, chunks):
            yield json.dumps({"type": "token", "content": token}) + "\n"
        yield json.dumps({"type": "done", "sources": sources}) + "\n"

    return StreamingResponse(event_stream(), media_type="application/x-ndjson")


web_dir = PROJECT_ROOT / "web"
app.mount("/static", StaticFiles(directory=str(web_dir)), name="static")


@app.get("/")
def index():
    return FileResponse(str(web_dir / "index.html"))
