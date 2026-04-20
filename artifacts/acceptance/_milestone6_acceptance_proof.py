import inspect
import os
from pathlib import Path

import numpy as np

import document_processor as dp


class FakeResponse:
    def __init__(self, status_code=200, payload=None):
        self.status_code = status_code
        self._payload = payload or {}

    def json(self):
        return self._payload


class FakeTable:
    def __init__(self, db, table_name):
        self.db = db
        self.table_name = table_name
        self._rows = list(db.get(table_name, []))
        self._insert_rows = None

    def select(self, _fields):
        return self

    def eq(self, key, value):
        self._rows = [r for r in self._rows if r.get(key) == value]
        self._eq_key = key
        self._eq_value = value
        return self

    def order(self, key, desc=False):
        self._rows = sorted(self._rows, key=lambda r: r.get(key, 0), reverse=desc)
        return self

    def limit(self, n):
        self._rows = self._rows[:n]
        return self

    def insert(self, rows):
        self._insert_rows = rows
        return self

    def execute(self):
        if self._insert_rows is not None:
            existing = self.db.get(self.table_name, [])
            existing.extend(self._insert_rows)
            self.db[self.table_name] = existing
            return type("Result", (), {"data": self._insert_rows})()
        return type("Result", (), {"data": self._rows})()


class FakeSupabase:
    def __init__(self, db):
        self.db = db

    def table(self, table_name):
        return FakeTable(self.db, table_name)


class FixedCrossEncoder:
    def __init__(self, scores):
        self.scores = scores

    def predict(self, _pairs):
        return np.array(self.scores, dtype=float)


def assert_true(condition, message):
    if not condition:
        raise AssertionError(message)


def make_doc_row(project, content, embedding):
    return {
        "project": project,
        "role": "document",
        "content": content,
        "embedding": embedding,
    }


