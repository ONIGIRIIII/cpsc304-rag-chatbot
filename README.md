# CPSC 304 RAG Chatbot

A little study assistant that actually knows what's in my CPSC 304 lecture slides.
Ask it something and it digs through the decks and answers based on what's
actually there, instead of me scrolling through 500 slides at 1am before a quiz.

Everything runs locally on my own machine, so there's no OpenAI/Claude API key
and no bill at the end of the month.

## How it works

- Ollama runs a small model (`llama3.1:8b`) locally to write the actual answers
- Slides get split into per-slide chunks and turned into embeddings with `sentence-transformers`
- Those embeddings sit in a local Chroma database on disk
- FastAPI serves the chat page and the API from one process at `localhost:8000`

Nothing here calls out to the internet except the one-time Ollama model
download. Your slides never leave your computer.

## Setting it up (first time only)

Need Python and Ollama if you don't already have them:

```
winget install Python.Python.3.12
winget install Ollama.Ollama
```

Open a fresh terminal after that (PATH won't update in the one you're in), then
grab the model:

```
ollama pull llama3.1:8b
```

That's about a 4.7GB download. Once it's done, try:

```
ollama run llama3.1:8b "Say hello"
```

and check the output mentions your GPU/CUDA somewhere — that's how you know
it's not silently falling back to slow CPU inference. Ollama just runs quietly
in the background after this, no need to start it manually each time.

Running low on patience or on battery? `llama3.2:3b` is a smaller, faster
model that trades off some quality:

```
ollama pull llama3.2:3b
```

then change `OLLAMA_MODEL` in `src/config.py` to match.

You don't need to touch Python venvs or pip yourself — `run_ingest.ps1` and
`run_server.ps1` both set that up the first time you run them.

## Using it

1. Drop PDF slide decks into `Slides\` (subfolders are fine)
2. Run `.\run_ingest.ps1` — only new or changed PDFs get embedded, so this is
   fast after the first run
3. Run `.\run_server.ps1`
4. Open `http://localhost:8000` and start asking questions

Each answer streams in and lists which deck/slide it pulled from underneath.

If you ever change the chunking logic and want to start the vector store
over from scratch:

```
.\run_ingest.ps1 --rebuild
```

## Layout

```
Slides/           your PDF lecture decks
data/              vector store + ingest cache (created automatically)
src/               ingestion, retrieval, and the FastAPI server
web/               the chat page itself
run_ingest.ps1     re-embed new/changed slides
run_server.ps1     start the server
```
