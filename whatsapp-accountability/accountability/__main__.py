"""Command line: python -m accountability <command> --config config.toml"""

from __future__ import annotations

import argparse
import logging
import sys
from datetime import timedelta
from pathlib import Path

from .clock import utcnow
from .config import load_settings
from .db import connect
from .enforcer import Enforcer, backfill
from .ingest.chat_export import parse_export
from .notifier import ConsoleNotifier, notifier_from_env
from .reports import render_csv, render_markdown, scorecards
from .tracker import Tracker

HERE = Path(__file__).resolve().parent.parent


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="accountability", description="WhatsApp team accountability tracker")
    parser.add_argument("--config", default="config.toml", help="path to config.toml")
    sub = parser.add_subparsers(dest="cmd", required=True)

    imp = sub.add_parser("import-export", help="load a WhatsApp 'Export chat' .txt file")
    imp.add_argument("file")
    imp.add_argument("--chat", required=True, help="a name for this group, e.g. crew")
    imp.add_argument("--day-first", action="store_true", help="dates are DD/MM/YY")

    tick = sub.add_parser("tick", help="send due reminders and escalations once (for cron)")
    tick.add_argument("--dry-run", action="store_true", help="print instead of sending")

    rep = sub.add_parser("report", help="print an accountability report")
    rep.add_argument("--days", type=int, default=7)
    rep.add_argument("--out", help="write markdown to this file")
    rep.add_argument("--csv", help="also write the scorecard as CSV")

    srv = sub.add_parser("serve", help="run the webhook server, dashboard and reminder loop")
    srv.add_argument("--host", default="0.0.0.0")
    srv.add_argument("--port", type=int, default=8000)

    sub.add_parser("sync-sheets", help="push the dashboard tables to Google Sheets now")

    sub.add_parser("demo", help="load the sample 18-person group and print a report")

    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    if args.cmd == "demo":
        return _demo()

    settings = load_settings(args.config)
    conn = connect(settings.db_path)

    if args.cmd == "import-export":
        tracker = Tracker(conn, settings)
        msgs = parse_export(args.file, args.chat, settings.policy.tz, args.day_first)
        created = sum(1 for m in msgs if tracker.ingest(m).get("action") == "request_created")
        backfill(conn, settings, utcnow())
        unknown = sorted({m.sender for m in msgs if not settings.find_member(m.sender)})
        print(f"Imported {len(msgs)} messages, {created} needed a response.")
        if unknown:
            print("Not in the roster (add them or their alias to config.toml): " + ", ".join(unknown))
    elif args.cmd == "tick":
        notifier = ConsoleNotifier() if args.dry_run else notifier_from_env()
        for event in Enforcer(conn, settings, notifier).tick(utcnow()):
            print(event)
    elif args.cmd == "report":
        now = utcnow()
        text = render_markdown(conn, settings, now, args.days)
        if args.out:
            Path(args.out).write_text(text)
            print(f"Wrote {args.out}")
        else:
            print(text)
        if args.csv:
            Path(args.csv).write_text(render_csv(scorecards(conn, settings, now - timedelta(days=args.days), now)))
            print(f"Wrote {args.csv}")
    elif args.cmd == "sync-sheets":
        if not settings.sheets:
            print("Add a [sheets] section to config.toml first (see README).")
            return 1
        from .sheets_sync import SheetsSync

        print("Updated:", ", ".join(SheetsSync(settings.sheets).push(conn, settings, utcnow())))
    elif args.cmd == "serve":
        import uvicorn

        from .server import create_app

        uvicorn.run(create_app(settings, notifier_from_env()), host=args.host, port=args.port)
    return 0


def _demo() -> int:
    import tempfile

    settings = load_settings(HERE / "config.example.toml")
    settings.db_path = str(Path(tempfile.mkdtemp()) / "demo.db")
    conn = connect(settings.db_path)
    tracker = Tracker(conn, settings)
    msgs = parse_export(HERE / "sample_data" / "crew_chat.txt", "crew", settings.policy.tz)
    for m in msgs:
        tracker.ingest(m)
    end = max(m.timestamp for m in msgs) + timedelta(hours=2)
    backfill(conn, settings, end)
    print(render_markdown(conn, settings, end, days=30))
    return 0


if __name__ == "__main__":
    sys.exit(main())
