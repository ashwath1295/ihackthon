"""Decide what an owner message demands, and what a team reply means.

Rule-based by default (free, instant, predictable). Set use_claude = true in
the config to have Claude read the owner's messages instead; any API failure
falls back to the rules so tracking never stops.
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta

from pydantic import BaseModel, Field

from .config import Member, Settings
from .models import ActionItem, Analysis, IncomingMessage, ReplyKind

log = logging.getLogger(__name__)

# ---------------------------------------------------------------- owner messages

URGENT = re.compile(r"\b(urgent|asap|immediately|right now|emergency|critical)\b|🚨|‼️", re.I)
EVERYONE = re.compile(r"\b(everyone|everybody|all of you|team|guys|y'all|all hands|each of you|@all)\b", re.I)
IMPERATIVE = re.compile(
    r"\b(confirm|make sure|please|pls|need(s)? to|send|submit|call|update|review|check|"
    r"upload|fix|finish|complete|schedule|get|bring|reply|respond|acknowledge|let me know|"
    r"must|have to|deadline|by (today|tomorrow|eod|noon|\d))\b",
    re.I,
)
NO_ACTION = re.compile(r"\b(fyi|no action|no need to reply|just so you know|for your information)\b", re.I)
CHATTER = re.compile(r"^\s*(good (morning|night|afternoon)|thanks|thank you|lol|haha|ok|okay|nice|great)\W*$", re.I)
EVIDENCE = re.compile(
    r"\b(photos?|pictures?|pics?|screenshots?|receipts?|videos?|proof|invoices?|"
    r"documents?|signed|scan|before.and.after)\b",
    re.I,
)
SENTENCE_SPLIT = re.compile(r"(?<=[.!?\n])\s+")
VOLUNTEER = re.compile(r"\b(who|anyone|anybody|someone|somebody|any of you)\b", re.I)
WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
TIME_RE = re.compile(r"\bby\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b", re.I)


def _parse_deadline(text: str, sent_at: datetime, settings: Settings) -> datetime | None:
    tz = settings.policy.tz
    local = sent_at.astimezone(tz)
    low = text.lower()
    day = local
    has_day = False
    if "tomorrow" in low:
        day = local + timedelta(days=1)
        has_day = True
    else:
        for i, name in enumerate(WEEKDAYS):
            if re.search(rf"\bby\s+(this\s+|next\s+)?{name}\b", low):
                ahead = (i - local.weekday()) % 7 or 7
                day = local + timedelta(days=ahead)
                has_day = True
                break

    m = TIME_RE.search(text)
    if m:
        hour = int(m.group(1))
        minute = int(m.group(2) or 0)
        meridiem = (m.group(3) or "").lower()
        if meridiem == "pm" and hour < 12:
            hour += 12
        elif meridiem == "am" and hour == 12:
            hour = 0
        elif not meridiem and hour < 8:  # "by 4" during a work day means 4 PM
            hour += 12
        if hour > 23:
            return None
        return day.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if re.search(r"\bby noon\b", low):
        return day.replace(hour=12, minute=0, second=0, microsecond=0)
    if re.search(r"\b(eod|end of (the )?day|by tonight)\b", low) or has_day:
        end = settings.policy.work_end
        return day.replace(hour=end.hour, minute=end.minute, second=0, microsecond=0)
    return None


def _named_members(text: str, settings: Settings) -> list[Member]:
    found = []
    for m in settings.responders():
        names = [m.name.split()[0], m.name, *m.aliases]
        if any(re.search(rf"(?<!\w)@?{re.escape(n)}\b", text, re.I) for n in names if n):
            found.append(m)
    return found


def analyze_owner_message_rules(msg: IncomingMessage, settings: Settings) -> Analysis:
    text = msg.text.strip()
    if not text or CHATTER.match(text):
        return Analysis(requires_response=False, kind="chatter")

    urgent = bool(URGENT.search(text))
    is_question = "?" in text
    is_instruction = bool(IMPERATIVE.search(text)) or urgent
    if NO_ACTION.search(text) and not is_question:
        return Analysis(requires_response=False, kind="announcement", urgent=urgent)
    if not (is_question or is_instruction):
        return Analysis(requires_response=False, kind="announcement", urgent=urgent)

    items: list[ActionItem] = []
    addressed_everyone = bool(EVERYONE.search(text))
    for sentence in filter(None, (s.strip() for s in SENTENCE_SPLIT.split(text))):
        named = _named_members(sentence, settings)
        if not named and "?" in sentence and VOLUNTEER.search(sentence):
            items.append(ActionItem(description=sentence, assignees=[], volunteer=True,
                                    deadline=_parse_deadline(text, msg.timestamp, settings)))
            continue
        if named and (IMPERATIVE.search(sentence) or "?" in sentence):
            items.append(
                ActionItem(
                    description=sentence,
                    assignees=[m.name for m in named],
                    deadline=_parse_deadline(sentence, msg.timestamp, settings),
                    needs_evidence=bool(EVIDENCE.search(sentence)),
                )
            )
        elif EVERYONE.search(sentence):
            items.append(
                ActionItem(
                    description=sentence,
                    assignees=[],
                    deadline=_parse_deadline(sentence, msg.timestamp, settings),
                    needs_evidence=bool(EVIDENCE.search(sentence)),
                )
            )

    if not items:
        # A question or instruction to nobody in particular: everyone owes an answer.
        items.append(
            ActionItem(
                description=text,
                assignees=[],
                deadline=_parse_deadline(text, msg.timestamp, settings),
                needs_evidence=bool(EVIDENCE.search(text)),
            )
        )
        addressed_everyone = True

    if addressed_everyone and not any(not i.assignees for i in items):
        items.insert(0, ActionItem(description="Acknowledge this message", assignees=[]))

    return Analysis(
        requires_response=True,
        kind="question" if is_question and not is_instruction else "instruction",
        urgent=urgent,
        items=items,
        summary=text[:200],
    )


# ---------------------------------------------------------------- Claude analyzer


class _ClaudeItem(BaseModel):
    description: str = Field(description="What must be done, in a few words")
    assignees: list[str] = Field(description="Exact roster names responsible; empty list means everyone")
    deadline_local: str | None = Field(description="ISO-8601 local datetime of the deadline, or null")
    needs_evidence: bool = Field(description="True if proof (photo, receipt, document) is expected")
    volunteer: bool = Field(description="True for 'who can...?' / 'does anyone...?' asks that one volunteer settles")


class _ClaudeAnalysis(BaseModel):
    requires_response: bool
    kind: str = Field(description="instruction | question | announcement | chatter")
    urgent: bool
    summary: str
    items: list[_ClaudeItem]


_SYSTEM = """You read WhatsApp messages that a business owner sends to their team and decide who owes a response.

