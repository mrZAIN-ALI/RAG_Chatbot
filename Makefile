.PHONY: test-unit test-widget test-frontend test-e2e test-widget-e2e test-stack test-all start-api start-web

PYTHON ?= python

test-unit:
	$(PYTHON) -m pytest tests/test_api.py -v

test-widget:
	cd widget && npm test

test-frontend:
	cd docmind-web && npx vitest run

test-e2e:
	$(PYTHON) -m pytest tests/test_integration.py -v

test-widget-e2e:
	npx playwright test tests/test_widget_integration.js

test-stack:
	$(PYTHON) tests/run_full_stack_tests.py

test-all: test-unit test-widget test-frontend test-stack

start-api:
	$(PYTHON) -m uvicorn api.main:app --reload

start-web:
	cd docmind-web && npm run dev
