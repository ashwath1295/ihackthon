"""Parse a WhatsApp "Export chat" .txt file (iPhone or Android format).

This works with any existing group today, no API needed: export the chat,
import it, and get a full accountability report on past behavior.
"""

from __future__ import annotations

import hashlib
import re
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from ..models import IncomingMessage

# [1/15/24, 9:05:12 AM] Name: text        (iPhone)
# 1/15/24, 9:05 AM - Name: text           (Android)
LINE = re.compile(
    r"^‎?\[?(?P<date>\d{1,2}[/.]\d{1,2}[/.]\d{2,4}),?\s+"
    r"(?P<time>\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APap]\.?\s?[Mm]\.?)?)\]?\s*(?:-\s*)?"
    r"(?P<name>[^:]+?):\s(?P<text>.*)$"
)
MEDIA = re.compile(r"<attached:[^>]*>|\S+\s\(file attached\)|<Media omitted>|(?:image|video|document) omitted", re.I)


def _parse_dt(date: str, time_: str, tz: ZoneInfo, day_first: bool) -> datetime:
    parts = re.split(r"[/.]", date)
    a, b, y = int(parts[0]), int(parts[1]), int(parts[2])
    month, day = (b, a) if day_first else (a, b)
    if y < 100:
        y += 2000
    t = time_.replace(" ", " ").replace(".", "").upper().strip()
    fmt = "%I:%M:%S %p" if t.count(":") == 2 and ("AM" in t or "PM" in t) else \
          "%I:%M %p" if ("AM" in t or "PM" in t) else \
          "%H:%M:%S" if t.count(":") == 2 else "%H:%M"
    t = re.sub(r"\s*(AM|PM)$", r" \1", t)
    clock = datetime.strptime(t, fmt)
    return datetime(y, month, day, clock.hour, clock.minute, clock.second, tzinfo=tz)


def parse_export(path: str | Path, chat_id: str, tz: ZoneInfo, day_first: bool = False) -> list[IncomingMessage]:
    messages: list[IncomingMessage] = []
    for raw in Path(path).read_text(encoding="utf-8").splitlines():
        line = raw.replace("‎", "")
        m = LINE.match(line)
        if not m:
            if messages and line.strip():  # continuation of a multi-line message
                messages[-1].text += "\n" + line
            continue
        text = m.group("text")
        if "Messages and calls are end-to-end encrypted" in text:
            continue
        when = _parse_dt(m.group("date"), m.group("time"), tz, day_first)
        name = m.group("name").strip()
        digest = hashlib.sha1(f"{chat_id}|{when.isoformat()}|{name}|{text}".encode()).hexdigest()[:16]
        has_media = bool(MEDIA.search(text))
        messages.append(IncomingMessage(
            msg_id=f"export-{digest}",
            chat_id=chat_id,
            sender=name,
            sender_name=name,
            text=MEDIA.sub("", text).strip(),
            timestamp=when,
            has_media=has_media,
        ))
    return messages
