.PHONY: up down logs test lint migrate seed

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

test:
	poetry run pytest -v

lint:
	poetry run ruff check src tests
	poetry run ruff format --check src tests

migrate:
	poetry run alembic upgrade head

seed:
	@echo "Seed placeholder - add seed data if needed"
