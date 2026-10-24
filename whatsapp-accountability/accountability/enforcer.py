"""Reminders, escalations and flags. Run tick() every minute (cron, n8n, or `serve`)."""

from __future__ import annotations

import logging
import sqlite3
from collections import defaultdict
from datetime import datetime, timedelta

from .clock import is_work_time, work_minutes_between
from .config import Member, Settings
from .db import iso, parse_iso
from .notifier import Notifier

log = logging.getLogger(__name__)


class Enforcer:
    def __init__(self, conn: sqlite3.Connection, settings: Settings, notifier: Notifier):
        self.conn = conn
        self.settings = settings
        self.notifier = notifier

    def tick(self, now: datetime) -> list[str]:
        """Check every open request and fire whatever is due. Safe to run repeatedly."""
        events: list[str] = []
        requests = self.conn.execute("SELECT * FROM requests WHERE resolved_at IS NULL").fetchall()
        for req in requests:
            events += self._check_request(req, now)
        events += self._check_repeat_offenders(now)
        self.conn.commit()
        return events

    # ------------------------------------------------------------ per request

    def _check_request(self, req: sqlite3.Row, now: datetime) -> list[str]:
        events: list[str] = []
        policy = self.settings.policy
        urgent = bool(req["urgent"])
        # Normal reminders wait for work hours; urgent ones go out any time.
        if not urgent and not is_work_time(now, policy):
            return events

        ack_m, remind_m, escalate_m = policy.windows(urgent)
        created = parse_iso(req["created_at"])
        elapsed = work_minutes_between(created, now, policy, urgent)
        quote = _short(req["summary"])

        silent = self.conn.execute(
            "SELECT * FROM assignments WHERE request_id = ? AND ack_at IS NULL AND status = 'pending'",
            (req["id"],),
        ).fetchall()
        silent_people = sorted({row["member"] for row in silent})

        # 1. Mark anyone past the acknowledgment deadline (counts toward repeat failures).
        if elapsed >= ack_m:
            self.conn.execute(
                "UPDATE assignments SET missed_ack = 1 WHERE request_id = ? AND ack_at IS NULL AND status = 'pending'",
                (req["id"],),
            )

        # 2. Nobody at all has answered: alert the owner and nudge the whole group once.
        acked = self.conn.execute(
            "SELECT COUNT(*) FROM assignments WHERE request_id = ? AND ack_at IS NOT NULL", (req["id"],)
        ).fetchone()[0]
        expected = self.conn.execute(
            "SELECT COUNT(DISTINCT member) FROM assignments WHERE request_id = ? AND status != 'cancelled'", (req["id"],)
        ).fetchone()[0]
        if (policy.group_no_response_alert and elapsed >= ack_m and acked == 0 and expected > 1
                and silent_people and req["group_alerted_at"] is None):
            members = [self._member(n) for n in silent_people]
            text = (f"⚠️ No one has acknowledged this yet: \"{quote}\". "
                    f"Everyone listed, reply 'got it' now: {', '.join(silent_people)}")
            self.notifier.send_group(req["chat_id"], text, [m for m in members if m])
            self._record(f"group:{req['id']}", req["id"], self.settings.owner.name, "group_alert",
                         f"Nobody responded after {int(elapsed)} min: \"{quote}\"", now, notify_owner=True)
            self.conn.execute("UPDATE requests SET group_alerted_at = ? WHERE id = ?", (iso(now), req["id"]))
            events.append(f"group_alert request={req['id']}")

        # 3. Personal reminder.
        if elapsed >= remind_m:
            for row in silent:
                if row["reminders_sent"] == 0:
                    member = self._member(row["member"])
                    if not member:
                        continue
                    text = (f"Reminder: please acknowledge the message \"{quote}\" "
                            f"(sent {int(elapsed)} min ago). Reply 'got it', or say what you'll do.")
                    if self._record(f"remind:{req['id']}:{member.name}", req["id"], member.name, "reminder", text, now):
                        self.notifier.send_direct(member, text)
                        events.append(f"reminder {member.name} request={req['id']}")
                    self.conn.execute(
                        "UPDATE assignments SET reminders_sent = reminders_sent + 1, last_reminder_at = ? WHERE id = ?",
                        (iso(now), row["id"]),
                    )

        # 4. Escalate: final notice to the person, one digest per manager, one to the owner.
        if elapsed >= escalate_m:
            to_escalate = [row for row in silent if row["escalated_at"] is None]
            by_manager: dict[str, list[str]] = defaultdict(list)
            for row in to_escalate:
                member = self._member(row["member"])
                if member:
                    text = (f"FINAL NOTICE: no acknowledgment on \"{quote}\" after {int(elapsed)} min. "
                            f"This has been escalated to {member.manager or self.settings.owner.name}.")
                    if self._record(f"final:{req['id']}:{member.name}", req["id"], member.name, "escalation", text, now):
                        self.notifier.send_direct(member, text)
                    if member.manager:
                        by_manager[member.manager].append(member.name)
                self.conn.execute("UPDATE assignments SET escalated_at = ? WHERE id = ?", (iso(now), row["id"]))

            for manager_name, names in by_manager.items():
                manager = self._member(manager_name)
                if manager and not manager.is_owner:
                    text = (f"Escalation: your team members {', '.join(sorted(set(names)))} have not acknowledged "
                            f"\"{quote}\" after {int(elapsed)} min. Please follow up now.")
                    if self._record(f"mgr:{req['id']}:{manager.name}", req["id"], manager.name, "escalation", text, now):
                        self.notifier.send_direct(manager, text)

            if to_escalate:
                names = sorted({row["member"] for row in to_escalate})
                self._record(f"owner-esc:{req['id']}:{len(names)}", req["id"], self.settings.owner.name, "escalation",
                             f"Escalated after {int(elapsed)} min, still silent: {', '.join(names)}. Message: \"{quote}\"",
                             now, notify_owner=True)
                events.append(f"escalation request={req['id']} members={','.join(names)}")

        # 5. Task deadlines and missing proof.
        tasks = self.conn.execute(
            """SELECT * FROM assignments WHERE request_id = ? AND kind = 'task'
               AND status IN ('pending','acknowledged','owned','awaiting_evidence')""",
            (req["id"],),
        ).fetchall()
        for row in tasks:
            member = self._member(row["member"])
            deadline = parse_iso(row["deadline"])
            if deadline and now >= deadline and row["overdue_at"] is None:
                self.conn.execute("UPDATE assignments SET overdue_at = ? WHERE id = ?", (iso(now), row["id"]))
                what = "proof was not submitted" if row["status"] == "awaiting_evidence" else "it is not done"
                text = f"OVERDUE: \"{_short(row['description'])}\" was due {_fmt(deadline, self.settings)} and {what}."
                if member and self._record(f"overdue:{row['id']}", req["id"], member.name, "overdue", text, now):
                    self.notifier.send_direct(member, text)
                    if member.manager and (mgr := self._member(member.manager)) and not mgr.is_owner:
                        self.notifier.send_direct(mgr, f"{member.name}: {text}")
                self._record(f"owner-overdue:{row['id']}", req["id"], self.settings.owner.name, "overdue",
                             f"{row['member']}: {text}", now, notify_owner=True)
                events.append(f"overdue {row['member']} assignment={row['id']}")
            elif row["status"] == "awaiting_evidence" and member:
                text = f"You said \"{_short(row['description'])}\" is done. Please send the photo or proof now."
                if self._record(f"evidence:{row['id']}", req["id"], member.name, "reminder", text, now):
                    self.notifier.send_direct(member, text)
                    events.append(f"evidence_reminder {member.name}")
        return events

    # ------------------------------------------------------------ patterns

    def _check_repeat_offenders(self, now: datetime) -> list[str]:
        policy = self.settings.policy
        since = iso(now - timedelta(days=policy.failure_window_days))
        rows = self.conn.execute(
            """SELECT a.member, COUNT(DISTINCT a.request_id) AS misses
               FROM assignments a JOIN requests r ON r.id = a.request_id
               WHERE a.missed_ack = 1 AND r.created_at >= ?
               GROUP BY a.member HAVING misses >= ?""",
            (since, policy.failure_threshold),
        ).fetchall()
        events = []
        week = now.isocalendar()
        for row in rows:
            key = f"repeat:{row['member']}:{week.year}-W{week.week}"
            text = (f"🚩 {row['member']} has missed {row['misses']} acknowledgment deadlines in the last "
                    f"{policy.failure_window_days} days. Flagged for management review.")
            if self._record(key, None, self.settings.owner.name, "repeat_offender", text, now, notify_owner=True):
                events.append(f"repeat_offender {row['member']} misses={row['misses']}")
        return events

    # ------------------------------------------------------------ helpers

    def _member(self, name: str) -> Member | None:
        return self.settings.find_member(name)

    def _record(self, key: str, request_id: int | None, recipient: str, kind: str, text: str,
                now: datetime, notify_owner: bool = False) -> bool:
        """Log a notification once. Returns False if it was already sent (dedupe)."""
        cur = self.conn.execute(
            "INSERT OR IGNORE INTO notifications (dedupe_key, request_id, member, kind, text, sent_at) VALUES (?,?,?,?,?,?)",
            (key, request_id, recipient, kind, text, iso(now)),
        )
        is_new = cur.rowcount == 1
        if is_new and notify_owner:
            self.notifier.send_direct(self.settings.owner, text)
        return is_new


