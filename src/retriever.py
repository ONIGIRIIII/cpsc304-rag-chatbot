from dataclasses import dataclass

import chromadb
from sentence_transformers import SentenceTransformer

from src.config import CHROMA_DIR, COLLECTION_NAME, EMBEDDING_MODEL, TOP_K


@dataclass
class RetrievedChunk:
    text: str
    source_file: str
    deck_title: str
    page_number: int
    section_header: str
    distance: float


class Retriever:
    def __init__(self):
        self._client = chromadb.PersistentClient(path=str(CHROMA_DIR))
        self._collection = self._client.get_or_create_collection(COLLECTION_NAME)
        self._model = SentenceTransformer(EMBEDDING_MODEL)

    def is_ready(self) -> bool:
        return self._collection.count() > 0

    def query(self, question: str, top_k: int = TOP_K) -> list[RetrievedChunk]:
        query_embedding = self._model.encode([question]).tolist()
        results = self._collection.query(
            query_embeddings=query_embedding,
            n_results=top_k,
        )

        chunks = []
        documents = results.get("documents", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]
        distances = results.get("distances", [[]])[0]

        for doc, meta, dist in zip(documents, metadatas, distances):
            chunks.append(
                RetrievedChunk(
                    text=doc,
                    source_file=meta.get("source_file", ""),
                    deck_title=meta.get("deck_title", ""),
                    page_number=meta.get("page_number", 0),
                    section_header=meta.get("section_header", ""),
                    distance=dist,
                )
            )
        return chunks
