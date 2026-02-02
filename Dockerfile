# OCI ARM production-ready
FROM python:3.11-slim

WORKDIR /app

# ARM support
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Poetry
RUN pip install poetry
COPY pyproject.toml poetry.lock* ./
RUN poetry config virtualenvs.create false && poetry install --no-dev --no-interaction

COPY src/ src/
COPY alembic/ alembic/
COPY alembic.ini ./

ENV PYTHONPATH=/app/src
EXPOSE 8000

CMD ["uvicorn", "nuclear.main:app", "--host", "0.0.0.0", "--port", "8000"]
