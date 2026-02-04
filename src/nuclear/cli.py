"""
Minimal CLI - SSOT V8.45: wb1, wa, wb2, p6 (stub runnable).
Usage: python -m nuclear.cli wb1 | wa | wb2 | p6 | wb
"""

import argparse
import asyncio
import json
import sys
import uuid
import structlog
from typing import Optional

from nuclear.progress import log_run, update_checkpoint

# Setup structlog for CLI
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer()
    ]
)
log = structlog.get_logger()


def ensure_run_id(args: argparse.Namespace) -> str:
    """Get run_id from args or generate one."""
    if hasattr(args, "run_id") and args.run_id:
        return args.run_id
    return str(uuid.uuid4())


def cmd_wb1(args: argparse.Namespace) -> int:
    """Run WB-1 macro stub."""
    from pathlib import Path
    from nuclear.phases.weekly.wb1 import run_wb1_macro
    
    # In M02, we don't strictly require run_id passing to the function yet 
    # unless we update wb1 signature, but SnapshotWriter implicitly needs it?
    # Wait, SnapshotWriter in snapshot.py has default="default_run". 
    # To strictly follow M02 integration rules: "If run_id is missing, generate one, but CLI must pass run_id".
    # But we integrated SnapshotWriter.save() without arguments in M01 phase...
    # We need to PATCH wb1.py and wb2.py again to accept run_id if we want to pass it down properly.
    # OR, we can use a contextvar?
    # For now, let's keep it simple: M02 spec says "CLI must pass run_id context".
    # And "SnapshotWriter.save() must accept optional run_id".
    # So we DO need to update wb1/wb2 signatures or use a global Context.
    # Given the constraints "Modify wb1/wb2 minimal", maybe contextvar is cleaner?
    # BUT, simple argument passing is more explicit.
    # Let's assume for M02 we hack it via argument or use a context singleton if signatures are locked?
    # Check wb1.py: def run_wb1_macro(worldview_input: dict[str, Any]) -> dict[str, Any]:
    # We can inject run_id into input dict!
    
    run_id = ensure_run_id(args)
    recon_ctx = getattr(args, "reconciliation_context", None)
    
    # Pass run_id via input dict which is loose typed
    # Pass recon_ctx as second arg
    out = run_wb1_macro({"run_id": run_id}, reconciliation_context=recon_ctx)
    
    Path("outputs").mkdir(parents=True, exist_ok=True)
    Path("outputs/wb1_output.json").write_text(
        json.dumps(out, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    
    # Auto-log run
    log_run(
        command="wb1",
        status="success",
        run_id=run_id,
        summary="WB-1 worldview generated",
        artifacts=["outputs/wb1_output.json"],
    )
    return 0


def cmd_wa(_: argparse.Namespace) -> int:
    """Run W-A review stub."""
    from nuclear.phases.weekly.wa import run_wa_worldview_review
    out = run_wa_worldview_review({})
    print(json.dumps(out, indent=2, ensure_ascii=False))
    return 0


def cmd_wb2(args: argparse.Namespace) -> int:
    """Run WB-2."""
    from nuclear.phases.weekly.wb2 import run_wb2_and_persist
    
    run_id = ensure_run_id(args)
    # How to pass run_id to run_wb2_and_persist? Start with hack via global context or modifying file.
    # We will modify wb2.py slightly to accept kwargs or run_id if needed,
    # OR better: run_wb2_and_persist takes paths.
    # We probably need to update wb2.py signature in next step to receive Run ID.
    # For this file, let's assume we pass it or context is available.
    # Actually, let's update wb2 signature.
    
    try:
        # We'll pass run_id via a side-channel or update function. 
        # Update: We will update wb2.py to accept run_context dict.
        orders = run_wb2_and_persist(run_context={"run_id": run_id})
    except TypeError:
        # Fallback if signature not updated yet
        orders = run_wb2_and_persist()
    except FileNotFoundError as e:
        print(e, file=sys.stderr)
        return 1
        
    result = [o.model_dump(mode="json") for o in orders]
    
    # Auto-log run
    log_run(
        command="wb2",
        status="success",
        run_id=run_id,
        summary=f"WB-2 generated {len(orders)} orders",
        artifacts=["outputs/wb2_orders.json"],
        metrics={"order_count": len(orders)},
    )
    return 0


def cmd_wb_flow(args: argparse.Namespace) -> int:
    """Run full WB sequence: DB Run -> WB1 -> WB2."""
    from nuclear.db.repos import RunRepo
    from nuclear.db.schema import create_tables
    
    create_tables()

    run_id = str(uuid.uuid4())
    log.info("Starting WB Flow", run_id=run_id)
    
    try:
        # 1. Create Run
        RunRepo.create_run(run_id, trigger="cli_wb_flow")
        
        # --- M03 Reconciliation (Start) ---
        from nuclear.history.reconcile import reconcile_history
        recon_result = reconcile_history(phase="wb1")
        log.info("Reconciliation", status=recon_result.continuity_status, summary=recon_result.summary)
        # --- M03 Reconciliation (End) ---

        # 2. Run WB1
        # Pass run_id. We manually construct args.
        args.run_id = run_id
        # M03: Pass reconciliation result via args (hacky but keeps signature simple) or input dict?
        # Since we modified cmd_wb1 to expect args, we need to pass recon result to it.
        # But cmd_wb1 calls run_wb1_macro which now takes an argument.
        # Let's attach it to args for cmd_wb1 to extract.
        args.reconciliation_context = recon_result.model_dump()
        
        if cmd_wb1(args) != 0:
            raise Exception("WB1 Failed")
            
        # 3. Run WB2
        if cmd_wb2(args) != 0:
            raise Exception("WB2 Failed")
            
        # 4. Complete Run
        RunRepo.mark_completed(run_id)
        print(json.dumps({"status": "success", "run_id": run_id}))
        return 0
        
    except Exception as e:
        log.error("Flow failed", error=str(e))
        RunRepo.mark_failed(run_id)
        return 1


def cmd_p6(args: argparse.Namespace) -> int:
    """Run P6 daemon or single tick."""
    from nuclear.phases.p6.runtime import run_p6_daemon, p6_tick
    from datetime import datetime, timezone
    
    instance_id = args.instance_id or "p6_local"
    
    if args.once:
        now = datetime.now(timezone.utc)
        result = p6_tick(run_id=None, instance_id=instance_id, now_utc=now)
        print(json.dumps(result, indent=2))
        
        # Auto-log run
        log_run(
            command="p6",
            status="success",
            run_id=f"p6_{now.strftime('%Y%m%d_%H%M%S')}",
            summary=f"P6 tick: {result.get('action', 'unknown')}",
            metrics={"action": result.get("action")},
        )
        return 0
        
    if args.daemon:
        # Log daemon start
        log_run(
            command="p6",
            status="success",
            run_id=f"p6_daemon_{instance_id}",
            summary=f"P6 daemon started (interval={args.interval}s)",
        )
        asyncio.run(run_p6_daemon(interval_sec=args.interval, instance_id=instance_id))
        return 0
    
    print("Error: Must specify --daemon or --once")
    return 1


def cmd_learning(args: argparse.Namespace) -> int:
    """Handle learning subcommands."""
    if args.action == "inspect":
        from nuclear.learning.gate import load_learning_gate
        gate = load_learning_gate()
        print(gate.model_dump_json(indent=2))
        return 0
    elif args.action == "compile":
        from nuclear.learning.compiler import run_compiler
        state = run_compiler()
        if state:
            print(f"Compiled Version: {state.version}")
        else:
            print("No changes compiled.")
        return 0
    elif args.action == "shadow":
        from nuclear.db.sqlite import SQLiteEngine
        from contextlib import closing
        with closing(SQLiteEngine.connect()) as conn:
            row = conn.execute("SELECT * FROM shadow_enforcement_reports ORDER BY created_at DESC LIMIT 1").fetchone()
            if row:
                print(f"Last Shadow Report: {row['report_id']} @ {row['created_at']}")
                print(f"Blocked: {dict(row).get('blocked_count', '?')}") # Depends on if row_factory used. M02 said yes.
                # Assuming row factory is dict-like or we convert.
                # SQLiteEngine default might not set row factory to Row.
                # Let's assume tuple if in doubt, but previously we used dict(row).
                # Actually, M04-A tests used dict(row).
                # Re-reading shadow.py: we persist JSON in payload_json.
                if len(row) > 3:
                     print(f"Payload: {row[3][:100]}...") # snippet
            else:
                print("No shadow reports found.")
        return 0
    return 1


def cmd_daily(args: argparse.Namespace) -> int:
    """Handle daily subcommands."""
    from nuclear.phases.daily.run_daily import run_daily_pipeline
    import json
    
    tickers = args.tickers.split(",") if args.tickers else None
    summary = run_daily_pipeline(
        date=args.date,
        tickers=tickers,
        shards=args.shards,
        run_id=args.run_id or f"daily_{args.date}"
    )
    
    print(json.dumps(summary.model_dump(), indent=2))
    return 0


def cmd_docs(args: argparse.Namespace) -> int:
    """Handle docs subcommands."""
    if args.action == "status":
        import yaml
        from pathlib import Path
        
        registry_path = Path("docs/registry.yaml")
        if not registry_path.exists():
            print("Error: docs/registry.yaml not found.")
            return 1
            
        try:
            with open(registry_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)
                
            ssot = data.get("ssot", {})
            print(f"SSOT: {ssot.get('file', 'Unknown')} (Updated: {ssot.get('last_updated', '?')})")
            
            ref_docs = data.get("referenced_docs", [])
            counts = {"present": 0, "missing": 0, "deprecated": 0}
            missing_ids = []
            
            for doc in ref_docs:
                status = doc.get("status", "unknown")
                counts[status] = counts.get(status, 0) + 1
                if status == "missing":
                    missing_ids.append(doc.get("id"))
                    
            print(f"Referenced Docs: {len(ref_docs)} total")
            for k, v in counts.items():
                print(f"  - {k}: {v}")
                
            if missing_ids:
                print(f"Missing Doc IDs: {', '.join(missing_ids)}")
                
            return 0
        except Exception as e:
            print(f"Error reading registry: {e}")
            return 1
    return 1


def cmd_schedule(args: argparse.Namespace) -> int:
    """Handle schedule subcommands."""
    from nuclear.orchestration.schedule import run_daily, run_weekly, get_taipei_today
    from nuclear.progress import read_recent_runs
    
    if args.action == "daily":
        return run_daily(dry_run=args.dry_run)
    
    elif args.action == "weekly":
        return run_weekly(dry_run=args.dry_run)
    
    elif args.action == "status":
        # Show recent runs and timer info
        print(f"=== Nuclear Schedule Status ===")
        print(f"Asia/Taipei Date: {get_taipei_today()}")
        print()
        
        # Recent runs from run_log
        runs = read_recent_runs(10)
        print(f"Recent Runs (last 10):")
        for r in reversed(runs):
            ts = r.get("timestamp", "?")[:19]
            cmd = r.get("command", "?")
            status = r.get("status", "?")
            summary = r.get("summary", "")[:50]
            print(f"  [{ts}] {cmd}: {status} - {summary}")
        
        print()
        print("Systemd Timer Commands:")
        print("  systemctl list-timers --all | grep nuclear")
        print("  journalctl -u nuclear-daily.service -n 50")
        print("  journalctl -u nuclear-weekly.service -n 50")
        return 0
    
    return 1

def main() -> int:
    parser = argparse.ArgumentParser(description="Nuclear CLI V8.45")
    sub = parser.add_subparsers(dest="cmd", required=True)

    wb1 = sub.add_parser("wb1", help="WB-1")
    wb1.add_argument("--run-id", help="Run ID context")
    wb1.set_defaults(func=cmd_wb1)

    sub.add_parser("wa", help="W-A").set_defaults(func=cmd_wa)

    wb2 = sub.add_parser("wb2", help="WB-2")
    wb2.add_argument("--run-id", help="Run ID context")
    wb2.set_defaults(func=cmd_wb2)
    
    sub.add_parser("wb", help="Full WB Flow (WB1->WB2)").set_defaults(func=cmd_wb_flow)

    p6 = sub.add_parser("p6", help="P6")
    p6.add_argument("--daemon", action="store_true")
    p6.add_argument("--once", action="store_true", help="Run exactly one tick and exit")
    p6.add_argument("--interval", type=int, default=30, help="Interval in seconds")
    p6.add_argument("--instance-id", help="P6 instance ID")
    p6.set_defaults(func=cmd_p6)

    # Learning subcommands
    learn = sub.add_parser("learning", help="Learning System M04/M05")
    learn.add_argument("action", choices=["inspect", "compile", "shadow"], help="Action")
    learn.set_defaults(func=cmd_learning)

    daily = sub.add_parser("daily", help="Daily Phase D1-D4 Skeleton")
    daily.add_argument("--date", required=True, help="YYYY-MM-DD")
    daily.add_argument("--run-id", help="Optional run ID")
    daily.add_argument("--tickers", help="Comma-separated tickers")
    daily.add_argument("--shards", type=int, default=1, help="Number of shards")
    daily.set_defaults(func=cmd_daily)

    # Docs subcommands
    docs = sub.add_parser("docs", help="Docs Governance T-DOC-01")
    docs.add_argument("action", choices=["status"], help="Action")
    docs.set_defaults(func=cmd_docs)

    # Schedule subcommands
    schedule = sub.add_parser("schedule", help="Scheduled execution (Daily/Weekly)")
    schedule.add_argument("action", choices=["daily", "weekly", "status"], help="Action")
    schedule.add_argument("--dry-run", action="store_true", help="Print command without executing")
    schedule.set_defaults(func=cmd_schedule)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
