# CPSC 304 RAG Chatbot

A local, free chatbot that answers questions using your CPSC 304 lecture slides.
Everything runs on your machine — no API keys, no per-question charges.

## Stack

- **LLM**: [Ollama](https://ollama.com) running `llama3.1:8b` locally
- **Embeddings**: `sentence-transformers` (`all-MiniLM-L6-v2`), runs on CPU
- **Vector store**: `chromadb`, stored on disk in `data/chroma_db/`
- **Backend + web UI**: FastAPI, served at `http://localhost:8000`

## First-time setup

1. **Install Python 3.12** (if not already installed):
   ```
   winget install Python.Python.3.12
   ```
2. **Install Ollama** (if not already installed):
   ```
   winget install Ollama.Ollama
   ```
   Open a *new* terminal afterward so PATH updates take effect, then verify:
   ```
   ollama --version
   ```
3. **Pull the model** (one-time, ~4.7GB download):
   ```
   ollama pull llama3.1:8b
   ```
   Sanity check that your GPU is being used:
   ```
   ollama run llama3.1:8b "Say hello"
   ```
   The first response may be slow while the model loads; look at the terminal
   output for a mention of your GPU/CUDA to confirm GPU acceleration is active.
   Ollama runs as a background service after install — you don't need to start
   it manually.

   If `llama3.1:8b` ever feels too slow (e.g. on battery), a lighter fallback is:
   ```
   ollama pull llama3.2:3b
   ```
   and set `OLLAMA_MODEL = "llama3.2:3b"` in `src/config.py`.

4. The Python virtual environment and dependencies are created automatically
   the first time you run `run_ingest.ps1` or `run_server.ps1` — no manual
   `pip install` needed.

## Day-to-day usage

1. Drop new lecture slide PDFs into the `Slides\` folder (subfolders are fine).
2. Embed the slides (only new/changed PDFs are processed each time):
   ```
   .\run_ingest.ps1
   ```
3. Start the chatbot server:
   ```
   .\run_server.ps1
   ```
4. Open **http://localhost:8000** in your browser and start asking questions.
   Answers stream in and are followed by a "Sources" line listing which deck
   and slide the answer came from.

To force a full re-embed from scratch (e.g. after changing the chunking logic):
```
.\run_ingest.ps1 --rebuild
```

## Project structure

```
Slides/              your PDF lecture decks
data/                Chroma vector store + ingest manifest (auto-created)
src/                 ingestion, retrieval, RAG, and FastAPI server code
web/                 chat UI (HTML/CSS/JS)
run_ingest.ps1        embed new/changed slides
run_server.ps1        start the local web server
```
