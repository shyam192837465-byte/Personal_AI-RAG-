import os
import re
import datetime
import hashlib
from typing import List, Optional, Dict, Any
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from rag.vector_store import vector_store_manager

def load_file_content(file_path: str, filename: str) -> Tuple_Text_Or_Pages:
    ext = os.path.splitext(filename)[1].lower()
    if ext == ".pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(file_path)
            pages = []
            for i, page in enumerate(reader.pages):
                txt = page.extract_text()
                if txt and txt.strip():
                    pages.append({"page": i + 1, "text": txt.strip()})
            return pages
        except Exception as e:
            raise ValueError(f"Failed to read PDF file '{filename}': {str(e)}")
    else:
        # Text / Markdown / Code loader
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        except Exception as e:
            raise ValueError(f"Failed to read text file '{filename}': {str(e)}")


# Type alias helper
Tuple_Text_Or_Pages = Any


def _split_markdown_with_context(
    raw_text: str,
    filename: str,
    chunk_size: int = 700,
    chunk_overlap: int = 150
) -> List[Dict[str, Any]]:
    """
    Splits markdown content while tracking header breadcrumbs (# Header > ## Subheader)
    and enriching every chunk with its hierarchical context prefix.
    """
    lines = raw_text.split("\n")
    sections = []
    current_headers: List[str] = []
    current_text = []

    for line in lines:
        header_match = re.match(r'^(#{1,6})\s+(.+)$', line.strip())
        if header_match:
            # Save previous section if not empty
            if current_text:
                breadcrumb = " > ".join(current_headers) if current_headers else "General"
                sections.append({
                    "breadcrumb": breadcrumb,
                    "text": "\n".join(current_text)
                })
                current_text = []
            
            level = len(header_match.group(1))
            header_title = header_match.group(2).strip()
            # Adjust header stack
            current_headers = current_headers[:level-1]
            current_headers.append(header_title)
            current_text.append(line)
        else:
            current_text.append(line)

    if current_text:
        breadcrumb = " > ".join(current_headers) if current_headers else "General"
        sections.append({
            "breadcrumb": breadcrumb,
            "text": "\n".join(current_text)
        })

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", "? ", "! ", "; ", " ", ""]
    )

    enriched_chunks = []
    for sec in sections:
        sec_chunks = splitter.split_text(sec["text"])
        for chunk in sec_chunks:
            if not chunk.strip():
                continue
            # Context enrichment: Prepend breadcrumb header if not already present
            header_tag = f"[{filename} | Section: {sec['breadcrumb']}]\n"
            enriched_content = f"{header_tag}{chunk}"
            enriched_chunks.append({
                "content": enriched_content,
                "breadcrumb": sec["breadcrumb"]
            })

    return enriched_chunks


def process_and_index_document(
    file_path: str,
    filename: str,
    chunk_size: int = 700,
    chunk_overlap: int = 150
) -> int:
    """
    Reads a document, applies structure-aware splitting & context enrichment,
    and indexes chunks into the active vector store with rich metadata.
    """
    content = load_file_content(file_path, filename)
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    file_size = os.path.getsize(file_path)
    file_ext = os.path.splitext(filename)[1].lower()
    file_type = file_ext.replace(".", "").upper() or "TXT"

    documents: List[Document] = []

    if file_ext == ".pdf" and isinstance(content, list):
        # PDF page-aware processing
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\n", ". ", "? ", "! ", " ", ""]
        )
        chunk_counter = 0
        for page_data in content:
            page_num = page_data["page"]
            page_chunks = splitter.split_text(page_data["text"])
            for p_chunk in page_chunks:
                if not p_chunk.strip():
                    continue
                enriched_text = f"[{filename} | Page {page_num}]\n{p_chunk}"
                doc = Document(
                    page_content=enriched_text,
                    metadata={
                        "source": filename,
                        "chunk_index": chunk_counter,
                        "page": page_num,
                        "timestamp": timestamp,
                        "file_type": "PDF",
                        "file_size": file_size
                    }
                )
                documents.append(doc)
                chunk_counter += 1

    elif file_ext in [".md", ".markdown"] and isinstance(content, str):
        # Markdown breadcrumb-aware processing
        enriched_chunks = _split_markdown_with_context(
            content, filename, chunk_size=chunk_size, chunk_overlap=chunk_overlap
        )
        for i, item in enumerate(enriched_chunks):
            doc = Document(
                page_content=item["content"],
                metadata={
                    "source": filename,
                    "chunk_index": i,
                    "section": item["breadcrumb"],
                    "timestamp": timestamp,
                    "file_type": "MD",
                    "file_size": file_size
                }
            )
            documents.append(doc)

    else:
        # Standard code, text, json splitting with enriched separators
        raw_text = content if isinstance(content, str) else str(content)
        if not raw_text.strip():
            raise ValueError("Document appears to be empty.")

        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=chunk_overlap,
            separators=["\n\n", "\nclass ", "\ndef ", "\n", ". ", "? ", "! ", " ", ""]
        )
        chunks = splitter.split_text(raw_text)
        for i, chunk in enumerate(chunks):
            enriched_text = f"[{filename}]\n{chunk}"
            doc = Document(
                page_content=enriched_text,
                metadata={
                    "source": filename,
                    "chunk_index": i,
                    "timestamp": timestamp,
                    "file_type": file_type,
                    "file_size": file_size
                }
            )
            documents.append(doc)

    if not documents:
        raise ValueError(f"No valid content extracted from '{filename}'.")

    # Update total_chunks metadata for each document
    for doc in documents:
        doc.metadata["total_chunks"] = len(documents)

    source_metadata = {
        "source": filename,
        "file_type": file_type,
        "file_size": file_size,
        "created_at": timestamp
    }
    return vector_store_manager.add_documents(documents, source_metadata=source_metadata)


def process_raw_text(
    text_content: str,
    source_name: str = "custom_note.txt",
    chunk_size: int = 700,
    chunk_overlap: int = 150
) -> int:
    """Processes raw text string with context tags and adds to the vector store."""
    if not text_content.strip():
        raise ValueError("Text content cannot be empty.")
        
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", "? ", "! ", " ", ""]
    )
    chunks = splitter.split_text(text_content)
    timestamp = datetime.datetime.now(datetime.timezone.utc).isoformat()
    file_size = len(text_content.encode("utf-8"))

    documents = [
        Document(
            page_content=f"[{source_name}]\n{chunk}",
            metadata={
                "source": source_name,
                "chunk_index": i,
                "total_chunks": len(chunks),
                "timestamp": timestamp,
                "file_type": "TEXT",
                "file_size": file_size
            }
        )
        for i, chunk in enumerate(chunks)
    ]
    source_metadata = {
        "source": source_name,
        "file_type": "TEXT",
        "file_size": file_size,
        "created_at": timestamp
    }
    return vector_store_manager.add_documents(documents, source_metadata=source_metadata)
