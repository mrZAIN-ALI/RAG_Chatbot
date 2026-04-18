import os
import tempfile
from io import BytesIO

import fitz

from document_processor import (
    chunk_text_by_sentences,
    process_document,
    generate_embeddings,
    save_chunks_to_supabase,
    supabase,
)


def print_header(title):
    print("\n" + "=" * 90)
    print(title)
    print("=" * 90)


def criterion_1_spacy_in_requirements():
    print_header("[1] spacy added to requirements.txt")
    with open("requirements.txt", "r", encoding="utf-8") as f:
        lines = f.readlines()
    matches = [line.strip() for line in lines if line.strip().lower().startswith("spacy==")]
    if matches:
        print(f"PASS: Found dependency line -> {matches[0]}")
    else:
        raise AssertionError("FAIL: spacy dependency line not found")


def criterion_2_and_3_chunk_boundaries_and_overlap():
    print_header("[2][3] sentence-end boundaries and 1-2 sentence overlap")

    text = " ".join([
        f"Sentence {i} has enough words to make chunking behavior easy to validate and deterministic."
        for i in range(1, 121)
    ])

    chunks = chunk_text_by_sentences(text, target_words=60, overlap_ratio=0.12)
    print(f"Generated chunks: {len(chunks)}")
    if len(chunks) < 3:
        raise AssertionError("FAIL: Expected multiple chunks for overlap verification")

    # Boundaries: every chunk must be exact concatenation of complete source sentences.
    import spacy

    nlp = spacy.load("en_core_web_sm")
    source_sentences = [s.text.strip() for s in nlp(text).sents if s.text.strip()]

    for idx, chunk in enumerate(chunks):
        chunk_sents = [s.text.strip() for s in nlp(chunk).sents if s.text.strip()]
        reconstructed = " ".join(chunk_sents)
        if reconstructed != chunk:
            raise AssertionError(f"FAIL: Chunk {idx} is not composed of full sentences")
        for sentence in chunk_sents:
            if sentence not in source_sentences:
                raise AssertionError(f"FAIL: Chunk {idx} contains a non-source sentence fragment")

    print("PASS: All chunk boundaries align to complete sentence boundaries")

    # Overlap: verify consecutive chunks share 1-2 trailing/leading sentences.
    overlap_counts = []
    for i in range(len(chunks) - 1):
        a_sents = [s.text.strip() for s in nlp(chunks[i]).sents if s.text.strip()]
        b_sents = [s.text.strip() for s in nlp(chunks[i + 1]).sents if s.text.strip()]

        shared = 0
        for k in (2, 1):
            if len(a_sents) >= k and len(b_sents) >= k and a_sents[-k:] == b_sents[:k]:
                shared = k
                break
        overlap_counts.append(shared)
        if shared not in (1, 2):
            raise AssertionError(f"FAIL: Chunk {i}->{i+1} overlap count is {shared}, expected 1 or 2")

    print(f"PASS: Overlap counts between consecutive chunks: {overlap_counts}")


def criterion_4_metadata_saved_in_supabase():
    print_header("[4] chunk metadata stored as {filename, chunk_index, total_chunks} in Supabase")

    content = " ".join([
        f"Metadata validation sentence {i} with enough words to form multiple chunks and verify persistence behavior."
        for i in range(1, 181)
    ]).encode("utf-8")

    class FakeUploadedFile:
        def __init__(self, name, data):
            self.name = name
            self._data = data

        def read(self):
            return self._data

    fake_file = FakeUploadedFile("_acceptance_metadata.txt", content)
    payloads = process_document(fake_file, "txt")
    if not payloads:
        raise AssertionError("FAIL: process_document returned no payloads")

    embeddings = generate_embeddings(payloads)
    project_name = "Acceptance_Metadata_Proof"
    ok = save_chunks_to_supabase(payloads, embeddings, project_name)
    if not ok:
        raise AssertionError("FAIL: save_chunks_to_supabase returned False")

    rows = (
        supabase.table("messages")
        .select("id, metadata")
        .eq("project", project_name)
        .eq("role", "document")
        .order("id", desc=True)
        .limit(len(payloads))
        .execute()
        .data
    )
    if not rows:
        raise AssertionError("FAIL: No saved rows found in Supabase")

    rows = list(reversed(rows))
    complete = True
    for idx, row in enumerate(rows):
        md = row.get("metadata") or {}
        good = (
            md.get("filename") == "_acceptance_metadata.txt"
            and isinstance(md.get("chunk_index"), int)
            and isinstance(md.get("total_chunks"), int)
        )
        print(
            f"row_id={row.get('id')} filename={md.get('filename')} chunk_index={md.get('chunk_index')} total_chunks={md.get('total_chunks')}"
        )
        complete = complete and good

    if not complete:
        raise AssertionError("FAIL: One or more rows missing required metadata fields")

    print(f"PASS: Verified metadata fields on {len(rows)} stored rows")