def _short(text: str | None, limit: int = 90) -> str:
    text = (text or "").replace("\n", " ").strip()
    return text if len(text) <= limit else text[: limit - 1] + "…"


def _fmt(dt: datetime, settings: Settings) -> str:
    return dt.astimezone(settings.policy.tz).strftime("%a %I:%M %p")


def backfill(conn: sqlite3.Connection, settings: Settings, now: datetime) -> None:
    """Score imported history without sending anything: late or missing acks, missed deadlines."""
    policy = settings.policy
    for req in conn.execute("SELECT * FROM requests").fetchall():
        urgent = bool(req["urgent"])
        ack_m, _, escalate_m = policy.windows(urgent)
        created = parse_iso(req["created_at"])
        rows = conn.execute(
            "SELECT * FROM assignments WHERE request_id = ? AND status != 'cancelled'", (req["id"],)
        ).fetchall()
        for row in rows:
            if row["ack_at"] is None:
                age = work_minutes_between(created, now, policy, urgent)
                late = age >= ack_m
                escalated = age >= escalate_m
            else:
                late = (row["ack_minutes"] or 0) > ack_m
                escalated = (row["ack_minutes"] or 0) > escalate_m
            deadline = parse_iso(row["deadline"])
            finished = parse_iso(row["completed_at"])
            overdue = bool(deadline and ((finished and finished > deadline) or (not finished and now > deadline)))
            conn.execute(
                """UPDATE assignments SET missed_ack = ?, escalated_at = COALESCE(escalated_at, ?),
                   overdue_at = COALESCE(overdue_at, ?) WHERE id = ?""",
                (int(late), iso(now) if escalated else None, iso(now) if overdue else None, row["id"]),
            )
    conn.commit()
