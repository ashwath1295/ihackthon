"""Accountability reports: per-person scorecards, unresolved items, repeated patterns."""

from __future__ import annotations

import csv
import io
import sqlite3
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta
from statistics import median

from .clock import work_minutes_between
from .config import Settings
from .db import iso, parse_iso


@dataclass
class Scorecard:
    member: str
    required: int  # messages they had to answer
    acknowledged: int
    on_time: int
    missed: int  # blew through the ack deadline
    never_responded: int
    median_ack_min: float | None
    tasks: int
    owned: int
    completed: int
    overdue: int
    escalations: int
    score: int  # 0-100
    rating: str

    @property
    def response_rate(self) -> float:
        return self.acknowledged / self.required if self.required else 1.0


def scorecards(conn: sqlite3.Connection, settings: Settings, start: datetime, end: datetime) -> list[Scorecard]:
    policy = settings.policy
    cards = []
    for m in settings.responders():
        rows = conn.execute(
            """SELECT a.*, r.urgent FROM assignments a JOIN requests r ON r.id = a.request_id
               WHERE a.member = ? AND r.created_at >= ? AND r.created_at < ?
                 AND NOT (a.status = 'cancelled' AND a.ack_at IS NULL)""",
            (m.name, iso(start), iso(end)),
        ).fetchall()
        by_request: dict[int, list[sqlite3.Row]] = {}
        for row in rows:
            by_request.setdefault(row["request_id"], []).append(row)

        required = len(by_request)
        ack_times, on_time, acknowledged, missed, never = [], 0, 0, 0, 0
        for req_rows in by_request.values():
            first = min((r for r in req_rows if r["ack_at"]), key=lambda r: r["ack_at"], default=None)
            urgent = bool(req_rows[0]["urgent"])
            if first:
                acknowledged += 1
                ack_times.append(first["ack_minutes"] or 0)
                if (first["ack_minutes"] or 0) <= policy.windows(urgent)[0]:
                    on_time += 1
            else:
                never += 1
            if any(r["missed_ack"] for r in req_rows):
                missed += 1

        tasks = [r for r in rows if r["kind"] == "task"]
        owned = sum(1 for r in tasks if r["owned_at"])
        completed = sum(1 for r in tasks if r["status"] == "completed")
        overdue = sum(1 for r in tasks if r["overdue_at"])
        escalations = len({r["request_id"] for r in rows if r["escalated_at"]})

        ack_rate = acknowledged / required if required else 1.0
        on_time_rate = on_time / required if required else 1.0
        # Only judge tasks that finished or blew their deadline; open, not-yet-due work is not a miss.
        judged = completed + sum(1 for r in tasks if r["overdue_at"] and r["status"] != "completed")
        completion_rate = completed / judged if judged else 1.0
        score = round(100 * (0.4 * ack_rate + 0.3 * on_time_rate + 0.3 * completion_rate)) - 5 * escalations
        score = max(0, min(100, score))
        rating = "Reliable" if score >= 85 else "Needs attention" if score >= 60 else "At risk"

        cards.append(Scorecard(
            member=m.name, required=required, acknowledged=acknowledged, on_time=on_time, missed=missed,
            never_responded=never, median_ack_min=round(median(ack_times), 1) if ack_times else None,
            tasks=len(tasks), owned=owned, completed=completed, overdue=overdue,
            escalations=escalations, score=score, rating=rating,
        ))
    cards.sort(key=lambda c: c.score)
    return cards


def unresolved(conn: sqlite3.Connection, settings: Settings, now: datetime) -> list[dict]:
    out = []
    for req in conn.execute("SELECT * FROM requests WHERE resolved_at IS NULL ORDER BY created_at").fetchall():
        rows = conn.execute("SELECT * FROM assignments WHERE request_id = ?", (req["id"],)).fetchall()
        silent = sorted({r["member"] for r in rows if r["ack_at"] is None and r["status"] == "pending"})
        rows = [r for r in rows if r["status"] != "cancelled"]
        grouped: dict[str, list[str]] = {}
        for r in rows:
            if r["kind"] == "task" and r["status"] not in ("completed", "cancelled"):
                label = r["member"] + (" (overdue)" if r["overdue_at"] else f" ({r['status'].replace('_', ' ')})")
                grouped.setdefault(r["description"], []).append(label)
        open_tasks = [f"{desc[:100]} — {', '.join(names)}" for desc, names in grouped.items()]
        acked = len({r["member"] for r in rows if r["ack_at"]})
        expected = len({r["member"] for r in rows})
        age = work_minutes_between(parse_iso(req["created_at"]), now, settings.policy, bool(req["urgent"]))
        out.append({
            "request_id": req["id"], "summary": req["summary"], "urgent": bool(req["urgent"]),
            "sent": parse_iso(req["created_at"]).astimezone(settings.policy.tz).strftime("%a %b %d %I:%M %p"),
            "age_work_min": int(age), "expected": expected, "acknowledged": acked,
            "silent": silent, "open_tasks": open_tasks,
        })
    return out


