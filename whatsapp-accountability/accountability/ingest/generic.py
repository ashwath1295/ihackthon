"""A simple JSON shape for bridges (n8n, Whapi, Green API, Wassenger, a WhatsApp Web bot...).

Map your provider's webhook to this shape and POST it to /webhook/generic:

    {"msg_id": "...", "chat_id": "...", "chat_name": "Crew", "sender": "15551234567",
     "sender_name": "Bryan", "text": "got it", "timestamp": "2026-10-24T14:05:00Z",
     "quoted_msg_id": null, "has_media": false, "reaction_to": null}
"""

from __future__ import annotations

from datetime import datetime, timezone

from ..models import IncomingMessage


def parse_generic(data: dict) -> IncomingMessage:
    ts = data.get("timestamp")
    if isinstance(ts, (int, float)):
        when = datetime.fromtimestamp(ts, tz=timezone.utc)
    else:
        when = datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
        if when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
    return IncomingMessage(
        msg_id=str(data["msg_id"]),
        chat_id=str(data.get("chat_id") or data["sender"]),
        chat_name=data.get("chat_name", ""),
        sender=str(data["sender"]),
        sender_name=data.get("sender_name", ""),
        text=data.get("text") or "",
        timestamp=when,
        quoted_msg_id=data.get("quoted_msg_id"),
        has_media=bool(data.get("has_media")),
        reaction_to=data.get("reaction_to"),
    )