def criterion_5_ten_page_pdf_chunks_per_page():
    print_header("[5] 10-page PDF upload produces >1 chunk/page on average")

    doc = fitz.open()
    sentence = "This PDF sentence is deliberately verbose to create realistic word volume per page for chunk testing. "
    words_per_sentence = len(sentence.split())

    sentences_per_page = 42  # ~500 words/page with this sentence length
    for page_idx in range(10):
        page = doc.new_page()
        text = "".join([f"Page {page_idx + 1}. {sentence}" for _ in range(sentences_per_page)])
        page.insert_textbox(fitz.Rect(36, 36, 559, 806), text, fontsize=10)

    pdf_bytes = doc.tobytes()
    doc.close()

    class PdfUploadedFile:
        def __init__(self, name, data):
            self.name = name
            self._data = data

        def read(self):
            return self._data

    fake_pdf = PdfUploadedFile("_acceptance_10page.pdf", pdf_bytes)
    payloads = process_document(fake_pdf, "pdf")

    if not payloads:
        raise AssertionError("FAIL: PDF processing returned no chunks")

    chunk_count = len(payloads)
    chunks_per_page = chunk_count / 10
    print(f"PDF pages=10 chunk_count={chunk_count} chunks_per_page={chunks_per_page:.2f}")

    if not (chunks_per_page > 1.0):
        raise AssertionError("FAIL: chunks_per_page is not greater than 1.0")

    print("PASS: Chunk density requirement satisfied")


def criterion_6_upload_flow_still_works_in_app():
    print_header("[6] existing upload flow in app.py still works")

    with open("app.py", "r", encoding="utf-8") as f:
        app_code = f.read()

    required_snippets = [
        "from document_processor import upload_document",
        "if st.session_state.get(\"current_project\"):",
        "upload_document()",
    ]

    for snippet in required_snippets:
        if snippet not in app_code:
            raise AssertionError(f"FAIL: Missing upload flow snippet: {snippet}")

    print("PASS: app.py still imports and calls upload_document in project-gated flow")


def criterion_7_docstrings_present():
    print_header("[7] every new/modified function has a docstring")

    import inspect
    import document_processor as dp

    names = [
        "process_document",
        "chunk_text_by_sentences",
        "extract_text_from_pdf",
        "generate_embeddings",
        "save_chunks_to_supabase",
        "upload_document",
        "retrieve_relevant_chunks",
        "generate_answer",
    ]

    for name in names:
        fn = getattr(dp, name)
        doc = inspect.getdoc(fn)
        if not doc:
            raise AssertionError(f"FAIL: Missing docstring on {name}")
        print(f"{name}: {doc.splitlines()[0]}")

    print("PASS: All checked functions have docstrings")


def criterion_8_readme_spacy_instruction():
    print_header("[8] README updated with spaCy download instruction")

    with open("README.md", "r", encoding="utf-8") as f:
        text = f.read()

    needle = "python -m spacy download en_core_web_sm"
    if needle not in text:
        raise AssertionError("FAIL: README does not contain spaCy model download instruction")

    print(f"PASS: Found README instruction -> {needle}")


def main():
    print_header("ACCEPTANCE CHECKLIST PROOF RUN")

    criterion_1_spacy_in_requirements()
    criterion_2_and_3_chunk_boundaries_and_overlap()
    criterion_4_metadata_saved_in_supabase()
    criterion_5_ten_page_pdf_chunks_per_page()
    criterion_6_upload_flow_still_works_in_app()
    criterion_7_docstrings_present()
    criterion_8_readme_spacy_instruction()

    print_header("FINAL RESULT")
    print("ALL ACCEPTANCE CHECKLIST ITEMS PASSED")


if __name__ == "__main__":
    main()