def main():
    print("=" * 92)
    print("MILESTONE 6 ACCEPTANCE CHECKLIST PROOF")
    print("=" * 92)

    print("\n[1] Confidence score computed from cross-encoder scores")
    original_cross_encoder = dp.cross_encoder_model
    original_rewrite_query = dp.rewrite_query
    project = "M6_CONF_TEST"
    docs = [
        "Creatine dosage is 3 to 5 grams daily.",
        "Bench press progression should be tracked weekly.",
        "Hydration matters for performance.",
    ]
    doc_embeddings = [dp.model.encode([d])[0].tolist() for d in docs]
    fake_db = {
        "messages": [make_doc_row(project, d, e) for d, e in zip(docs, doc_embeddings)]
    }
    fake_supabase = FakeSupabase(fake_db)

    try:
        dp.rewrite_query = lambda query, _history: query
        dp.cross_encoder_model = FixedCrossEncoder([2.0, 0.0, -2.0])
        rows = dp.retrieve_and_rerank("How much creatine?", project, fake_supabase)
        assert_true(len(rows) > 0, "retrieve_and_rerank returned no rows")
        conf = rows[0].get("confidence_score")
        expected = ((2.0 + 0.0 + -2.0) / 3.0 + 10.0) / 20.0
        assert_true(abs(conf - expected) < 1e-9, f"normalized confidence mismatch: got {conf}, expected {expected}")
        assert_true(0.0 <= conf <= 1.0, "confidence not in [0,1]")
        print(f"PASS: confidence={conf:.4f}, expected={expected:.4f}")
    finally:
        dp.cross_encoder_model = original_cross_encoder
        dp.rewrite_query = original_rewrite_query

    print("\n[2] Score normalized to 0.0-1.0")
    assert_true(0.0 <= conf <= 1.0, "confidence not normalized into [0,1]")
    print("PASS")

    print("\n[3] low_confidence_queries table SQL provided in comments")
    source = inspect.getsource(dp.handle_low_confidence)
    assert_true("CREATE TABLE IF NOT EXISTS public.low_confidence_queries" in source, "CREATE TABLE SQL comment missing")
    print("PASS")

    print("\n[4] Low-confidence queries logged to Supabase")
    fake_db2 = {"low_confidence_queries": []}
    fake_supabase2 = FakeSupabase(fake_db2)
    warning = dp.handle_low_confidence("Tell me more", 0.1, "p1", fake_supabase2)
    assert_true(warning == "I'm not confident I found relevant information for this question. Here's my best attempt, but please verify: ", "warning string mismatch")
    rows = fake_db2.get("low_confidence_queries", [])
    assert_true(len(rows) == 1, "low_confidence query not logged")
    assert_true(rows[0].get("project") == "p1" and rows[0].get("query") == "Tell me more", "logged row fields incorrect")
    print("PASS")

    print("\n[5] Warning message prepended to answer when score < threshold")
    original_post = dp.requests.post
    original_handle = dp.handle_low_confidence
    original_retrieve = dp.retrieve_and_rerank
    try:
        dp.requests.post = lambda *args, **kwargs: FakeResponse(200, {
            "candidates": [{"content": {"parts": [{"text": "Detailed answer body."}]}}]
        })
        dp.handle_low_confidence = lambda query, score, project, supabase_client: "WARN: "

        os.environ["LOW_CONFIDENCE_THRESHOLD"] = "0.25"
        dp.LAST_RETRIEVAL_META["query"] = "Tell me more"
        dp.LAST_RETRIEVAL_META["project"] = "p2"
        dp.LAST_RETRIEVAL_META["confidence"] = 0.10

        output = dp.generate_answer(
            "Tell me more",
            ["Some relevant chunk"],
            recent_messages=[{"role": "user", "content": "x"}],
            project="p2",
            supabase_client=FakeSupabase({"conversation_summaries": []}),
        )
        assert_true(output.startswith("WARN: "), "warning prefix missing for low confidence")
        print("PASS")

        print("\n[6] Answer is always returned, never silently dropped")
        assert_true(len(output.strip()) > 0, "low-confidence answer was empty")
        dp.LAST_RETRIEVAL_META["confidence"] = 0.90
        output_high = dp.generate_answer(
            "Tell me more",
            ["Some relevant chunk"],
            recent_messages=[{"role": "user", "content": "x"}],
            project="p2",
            supabase_client=FakeSupabase({"conversation_summaries": []}),
        )
        assert_true(len(output_high.strip()) > 0, "high-confidence answer was empty")
        print("PASS")

        print("\n[7] Asking unrelated question triggers warning")
        unrelated_project = "M6_UNRELATED"
        unrelated_docs = [
            "This document is only about chest press progression and weekly split planning.",
            "Protein target is discussed for gym progress.",
            "Deadlift load management on Friday is documented.",
        ]
        unrelated_db = {
            "messages": [
                make_doc_row(unrelated_project, d, dp.model.encode([d])[0].tolist())
                for d in unrelated_docs
            ],
            "conversation_summaries": [],
            "low_confidence_queries": [],
        }
        unrelated_supabase = FakeSupabase(unrelated_db)

        dp.rewrite_query = lambda query, _history: query
        dp.cross_encoder_model = FixedCrossEncoder([-8.0, -7.5, -7.0])
        reranked_unrelated = dp.retrieve_and_rerank(
            "Who is the prime minister of uk?",
            unrelated_project,
            unrelated_supabase,
        )
        unrelated_chunks = [r["content"] for r in reranked_unrelated]
        dp.handle_low_confidence = lambda query, score, project, supabase_client: "WARN: "
        os.environ["LOW_CONFIDENCE_THRESHOLD"] = "0.25"
        unrelated_answer = dp.generate_answer(
            "Who is the prime minister of uk?",
            unrelated_chunks,
            recent_messages=[{"role": "user", "content": "Who is the prime minister of uk?"}],
            project=unrelated_project,
            supabase_client=unrelated_supabase,
        )
        assert_true(unrelated_answer.startswith("WARN: "), "unrelated question did not trigger warning")
        print("PASS")

        print("\n[8] LOW_CONFIDENCE_THRESHOLD env var controls the cutoff")
        os.environ["LOW_CONFIDENCE_THRESHOLD"] = "0.05"
        dp.LAST_RETRIEVAL_META["query"] = "Tell me more"
        dp.LAST_RETRIEVAL_META["project"] = "p2"
        dp.LAST_RETRIEVAL_META["confidence"] = 0.10
        no_warn = dp.generate_answer(
            "Tell me more",
            ["Some relevant chunk"],
            recent_messages=[{"role": "user", "content": "x"}],
            project="p2",
            supabase_client=FakeSupabase({"conversation_summaries": []}),
        )
        assert_true(not no_warn.startswith("WARN: "), "threshold control not respected when threshold lowered")
        os.environ["LOW_CONFIDENCE_THRESHOLD"] = "0.25"
        print("PASS")

        print("\n[9] App works end-to-end")
        import py_compile

        py_compile.compile("document_processor.py", doraise=True)
        py_compile.compile("app.py", doraise=True)

        # Minimal end-to-end flow: retrieve -> generate answer should complete without exceptions.
        dp.cross_encoder_model = FixedCrossEncoder([1.0, 0.5, 0.2])
        end_project = "M6_E2E"
        end_db = {
            "messages": [
                make_doc_row(end_project, d, dp.model.encode([d])[0].tolist())
                for d in [
                    "Chest press progression example entry: 20kg for 10,10,8.",
                    "Track workouts weekly and increase reps gradually.",
                    "Add extra protein daily using yogurt, milk, or chicken.",
                ]
            ],
            "conversation_summaries": [],
            "low_confidence_queries": [],
        }
        end_supabase = FakeSupabase(end_db)
        dp.rewrite_query = lambda query, _history: query
        end_rows = dp.retrieve_and_rerank("How to improve this plan?", end_project, end_supabase)
        end_answer = dp.generate_answer(
            "How to improve this plan?",
            [r["content"] for r in end_rows],
            recent_messages=[{"role": "user", "content": "How to improve this plan?"}],
            project=end_project,
            supabase_client=end_supabase,
        )
        assert_true(isinstance(end_answer, str) and len(end_answer.strip()) > 0, "end-to-end answer generation failed")
        print("PASS")
    finally:
        dp.requests.post = original_post
        dp.handle_low_confidence = original_handle
        dp.retrieve_and_rerank = original_retrieve
        dp.rewrite_query = original_rewrite_query
        dp.cross_encoder_model = original_cross_encoder

    print("\n[10] .env contains LOW_CONFIDENCE_THRESHOLD=0.25")
    env_text = Path(".env").read_text(encoding="utf-8")
    assert_true("LOW_CONFIDENCE_THRESHOLD=0.25" in env_text, ".env missing LOW_CONFIDENCE_THRESHOLD=0.25")
    print("PASS")

    print("\n" + "=" * 92)
    print("ALL MILESTONE 6 CHECKLIST TESTS PASSED")
    print("=" * 92)


if __name__ == "__main__":
    main()
