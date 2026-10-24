"""Parse webhook payloads from Meta's WhatsApp Business Cloud API."""

from __future__ import annotations

from datetime import datetime, timezone

from ..models import IncomingMessage

MEDIA_TYPES = {"image", "video", "document", "audio", "sticker"}


def parse_webhook(payload: dict) -> list[IncomingMessage]:
    out: list[IncomingMessage] = []
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            names = {c.get("wa_id"): c.get("profile", {}).get("name", "") for c in value.get("contacts", [])}
            for m in value.get("messages", []):
                mtype = m.get("type")
                sender = m.get("from", "")
                text = ""
                reaction_to = None
                if mtype == "text":
                    text = m.get("text", {}).get("body", "")
                elif mtype in MEDIA_TYPES:
                    text = m.get(mtype, {}).get("caption", "")
                elif mtype == "reaction":
                    text = m.get("reaction", {}).get("emoji", "")
                    reaction_to = m.get("reaction", {}).get("message_id")
                    if not text:  # reaction removed
                        continue
                elif mtype == "button":
                    text = m.get("button", {}).get("text", "")
                elif mtype == "interactive":
                    inter = m.get("interactive", {})
                    text = (inter.get("button_reply") or inter.get("list_reply") or {}).get("title", "")
                # Group messages carry a group id; 1:1 chats are keyed by the sender.
                chat_id = m.get("group_id") or value.get("group_id") or sender
                out.append(IncomingMessage(
                    msg_id=m["id"],
                    chat_id=chat_id,
                    sender=sender,
                    sender_name=names.get(sender, ""),
                    text=text,
                    timestamp=datetime.fromtimestamp(int(m.get("timestamp", 0)), tz=timezone.utc),
                    quoted_msg_id=(m.get("context") or {}).get("id"),
                    has_media=mtype in MEDIA_TYPES,
                    reaction_to=reaction_to,
                ))
    return out
