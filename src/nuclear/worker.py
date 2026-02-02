"""Worker - batch jobs / weekly pipeline."""

import asyncio
import structlog

log = structlog.get_logger()


async def run_worker():
    """Worker loop - batch jobs, weekly."""
    log.info("Worker starting")
    while True:
        await asyncio.sleep(60)


if __name__ == "__main__":
    asyncio.run(run_worker())
