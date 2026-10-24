"""Flat tables for the live dashboard (one Google Sheet per table)."""

from __future__ import annotations

import csv
import io
import sqlite3
from datetime import datetime, timedelta

from .config import Settings
from .db import iso, parse_iso
from .reports import scorecards, unresolved

TABLES = ("scorecard", "open_messages", "message_responses")


def build_tables(conn: sqlite3.Connection, settings: Settings, now: datetime, days: int = 30) -> dict[str, list[dict]]:
    tz = settings.policy.tz
    start = now - timedelta(days=days)
    people = {m.name: m for m in settings.members}

    scorecard = []
    for c in scorecards(conn, settings, start, now):
        m = people[c.member]
        scorecard.append({
            "member": c.member, "role": m.role, "manager": m.manager or "",
            "score": c.score, "rating": c.rating, "required": c.required, "acknowledged": c.acknowledged,
            "on_time": c.on_time, "missed": c.missed, "never_responded": c.never_responded,
            "median_ack_min": "" if c.median_ack_min is None else c.median_ack_min,
            "tasks": c.tasks, "owned": c.owned, "completed": c.completed, "overdue": c.overdue,
            "escalations": c.escalations,
        })

    open_messages = [{
        "request_id": i["request_id"], "sent": i["sent"], "summary": i["summary"], "urgent": int(i["urgent"]),
        "age_work_min": i["age_work_min"], "expected": i["expected"], "acknowledged": i["acknowledged"],
        "silent": ", ".join(i["silent"]), "open_tasks": "; ".join(i["open_tasks"]),
    } for i in unresolved(conn, settings, now)]

    message_responses = []
    requests = conn.execute(
        "SELECT * FROM requests WHERE created_at >= ? ORDER BY created_at", (iso(start),)
    ).fetchall()
    for r in requests:
        ack_window = settings.policy.windows(bool(r["urgent"]))[0]
        sent = parse_iso(r["created_at"]).astimezone(tz)
        rows = conn.execute(
            """SELECT member, MIN(ack_minutes) AS mins, MAX(ack_at IS NOT NULL) AS acked
               FROM assignments WHERE request_id = ? AND status != 'cancelled' GROUP BY member""",
            (r["id"],),
        ).fetchall()
        names: dict[str, list[str]] = {"on_time": [], "late": [], "silent": []}
        for x in rows:
            status = "silent" if not x["acked"] else ("on_time" if (x["mins"] or 0) <= ack_window else "late")
            names[status].append(x["member"])
        message_responses.append({
            "request_id": r["id"], "sent": sent.strftime("%a %b %-d %-I:%M %p"), "label": sent.strftime("%a %-I:%M %p"),
            "message": r["summary"], "urgent": r["urgent"], "expected": len(rows),
            **{k: len(v) for k, v in names.items()},
            "status": "Resolved" if r["resolved_at"] else "Open", "taken_by": r["resolved_by"] or "",
            **{f"{k}_names": ", ".join(sorted(v)) for k, v in names.items()},
        })

    return {"scorecard": scorecard, "open_messages": open_messages, "message_responses": message_responses}


def to_csv(rows: list[dict]) -> str:
    buf = io.StringIO()
    if rows:
        w = csv.DictWriter(buf, fieldnames=list(rows[0].keys()))
        w.writeheader()
        w.writerows(rows)
    return buf.getvalue()
