"""SQLite storage. Swap the connection for Postgres/Supabase later; the SQL is portable."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS messages (
    msg_id        TEXT PRIMARY KEY,
    chat_id       TEXT NOT NULL,
    chat_name     TEXT,
    sender        TEXT NOT NULL,      -- member name when known, else raw sender
    text          TEXT,
    ts            TEXT NOT NULL,      -- ISO-8601 UTC
    quoted_msg_id TEXT,
    has_media     INTEGER DEFAULT 0,
    reaction_to   TEXT,
    thread_id     TEXT
);

-- One row per owner message that needs a response.
CREATE TABLE IF NOT EXISTS requests (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    msg_id          TEXT NOT NULL UNIQUE REFERENCES messages(msg_id),
    chat_id         TEXT NOT NULL,
    kind            TEXT NOT NULL,    -- instruction | question
    urgent          INTEGER DEFAULT 0,
    volunteer       INTEGER DEFAULT 0, -- first person to step up closes it
    summary         TEXT,
    created_at      TEXT NOT NULL,
    group_alerted_at TEXT,            -- "nobody answered" alert sent
    resolved_at     TEXT,
    resolved_by     TEXT
);

-- What each person owes on a request.
--   kind='ack'  : everyone required must acknowledge
--   kind='task' : a named person must take ownership and finish
CREATE TABLE IF NOT EXISTS assignments (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id        INTEGER NOT NULL REFERENCES requests(id),
    kind              TEXT NOT NULL,
    member            TEXT NOT NULL,
    description       TEXT,
    deadline          TEXT,
    needs_evidence    INTEGER DEFAULT 0,
    status            TEXT NOT NULL DEFAULT 'pending',
    ack_at            TEXT,
    ack_minutes       REAL,           -- work minutes to acknowledge
    owned_at          TEXT,
    completed_at      TEXT,
    evidence_msg_id   TEXT,
    last_reply_msg_id TEXT,
    reminders_sent    INTEGER DEFAULT 0,
    last_reminder_at  TEXT,
    escalated_at      TEXT,
    missed_ack        INTEGER DEFAULT 0,  -- blew through the ack deadline
    overdue_at        TEXT                -- task passed its deadline unfinished
);
CREATE INDEX IF NOT EXISTS idx_assign_member ON assignments(member);
CREATE INDEX IF NOT EXISTS idx_assign_status ON assignments(status);

CREATE TABLE IF NOT EXISTS notifications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    dedupe_key  TEXT NOT NULL UNIQUE,   -- prevents duplicate reminders
    request_id  INTEGER,
    member      TEXT,                   -- recipient
    kind        TEXT NOT NULL,          -- reminder | escalation | group_alert | overdue | repeat_offender
    text        TEXT NOT NULL,
    sent_at     TEXT NOT NULL
);
"""


def connect(path: str | Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(SCHEMA)
    cols = {r[1] for r in conn.execute("PRAGMA table_info(messages)")}
    if "thread_id" not in cols:  # databases created before thread support
        conn.execute("ALTER TABLE messages ADD COLUMN thread_id TEXT")
    return conn


def iso(dt: datetime | None) -> str | None:
    """Store everything in UTC so text comparisons in SQL sort correctly."""
    return dt.astimezone(timezone.utc).isoformat() if dt else None


def parse_iso(value: str | None) -> datetime | None:
    return datetime.fromisoformat(value) if value else None
