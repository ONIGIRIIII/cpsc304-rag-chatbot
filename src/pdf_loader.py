import re
from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader


@dataclass
class PageText:
    source_file: str
    deck_title: str
    page_number: int
    text: str


def _derive_deck_title(pdf_path: Path) -> str:
    name = pdf_path.stem
    name = re.sub(r"^\d+[_\-\s]*", "", name)
    name = name.replace("_", " ").replace("-", " ")
    name = re.sub(r"\s+", " ", name).strip()
    return name or pdf_path.stem


def load_pdf_pages(pdf_path: Path) -> list[PageText]:
    reader = PdfReader(str(pdf_path))
    deck_title = _derive_deck_title(pdf_path)
    pages = []
    for i, page in enumerate(reader.pages, start=1):
        raw_text = page.extract_text() or ""
        text = re.sub(r"[ \t]+", " ", raw_text)
        text = re.sub(r"\n{3,}", "\n\n", text).strip()
        pages.append(
            PageText(
                source_file=pdf_path.name,
                deck_title=deck_title,
                page_number=i,
                text=text,
            )
        )
    return pages


def iter_slide_pdfs(slides_dir: Path):
    yield from sorted(slides_dir.rglob("*.pdf"))
