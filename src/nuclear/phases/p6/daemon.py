"""
P6 daemon - 24/7 monitoring, rule-based (no AI).
SSOT: P6 runs as separate process/container from batch worker.
Retention: Weekly complete -> unlock -> clear last week general data; retain_flag for exceptions.
"""

import asyncio
from datetime import datetime, timezone

import structlog

log = structlog.get_logger()


import asyncio
import argparse
import sys
from nuclear.phases.p6.runtime import run_p6_daemon

async def main():
    parser = argparse.ArgumentParser(description="P6 Daemon")
    parser.add_argument("--interval", type=int, default=30, help="Tick interval in seconds")
    parser.add_argument("--instance-id", default="p6_local", help="Instance identifier")
    args = parser.parse_args()

    await run_p6_daemon(interval_sec=args.interval, instance_id=args.instance_id)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    sys.exit(0)
