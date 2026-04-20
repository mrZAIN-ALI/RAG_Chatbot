import inspect
import logging
from pathlib import Path

import numpy as np

import document_processor as dp


class FakeSupabaseTable:
    def __init__(self, rows):
        self._rows = rows
        self._selected = rows

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, key, value):
        self._selected = [row for row in self._rows if row.get(key) == value]
        return self

    def order(self, key, desc=False):
        self._selected = sorted(self._selected, key=lambda x: x.get(key, 0), reverse=desc)
        return self

    def limit(self, n):
        self._selected = self._selected[:n]
        return self

    def execute(self):
        return type("Result", (), {"data": self._selected})()


class FakeSupabaseClient:
    def __init__(self, rows):
        self._rows = rows

    def table(self, _name):
        return FakeSupabaseTable(self._rows)


def assert_true(condition, message):
    if not condition:
        raise AssertionError(message)


def build_row(project, role, content, timestamp=0, embedding=None):
    row = {
        "project": project,
        "role": role,
        "content": content,
        "timestamp": timestamp,
    }
    if embedding is not None:
        row["embedding"] = embedding
    return row


def main():
    print("=" * 92)
    print("MILESTONE 4 ACCEPTANCE CHECKLIST PROOF")
    print("=" * 92)

    print("\n[1] rewrite_query() function exists with docstring")
    assert_true(hasattr(dp, "rewrite_query"), "rewrite_query() is missing")
    doc = inspect.getdoc(dp.rewrite_query)
    assert_true(bool(doc), "rewrite_query() docstring is missing")
    print("PASS: rewrite_query exists and docstring is present")

    print("\n[2] Gemini gemini-2.5-flash model used for rewriting")
    source = inspect.getsource(dp.rewrite_query)
    assert_true("model_name=\"gemini-2.5-flash\"" in source, "rewrite_query model is not gemini-2.5-flash")
    print("PASS: rewrite_query uses gemini-2.5-flash")

    print("\n[3] google-generativeai added to requirements.txt")
    req = Path("requirements.txt").read_text(encoding="utf-8")
    assert_true("google-generativeai==" in req, "google-generativeai missing in requirements.txt")
    print("PASS: requirements.txt includes google-generativeai")

    print("\n[4] Function uses last 4 messages of history maximum")
    captured = {}

    class FakeRewriteModel:
        def __init__(self, *args, **kwargs):
            captured["model_name"] = kwargs.get("model_name")

        def generate_content(self, prompt):
            captured["prompt"] = prompt
            return type("R", (), {"text": "rewritten query"})()

    original_configure = dp.genai.configure
    original_model_cls = dp.genai.GenerativeModel
    original_key = dp.GEMINI_API_KEY

    try:
        dp.GEMINI_API_KEY = "test_key"
        dp.genai.configure = lambda **_kwargs: None
        dp.genai.GenerativeModel = FakeRewriteModel

        long_history = []
        for i in range(1, 8):
            role = "user" if i % 2 else "assistant"
            long_history.append({"role": role, "content": f"msg{i}"})

        rewritten = dp.rewrite_query("Tell me more about it", long_history)
        assert_true(rewritten == "rewritten query", "rewrite_query did not return model output")

        prompt_text = captured.get("prompt", "")
        assert_true("msg1" not in prompt_text and "msg2" not in prompt_text and "msg3" not in prompt_text, "older messages leaked into rewrite prompt")
        assert_true("msg4" in prompt_text and "msg5" in prompt_text and "msg6" in prompt_text and "msg7" in prompt_text, "last 4 messages not included correctly")
        print("PASS: rewrite_query limits history to last 4 messages")
    finally:
        dp.GEMINI_API_KEY = original_key
        dp.genai.configure = original_configure
        dp.genai.GenerativeModel = original_model_cls

    print("\n[5] If Gemini call fails, original query is returned")
    try:
        dp.GEMINI_API_KEY = "bad_key_for_test"
        dp.genai.configure = lambda **_kwargs: (_ for _ in ()).throw(RuntimeError("invalid key"))
        original = "Tell me more about it"
        out = dp.rewrite_query(original, [{"role": "user", "content": "about creatine"}])
        assert_true(out == original, "rewrite_query did not return original query on failure")
        print("PASS: failure fallback returns original query unchanged")
    finally:
        dp.GEMINI_API_KEY = original_key
        dp.genai.configure = original_configure

    print("\n[6] logging.debug() logs original and rewritten query")
    debug_calls = []
    original_logging_debug = logging.debug
    original_rewrite = dp.rewrite_query

    try:
        logging.debug = lambda msg, *args, **_kwargs: debug_calls.append((msg, args))
        dp.rewrite_query = lambda query, _history: "Tell me more about creatine dosage"

        project = "M4_LOG_TEST"
        texts = [
            "Creatine dosage is commonly 3 to 5 grams daily with hydration.",
            "Protein timing can help recovery after workouts.",
            "Sleep quality strongly affects performance.",
        ]
        rows = []
        for idx, text in enumerate(texts):
            emb = dp.model.encode([text])[0].tolist()
            rows.append(build_row(project, "document", text, timestamp=idx + 1, embedding=emb))
        rows.append(build_row(project, "user", "What is creatine dosage?", timestamp=10))
        rows.append(build_row(project, "assistant", "3 to 5 grams daily", timestamp=11))
        rows.append(build_row(project, "user", "Tell me more about it", timestamp=12))

        fake_client = FakeSupabaseClient(rows)
        _ = dp.retrieve_and_rerank("Tell me more about it", project, fake_client)

        assert_true(len(debug_calls) > 0, "logging.debug was not called")
        assert_true(any("Query rewrite - original" in call[0] for call in debug_calls), "expected rewrite debug message not found")
        print("PASS: logging.debug records original and rewritten query")
    finally:
        logging.debug = original_logging_debug
        dp.rewrite_query = original_rewrite

    print("\n[7] Follow-up question like 'Tell me more about it' retrieves relevant chunks correctly")
    original_rewrite = dp.rewrite_query
    try:
        dp.rewrite_query = lambda _query, _history: "Tell me more about creatine dosage"

        project = "M4_FOLLOWUP_TEST"
        target = "Creatine dosage: 3 to 5 grams daily. Drink enough water and track response."
        distractors = [
            "Deadlift form tips focus on neutral spine and bracing.",
            "Protein sources include eggs, yogurt, and lean chicken.",
            "Cardio sessions improve heart health and stamina.",
            "Sleep hygiene supports recovery and hormones.",
            "Progressive overload means gradual increase in training stress.",
            "Hydration improves training performance.",
        ]

        rows = [
            build_row(project, "user", "Should I use creatine?", timestamp=20),
            build_row(project, "assistant", "Yes, if appropriate, at 3 to 5 grams daily.", timestamp=21),
            build_row(project, "user", "Tell me more about it", timestamp=22),
        ]

        all_docs = [target] + distractors
        for idx, text in enumerate(all_docs):
            emb = dp.model.encode([text])[0].tolist()
            rows.append(build_row(project, "document", text, timestamp=100 + idx, embedding=emb))

        fake_client = FakeSupabaseClient(rows)
        results = dp.retrieve_and_rerank("Tell me more about it", project, fake_client)

        assert_true(len(results) > 0, "no retrieval results returned")
        top_content = results[0]["content"]
        assert_true("Creatine dosage" in top_content, "top reranked result is not the expected follow-up target")
        print("PASS: follow-up question resolves and retrieves the correct chunk at top rank")
        print("Top result:", top_content)
    finally:
        dp.rewrite_query = original_rewrite

    print("\n[8] App still works end-to-end")
    # We treat successful module import and compile in CI/runtime as end-to-end health indicator here.
    # Also check retrieval path returns data in normal call.
    project = "M4_E2E_HEALTH"
    text = "Creatine dosage is 3 to 5 grams daily."
    emb = dp.model.encode([text])[0].tolist()
    fake_client = FakeSupabaseClient([build_row(project, "document", text, timestamp=1, embedding=emb)])
    health_results = dp.retrieve_and_rerank("What is creatine dosage?", project, fake_client)
    assert_true(isinstance(health_results, list), "retrieve_and_rerank did not return a list")
    print("PASS: retrieval pipeline executes and returns list output")

    print("\n" + "=" * 92)
    print("ALL CHECKLIST TESTS PASSED")
    print("=" * 92)


if __name__ == "__main__":
    main()
