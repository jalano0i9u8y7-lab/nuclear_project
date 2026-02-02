"""FastAPI application."""

from contextlib import asynccontextmanager

from fastapi import FastAPI

from nuclear import __version__


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # shutdown cleanup if needed


app = FastAPI(
    title="Nuclear Project API",
    version=__version__,
    lifespan=lifespan,
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/version")
async def version():
    return {"version": __version__}


# Jobs trigger - skeleton
@app.post("/jobs/{job_type}")
async def trigger_job(job_type: str):
    return {"job_type": job_type, "status": "queued"}


# Alerts test - skeleton
@app.get("/alerts/test")
async def alerts_test():
    return {"alerts": []}
