"""Turns incoming messages into per-person accountability records."""

from __future__ import annotations

import logging
import sqlite3

from .analyzer import analyze_owner_message, classify_reply
from .clock import work_minutes_between
from .config import Settings
from .db import iso, parse_iso
from .models import Analysis, IncomingMessage, ReplyKind, Status

log = logging.getLogger(__name__)


# An ack row is open until acknowledged; a task row until completed.
OPEN_SQL = "((a.kind = 'ack' AND a.status = 'pending') OR (a.kind = 'task' AND a.status IN ('pending','acknowledged','owned','awaiting_evidence')))"


class Tracker:
    def __init__(self, conn: sqlite3.Connection, settings: Settings):
        self.conn = conn
        self.settings = settings

    # ------------------------------------------------------------ entry point

    def ingest(self, msg: IncomingMessage) -> dict:
        """Store a message and update accountability. Returns what happened."""
        member = self.settings.find_member(msg.sender) or self.settings.find_member(msg.sender_name)
        sender = member.name if member else (msg.sender_name or msg.sender)

        inserted = self.conn.execute(
            """INSERT OR IGNORE INTO messages
               (msg_id, chat_id, chat_name, sender, text, ts, quoted_msg_id, has_media, reaction_to, thread_id)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (msg.msg_id, msg.chat_id, msg.chat_name, sender, msg.text, iso(msg.timestamp),
             msg.quoted_msg_id, int(msg.has_media), msg.reaction_to, msg.thread_id),
        ).rowcount
        if not inserted:
            return {"action": "duplicate"}

        if member and member.is_owner:
            if msg.reaction_to:
                result = {"action": "owner_reaction"}
            else:
                result = self._handle_owner(msg)
        elif member and not member.exempt:
            result = self._handle_reply(msg, member.name)
        else:
            result = {"action": "ignored", "reason": "unknown or exempt sender"}
        self.conn.commit()
        return result

    # ------------------------------------------------------------ owner side

    def _handle_owner(self, msg: IncomingMessage) -> dict:
        # The owner closing the loop ("thanks, good job") on a quoted request resolves it.
        if msg.quoted_msg_id and _looks_like_signoff(msg.text):
            req = self._request_for_message(msg.quoted_msg_id)
            if req:
                self._resolve_request(req["id"], msg)
                return {"action": "request_resolved", "request_id": req["id"]}

        analysis = analyze_owner_message(msg, self.settings)
        if not analysis.requires_response:
            return {"action": "no_response_needed", "kind": analysis.kind}
        request_id = self._create_request(msg, analysis)
        return {"action": "request_created", "request_id": request_id, "kind": analysis.kind,
                "urgent": analysis.urgent, "items": len(analysis.items)}

    def _create_request(self, msg: IncomingMessage, analysis: Analysis) -> int:
        cur = self.conn.execute(
            "INSERT INTO requests (msg_id, chat_id, kind, urgent, volunteer, summary, created_at) VALUES (?,?,?,?,?,?,?)",
            (msg.msg_id, msg.chat_id, analysis.kind, int(analysis.urgent),
             int(any(i.volunteer for i in analysis.items)), analysis.summary, iso(msg.timestamp)),
        )
        request_id = cur.lastrowid
        responders = [m.name for m in self.settings.responders()]

        # Who must acknowledge: everyone if any item is for everyone, otherwise only the named people.
        ack_people: list[str] = []
        if any(not item.assignees for item in analysis.items):
            ack_people = responders
        else:
            for item in analysis.items:
                for name in item.assignees:
                    if name not in ack_people:
                        ack_people.append(name)

        for name in ack_people:
            self.conn.execute(
                "INSERT INTO assignments (request_id, kind, member, description) VALUES (?,?,?,?)",
                (request_id, "ack", name, analysis.summary),
            )

        for item in analysis.items:
            if item.volunteer:
                continue  # whoever steps up gets the task (see _apply_reply)
            # Items for everyone are covered by the ack rows unless they carry a deadline or need proof.
            people = item.assignees or (responders if (item.deadline or item.needs_evidence) else [])
            for name in people:
                self.conn.execute(
                    """INSERT INTO assignments (request_id, kind, member, description, deadline, needs_evidence)
                       VALUES (?,?,?,?,?,?)""",
                    (request_id, "task", name, item.description, iso(item.deadline), int(item.needs_evidence)),
                )
        return request_id

    def _resolve_request(self, request_id: int, msg: IncomingMessage) -> None:
        self.conn.execute("UPDATE requests SET resolved_at = ? WHERE id = ?", (iso(msg.timestamp), request_id))

    # ------------------------------------------------------------ team side

    def _handle_reply(self, msg: IncomingMessage, member: str) -> dict:
        kind = classify_reply(msg.text, msg.has_media, is_reaction=bool(msg.reaction_to))
        target = msg.reaction_to or msg.quoted_msg_id
        req = self._request_for_message(target) if target else None
        if req is None and msg.thread_id:
            req = self._request_in_thread(msg.thread_id, msg.msg_id)
        linked = req is not None

        if req is None and kind is not ReplyKind.OTHER:
            # Unquoted "got it" / "done": attach to this person's most recent open item in this chat.
            req = self._latest_open_request_for(member, msg.chat_id, prefer_task=kind is ReplyKind.DONE)
        if req is None:
            return {"action": "reply_unlinked", "member": member, "reply": kind.value}

        # A substantive reply (even a question or a note) on a quoted request still counts as a response.
        if kind is ReplyKind.OTHER and not linked:
            return {"action": "reply_unlinked", "member": member, "reply": kind.value}

        updates = self._apply_reply(req, member, kind, msg)
        return {"action": "reply_recorded", "member": member, "reply": kind.value,
                "request_id": req["id"], "updates": updates}

    def _apply_reply(self, req: sqlite3.Row, member: str, kind: ReplyKind, msg: IncomingMessage) -> list[str]:
        updates: list[str] = []
        urgent = bool(req["urgent"])
        created = parse_iso(req["created_at"])
        rows = self.conn.execute(
            f"SELECT * FROM assignments a WHERE a.request_id = ? AND a.member = ? AND {OPEN_SQL}",
            (req["id"], member),
        ).fetchall()

        for row in rows:
            fields: dict[str, object] = {"last_reply_msg_id": msg.msg_id}
            if row["ack_at"] is None:
                fields["ack_at"] = iso(msg.timestamp)
                fields["ack_minutes"] = round(work_minutes_between(created, msg.timestamp, self.settings.policy, urgent), 1)

            if row["kind"] == "ack":
                fields["status"] = Status.ACKNOWLEDGED
            else:  # task
                if kind is ReplyKind.DONE:
                    if row["needs_evidence"] and not msg.has_media:
                        fields["status"] = Status.AWAITING_EVIDENCE
                    else:
                        fields["status"] = Status.COMPLETED
                        fields["completed_at"] = iso(msg.timestamp)
                        if msg.has_media:
                            fields["evidence_msg_id"] = msg.msg_id
                    fields.setdefault("owned_at", row["owned_at"] or iso(msg.timestamp))
                elif kind is ReplyKind.OWNERSHIP:
                    fields["status"] = Status.OWNED
                    fields["owned_at"] = row["owned_at"] or iso(msg.timestamp)
                elif row["status"] == Status.AWAITING_EVIDENCE and msg.has_media:
                    fields["status"] = Status.COMPLETED
                    fields["completed_at"] = iso(msg.timestamp)
                    fields["evidence_msg_id"] = msg.msg_id
                elif row["status"] == Status.PENDING:
                    fields["status"] = Status.ACKNOWLEDGED

            sets = ", ".join(f"{k} = ?" for k in fields)
            self.conn.execute(f"UPDATE assignments SET {sets} WHERE id = ?", (*fields.values(), row["id"]))
            updates.append(f"{row['kind']}:{fields.get('status', row['status'])}")

        if kind is ReplyKind.BLOCKED:
            updates.append("blocked")
        if req["volunteer"] and kind in (ReplyKind.OWNERSHIP, ReplyKind.DONE):
            updates += self._take_volunteer(req, member, kind, msg)
        self._maybe_resolve(req["id"], msg)
        return updates

    def _take_volunteer(self, req: sqlite3.Row, member: str, kind: ReplyKind, msg: IncomingMessage) -> list[str]:
        """First person to step up owns it; everyone else is released."""
        has_task = self.conn.execute(
            "SELECT 1 FROM assignments WHERE request_id = ? AND kind = 'task'", (req["id"],)
        ).fetchone()
        if has_task:
            return []
        done = kind is ReplyKind.DONE
        self.conn.execute(
            """INSERT INTO assignments (request_id, kind, member, description, status, ack_at, ack_minutes,
                                        owned_at, completed_at, last_reply_msg_id)
               SELECT request_id, 'task', member, ?, ?, ack_at, ack_minutes, ?, ?, ?
               FROM assignments WHERE request_id = ? AND member = ? AND kind = 'ack'""",
            (req["summary"], Status.COMPLETED if done else Status.OWNED, iso(msg.timestamp),
             iso(msg.timestamp) if done else None, msg.msg_id, req["id"], member),
        )
        self.conn.execute(
            "UPDATE assignments SET status = 'cancelled' WHERE request_id = ? AND kind = 'ack' AND status = 'pending'",
            (req["id"],),
        )
        self.conn.execute("UPDATE requests SET resolved_by = ? WHERE id = ?", (member, req["id"]))
        return [f"volunteer:{member}"]

    def _maybe_resolve(self, request_id: int, msg: IncomingMessage) -> None:
        still_open = self.conn.execute(
            f"SELECT COUNT(*) FROM assignments a WHERE a.request_id = ? AND {OPEN_SQL}", (request_id,)
        ).fetchone()[0]
        if still_open == 0:
            self.conn.execute(
                "UPDATE requests SET resolved_at = ? WHERE id = ? AND resolved_at IS NULL",
                (iso(msg.timestamp), request_id),
            )

    # ------------------------------------------------------------ lookups

    def _request_for_message(self, msg_id: str | None) -> sqlite3.Row | None:
        """Find the request a message points at, following reply chains."""
        seen = set()
        while msg_id and msg_id not in seen:
            seen.add(msg_id)
            req = self.conn.execute("SELECT * FROM requests WHERE msg_id = ?", (msg_id,)).fetchone()
            if req:
                return req
            row = self.conn.execute("SELECT quoted_msg_id FROM messages WHERE msg_id = ?", (msg_id,)).fetchone()
            msg_id = row["quoted_msg_id"] if row else None
        return None

    def _request_in_thread(self, thread_id: str, msg_id: str) -> sqlite3.Row | None:
        return self.conn.execute(
            """SELECT r.* FROM requests r JOIN messages m ON m.msg_id = r.msg_id
               WHERE m.thread_id = ? AND m.msg_id != ? ORDER BY r.created_at LIMIT 1""",
            (thread_id, msg_id),
        ).fetchone()

    def _latest_open_request_for(self, member: str, chat_id: str, prefer_task: bool) -> sqlite3.Row | None:
        kinds = ("task", "ack") if prefer_task else ("ack", "task")
        for kind in kinds:
            row = self.conn.execute(
                f"""SELECT r.* FROM requests r JOIN assignments a ON a.request_id = r.id
                   WHERE a.member = ? AND r.chat_id = ? AND a.kind = ? AND {OPEN_SQL}
                     AND r.resolved_at IS NULL
                   ORDER BY r.created_at DESC LIMIT 1""",
                (member, chat_id, kind),
            ).fetchone()
            if row:
                return row
        return None


def _looks_like_signoff(text: str) -> bool:
    t = text.strip().lower()
    return any(w in t for w in ("thanks", "thank you", "good job", "great job", "perfect", "approved", "closed", "resolved"))
