"""Plain data types shared by the ingest adapters, analyzer and tracker."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum


@dataclass
class IncomingMessage:
    """One WhatsApp message (or reaction), normalized from any source."""

    msg_id: str
    chat_id: str  # group id, or the sender's number for 1:1 chats
    sender: str  # phone number or display name
    text: str
    timestamp: datetime  # timezone-aware
    chat_name: str = ""
    quoted_msg_id: str | None = None  # the message this one replies to
    has_media: bool = False  # photo/video/doc attached (evidence)
    reaction_to: str | None = None  # set when this is an emoji reaction
    sender_name: str = ""


class Status(StrEnum):
    PENDING = "pending"  # nobody has heard from this person yet
    ACKNOWLEDGED = "acknowledged"  # "got it", "ok", 👍
    OWNED = "owned"  # "I'll handle it", "on it"
    COMPLETED = "completed"  # "done" + evidence when evidence is required
    AWAITING_EVIDENCE = "awaiting_evidence"  # said done, no proof yet
    CANCELLED = "cancelled"


class ReplyKind(StrEnum):
    ACK = "ack"
    OWNERSHIP = "ownership"
    DONE = "done"
    BLOCKED = "blocked"
    QUESTION = "question"
    OTHER = "other"


@dataclass
class ActionItem:
    """What the owner asked for. One message can contain several."""

    description: str
    assignees: list[str] = field(default_factory=list)  # member names; empty = everyone
    deadline: datetime | None = None
    needs_evidence: bool = False
    volunteer: bool = False  # "who can...?" -- the first person to take it closes it for everyone


@dataclass
class Analysis:
    requires_response: bool
    kind: str  # "instruction", "question", "announcement", "chatter"
    urgent: bool = False
    items: list[ActionItem] = field(default_factory=list)
    summary: str = ""