def patterns(cards: list[Scorecard], settings: Settings) -> list[str]:
    notes = []
    threshold = settings.policy.failure_threshold
    for c in cards:
        if c.missed >= threshold:
            notes.append(f"🚩 {c.member} missed the acknowledgment deadline {c.missed} times. Review required.")
        if c.required >= 3 and c.never_responded / c.required >= 0.5:
            notes.append(f"🔇 {c.member} never responded to {c.never_responded} of {c.required} messages.")
        if c.tasks >= 2 and c.owned == 0:
            notes.append(f"🙅 {c.member} was assigned {c.tasks} tasks and never took ownership.")
        if c.overdue >= 2:
            notes.append(f"⏰ {c.member} missed {c.overdue} task deadlines.")
    timed = [c for c in cards if c.median_ack_min is not None]
    if len(timed) >= 3:
        slow = sorted(timed, key=lambda c: c.median_ack_min, reverse=True)[:3]
        notes.append("🐢 Slowest to acknowledge: " + ", ".join(f"{c.member} ({c.median_ack_min} min)" for c in slow))
        fast = sorted(timed, key=lambda c: c.median_ack_min)[:3]
        notes.append("⚡ Fastest to acknowledge: " + ", ".join(f"{c.member} ({c.median_ack_min} min)" for c in fast))
    owners = sorted((c for c in cards if c.completed), key=lambda c: c.completed, reverse=True)[:3]
    if owners:
        notes.append("🏆 Most follow-through: " + ", ".join(f"{c.member} ({c.completed} done)" for c in owners))
    return notes


def render_markdown(conn: sqlite3.Connection, settings: Settings, now: datetime, days: int) -> str:
    start = now - timedelta(days=days)
    cards = scorecards(conn, settings, start, now)
    open_items = unresolved(conn, settings, now)
    title = "Daily Accountability Report" if days == 1 else f"{days}-Day Accountability Report"
    local = now.astimezone(settings.policy.tz)

    total_req = conn.execute("SELECT COUNT(*) FROM requests WHERE created_at >= ?", (iso(start),)).fetchone()[0]
    lines = [f"# {title}", f"_Generated {local:%a %b %d %Y %I:%M %p}_", "",
             f"- Messages that required a response: **{total_req}**",
             f"- Still unresolved: **{len(open_items)}**",
             f"- People flagged At risk: **{sum(1 for c in cards if c.rating == 'At risk')}**", ""]

    lines += ["## Unanswered and unresolved", ""]
    if not open_items:
        lines.append("Nothing open. Everyone is accounted for.")
    for item in open_items:
        flag = "🚨 URGENT " if item["urgent"] else ""
        lines.append(f"- {flag}**\"{item['summary'][:120]}\"** (sent {item['sent']}, {item['age_work_min']} work min ago) "
                     f"— {item['acknowledged']}/{item['expected']} acknowledged")
        if item["silent"]:
            lines.append(f"  - Silent: {', '.join(item['silent'])}")
        for task in item["open_tasks"]:
            lines.append(f"  - Open task: {task}")
    lines.append("")

    lines += ["## Patterns", ""]
    notes = patterns(cards, settings)
    lines += [f"- {n}" for n in notes] or ["- No repeated problems in this period."]
    lines.append("")

    lines += ["## Scorecard (lowest first)", "",
              "| Person | Score | Rating | Responded | On time | Missed | Median ack | Tasks done | Overdue | Escalated |",
              "|---|---|---|---|---|---|---|---|---|---|"]
    for c in cards:
        med = f"{c.median_ack_min} min" if c.median_ack_min is not None else "—"
        lines.append(f"| {c.member} | {c.score} | {c.rating} | {c.acknowledged}/{c.required} | {c.on_time} | "
                     f"{c.missed} | {med} | {c.completed}/{c.tasks} | {c.overdue} | {c.escalations} |")
    return "\n".join(lines) + "\n"


def render_csv(cards: list[Scorecard]) -> str:
    buf = io.StringIO()
    if cards:
        writer = csv.DictWriter(buf, fieldnames=list(asdict(cards[0]).keys()))
        writer.writeheader()
        for c in cards:
            writer.writerow(asdict(c))
    return buf.getvalue()