Rules:
- requires_response is true for instructions, requests and questions; false for chatter, greetings, thanks and FYI announcements.
- Split the message into separate action items. An item addressed to named people lists exactly those roster names in assignees. An item addressed to everyone, or to nobody in particular, has an empty assignees list.
- When the owner asks everyone to confirm, review or reply, include an item with empty assignees.
- urgent is true only for emergencies or explicit urgency (urgent, ASAP, immediately).
- deadline_local is an ISO-8601 datetime in the team's time zone, resolved against the time the message was sent, or null when no deadline is stated.
- needs_evidence is true when the owner expects proof such as photos, receipts, screenshots or signed documents.
- volunteer is true for asks that one person settles, such as "who can meet the inspector?" or "does anyone have the lockbox code?"."""


def analyze_owner_message_claude(msg: IncomingMessage, settings: Settings) -> Analysis:
    import anthropic  # optional dependency

    client = anthropic.Anthropic()
    roster = ", ".join(f"{m.name} ({m.role})" if m.role else m.name for m in settings.responders())
    sent_local = msg.timestamp.astimezone(settings.policy.tz).isoformat()
    response = client.messages.parse(
        model=settings.claude_model,
        max_tokens=4000,
        output_config={"effort": "low"},
        system=_SYSTEM,
        messages=[
            {
                "role": "user",
                "content": f"Team roster: {roster}\nSent at: {sent_local}\n\nMessage:\n{msg.text}",
            }
        ],
        output_format=_ClaudeAnalysis,
    )
    if response.stop_reason == "refusal" or response.parsed_output is None:
        raise RuntimeError(f"Claude returned no analysis (stop_reason={response.stop_reason})")

    out = response.parsed_output
    valid_names = {m.name for m in settings.responders()}
    items = []
    for it in out.items:
        deadline = None
        if it.deadline_local:
            try:
                deadline = datetime.fromisoformat(it.deadline_local)
                if deadline.tzinfo is None:
                    deadline = deadline.replace(tzinfo=settings.policy.tz)
            except ValueError:
                deadline = None
        items.append(
            ActionItem(
                description=it.description,
                assignees=[n for n in it.assignees if n in valid_names],
                deadline=deadline,
                needs_evidence=it.needs_evidence,
                volunteer=it.volunteer and not it.assignees,
            )
        )
    return Analysis(
        requires_response=out.requires_response,
        kind=out.kind,
        urgent=out.urgent,
        items=items,
        summary=out.summary,
    )


def analyze_owner_message(msg: IncomingMessage, settings: Settings) -> Analysis:
    if settings.use_claude:
        try:
            return analyze_owner_message_claude(msg, settings)
        except Exception as exc:  # network, auth, refusal: never stop tracking
            log.warning("Claude analysis failed, using rules: %s", exc)
    return analyze_owner_message_rules(msg, settings)


# ---------------------------------------------------------------- team replies

_DONE = re.compile(
    r"\b(done|completed?|finished|submitted|uploaded|sent( it)?|taken care of|all set|delivered|handled|fixed|resolved)\b|✅|☑️",
    re.I,
)
_NOT_DONE = re.compile(r"\bnot (yet )?(done|finished|completed|submitted|sent)\b|\bnot yet\b", re.I)
_BLOCKED = re.compile(r"\b(can'?t|cannot|unable|blocked|stuck|problem|issue|need help|won'?t be able)\b", re.I)
_OWNERSHIP = re.compile(
    r"\b(on it|i'?ll|i will|i got (it|this)|i'?m (on|handling|working|calling|heading)|handling it|working on it|"
    r"will do|leave it to me|on my way|omw|heading (there|over)|i can|i can do)\b",
    re.I,
)
_ACK = re.compile(
    r"^\W*(ok(ay)?|k|got it|noted|copy( that)?|understood|roger|yes( sir)?|yep|sure|confirmed?|"
    r"reviewed|will review|received|seen|10-4|absolutely|of course)\b|👍|👌|🫡|✔️|🙏",
    re.I,
)


def classify_reply(text: str, has_media: bool = False, is_reaction: bool = False) -> ReplyKind:
    t = (text or "").strip()
    if is_reaction:
        return ReplyKind.ACK
    if _NOT_DONE.search(t):
        return ReplyKind.OWNERSHIP
    if _BLOCKED.search(t):
        return ReplyKind.BLOCKED
    if _DONE.search(t):
        return ReplyKind.DONE
    if _OWNERSHIP.search(t):
        return ReplyKind.OWNERSHIP
    if _ACK.search(t):
        return ReplyKind.ACK
    if t.endswith("?"):
        return ReplyKind.QUESTION
    if has_media:
        return ReplyKind.DONE  # a photo with no text is usually the deliverable
    return ReplyKind.OTHER
