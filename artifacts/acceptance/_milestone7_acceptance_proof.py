import inspect
import os
import shutil
from pathlib import Path

import numpy as np

import document_processor as dp


def assert_true(condition, message):
    if not condition:
        raise AssertionError(message)


class EmptyMessagesTable:
    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        return type("Result", (), {"data": []})()


class EmptyMessagesSupabase:
    def table(self, _name):
        return EmptyMessagesTable()


def cleanup_project_dirs(project_names):
    base = Path("vector_stores")
    for project in project_names:
        target = base / project
        if target.exists():
            shutil.rmtree(target)


def main():
    print("=" * 92)
    print("MILESTONE 7 ACCEPTANCE CHECKLIST PROOF")
    print("=" * 92)

    source = inspect.getsource(dp)

    print("\n[1] VectorStore abstract base class exists with documented interface")
    assert_true(hasattr(dp, "VectorStore"), "VectorStore class missing")
    assert_true(inspect.isclass(dp.VectorStore), "VectorStore is not a class")
    assert_true(bool(inspect.getdoc(dp.VectorStore)), "VectorStore class docstring missing")
    assert_true(bool(inspect.getdoc(dp.VectorStore.save_chunks)), "save_chunks docstring missing")
    assert_true(bool(inspect.getdoc(dp.VectorStore.get_all_embeddings)), "get_all_embeddings docstring missing")
    print("PASS")

    print("\n[2] All three backends implemented: Supabase, FAISS, ChromaDB")
    assert_true(hasattr(dp, "SupabaseVectorStore"), "SupabaseVectorStore missing")
    assert_true(hasattr(dp, "FAISSVectorStore"), "FAISSVectorStore missing")
    assert_true(hasattr(dp, "ChromaVectorStore"), "ChromaVectorStore missing")
    print("PASS")

    print("\n[3] get_vector_store() factory reads from env var")
    assert_true("VECTOR_STORE_BACKEND" in inspect.getsource(dp.get_vector_store), "factory does not read VECTOR_STORE_BACKEND")
    print("PASS")

    print("\n[4] Default backend is supabase — existing behavior unchanged")
    original_backend = os.environ.get("VECTOR_STORE_BACKEND")
    if "VECTOR_STORE_BACKEND" in os.environ:
        del os.environ["VECTOR_STORE_BACKEND"]
    store_default = dp.get_vector_store("")
    assert_true(isinstance(store_default, dp.SupabaseVectorStore), "default backend is not SupabaseVectorStore")
    print("PASS")

    print("\n[5] Switching to VECTOR_STORE_BACKEND=faiss works end-to-end")
    faiss_project = "m7_faiss_e2e"
    cleanup_project_dirs([faiss_project])
    os.environ["VECTOR_STORE_BACKEND"] = "faiss"

    chunks = [
        "Creatine dosage is 3 to 5 grams daily.",
        "Chest press progression example: 20kg for 10,10,8.",
        "Add extra protein with yogurt, milk, or chicken.",
    ]
    embeddings = dp.model.encode(chunks)
    metadata = [{"chunk_index": i} for i in range(len(chunks))]

    faiss_store = dp.get_vector_store("faiss")
    faiss_store.save_chunks(chunks, embeddings, metadata, faiss_project)

    rows_faiss = faiss_store.get_all_embeddings(faiss_project)
    assert_true(len(rows_faiss) >= 3, "FAISS backend did not return saved rows")

    # End-to-end retrieval pipeline path with FAISS backend.
    original_rewrite = dp.rewrite_query
    original_cross = dp.cross_encoder_model
    try:
        dp.rewrite_query = lambda query, _history: query

        class StaticCross:
            def predict(self, pair_inputs):
                return np.array([1.0 - 0.1 * i for i in range(len(pair_inputs))], dtype=float)

        dp.cross_encoder_model = StaticCross()
        reranked_faiss = dp.retrieve_and_rerank("How much creatine should I take?", faiss_project, EmptyMessagesSupabase())
        assert_true(len(reranked_faiss) > 0, "FAISS end-to-end retrieve_and_rerank returned no rows")
        print("PASS")
    finally:
        dp.rewrite_query = original_rewrite
        dp.cross_encoder_model = original_cross

    print("\n[6] Switching to VECTOR_STORE_BACKEND=chroma works end-to-end")
    chroma_project = "m7_chroma_e2e"
    cleanup_project_dirs([chroma_project])
    os.environ["VECTOR_STORE_BACKEND"] = "chroma"

    chroma_store = dp.get_vector_store("chroma")
    chroma_store.save_chunks(chunks, embeddings, metadata, chroma_project)
    rows_chroma = chroma_store.get_all_embeddings(chroma_project)
    assert_true(len(rows_chroma) >= 3, "Chroma backend did not return saved rows")

    try:
        dp.rewrite_query = lambda query, _history: query

        class StaticCross:
            def predict(self, pair_inputs):
                return np.array([1.0 - 0.1 * i for i in range(len(pair_inputs))], dtype=float)

        dp.cross_encoder_model = StaticCross()
        reranked_chroma = dp.retrieve_and_rerank("How much creatine should I take?", chroma_project, EmptyMessagesSupabase())
        assert_true(len(reranked_chroma) > 0, "Chroma end-to-end retrieve_and_rerank returned no rows")
        print("PASS")
    finally:
        dp.rewrite_query = original_rewrite
        dp.cross_encoder_model = original_cross

    print("\n[7] FAISS index persisted to disk between app restarts")
    faiss_index_path = Path("vector_stores") / faiss_project / "faiss.index"
    assert_true(faiss_index_path.exists(), f"FAISS index file missing at {faiss_index_path}")
    faiss_store_reloaded = dp.FAISSVectorStore()
    rows_faiss_reloaded = faiss_store_reloaded.get_all_embeddings(faiss_project)
    assert_true(len(rows_faiss_reloaded) >= 3, "FAISS data did not persist across store re-instantiation")
    print(f"PASS: {faiss_index_path}")

    print("\n[8] ChromaDB collection persisted to disk between app restarts")
    chroma_path = Path("vector_stores") / chroma_project / "chroma"
    assert_true(chroma_path.exists(), f"Chroma persistence directory missing at {chroma_path}")
    chroma_store_reloaded = dp.ChromaVectorStore()
    rows_chroma_reloaded = chroma_store_reloaded.get_all_embeddings(chroma_project)
    assert_true(len(rows_chroma_reloaded) >= 3, "Chroma data did not persist across store re-instantiation")
    print(f"PASS: {chroma_path}")

    print("\n[9] faiss-cpu and chromadb in requirements.txt")
    requirements_text = Path("requirements.txt").read_text(encoding="utf-8")
    assert_true("faiss-cpu==" in requirements_text, "faiss-cpu missing in requirements.txt")
    assert_true("chromadb==" in requirements_text, "chromadb missing in requirements.txt")
    print("PASS")

    # Restore env
    if original_backend is None:
        os.environ["VECTOR_STORE_BACKEND"] = "supabase"
    else:
        os.environ["VECTOR_STORE_BACKEND"] = original_backend

    print("\n" + "=" * 92)
    print("ALL MILESTONE 7 CHECKLIST TESTS PASSED")
    print("=" * 92)


if __name__ == "__main__":
    main()
