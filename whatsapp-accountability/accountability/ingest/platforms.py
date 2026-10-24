"""Parsers for Google Chat, Slack, Microsoft Teams and Telegram.

Every sender id is prefixed with its platform ("gchat:users/123", "slack:U123",
"teams:29:abc", "telegram:5551234"). Put those ids in a member's `ids` list in
config.toml so the tracker knows who is who on each platform.
"""

from __future__ import annotations

from datetime import datetime, timezone

from ..models import IncomingMessage


def _ts(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


# ---------------------------------------------------------------- Google Chat

def parse_google_chat_message(m: dict, space: dict | None = None) -> IncomingMessage | None:
    """One Chat API Message resource (from an app event or spaces.messages.list)."""
    sender = m.get("sender") or {}
    if sender.get("type") == "BOT":
        return None
    space = m.get("space") or space or {}
    return IncomingMessage(
        msg_id=m["name"],
        chat_id=space.get("name") or m["name"].split("/messages/")[0],
        chat_name=space.get("displayName", ""),
        sender=f"gchat:{sender.get('name', '')}",
        sender_name=sender.get("email") or sender.get("displayName", ""),
        text=(m.get("argumentText") or m.get("text") or "").strip(),
        timestamp=_ts(m.get("createTime")),
        quoted_msg_id=(m.get("quotedMessageMetadata") or {}).get("name"),
        thread_id=(m.get("thread") or {}).get("name"),
        has_media=bool(m.get("attachment") or m.get("attachments")),
    )


def parse_google_chat_event(event: dict) -> list[IncomingMessage]:
    """A Chat app interaction event (classic format or the Workspace add-on format)."""
    payload = (event.get("chat") or {}).get("messagePayload")
    if payload:
        msg = parse_google_chat_message(payload.get("message", {}), payload.get("space"))
        return [msg] if msg else []
    if event.get("type") == "MESSAGE" and event.get("message"):
        msg = parse_google_chat_message(event["message"], event.get("space"))
        return [msg] if msg else []
    return []


# ---------------------------------------------------------------- Slack

def parse_slack_event(payload: dict) -> list[IncomingMessage]:
    """Slack Events API callback: messages and reaction_added."""
    ev = payload.get("event") or {}
    kind = ev.get("type")
    if kind == "reaction_added":
        item = ev.get("item") or {}
        if item.get("type") != "message":
            return []
        return [IncomingMessage(
            msg_id=f"slack-react:{ev.get('user')}:{item.get('ts')}:{ev.get('reaction')}",
            chat_id=item.get("channel", ""),
            sender=f"slack:{ev.get('user')}",
            text=f":{ev.get('reaction')}:",
            timestamp=datetime.fromtimestamp(float(ev.get("event_ts", 0)), tz=timezone.utc),
            reaction_to=f"{item.get('channel')}:{item.get('ts')}",
        )]
    if kind != "message" or ev.get("bot_id") or ev.get("subtype") not in (None, "file_share", "thread_broadcast"):
        return []
    channel = ev.get("channel", "")
    thread = ev.get("thread_ts")
    return [IncomingMessage(
        msg_id=f"{channel}:{ev['ts']}",
        chat_id=channel,
        sender=f"slack:{ev.get('user')}",
        text=ev.get("text", ""),
        timestamp=datetime.fromtimestamp(float(ev["ts"]), tz=timezone.utc),
        quoted_msg_id=f"{channel}:{thread}" if thread and thread != ev["ts"] else None,
        has_media=bool(ev.get("files")),
    )]


# ---------------------------------------------------------------- Microsoft Teams

def parse_teams_activity(activity: dict) -> list[IncomingMessage]:
    """Bot Framework activity from a Teams channel or chat."""
    if activity.get("type") != "message":
        return []
    sender = activity.get("from") or {}
    conv = (activity.get("conversation") or {}).get("id", "")
    channel = conv.split(";messageid=")[0]
    root = conv.split(";messageid=")[1] if ";messageid=" in conv else None
    reply_to = activity.get("replyToId") or root
    return [IncomingMessage(
        msg_id=f"{channel}:{activity['id']}",
        chat_id=channel,
        sender=f"teams:{sender.get('aadObjectId') or sender.get('id', '')}",
        sender_name=sender.get("name", ""),
        text=activity.get("text", "") or "",
        timestamp=_ts(activity.get("timestamp")),
        quoted_msg_id=f"{channel}:{reply_to}" if reply_to and reply_to != activity["id"] else None,
        has_media=any(not str(a.get("contentType", "")).startswith("text/html")
                      for a in activity.get("attachments") or []),
    )]


# ---------------------------------------------------------------- Telegram

def parse_telegram_update(update: dict) -> list[IncomingMessage]:
    """Telegram Bot API update: messages and emoji reactions."""
    if reaction := update.get("message_reaction"):
        if not reaction.get("new_reaction") or not reaction.get("user"):
            return []
        chat = reaction["chat"]
        emoji = reaction["new_reaction"][0].get("emoji", "👍")
        return [IncomingMessage(
            msg_id=f"tg-react:{chat['id']}:{reaction['message_id']}:{reaction['user']['id']}",
            chat_id=str(chat["id"]),
            chat_name=chat.get("title", ""),
            sender=f"telegram:{reaction['user']['id']}",
            text=emoji,
            timestamp=datetime.fromtimestamp(reaction["date"], tz=timezone.utc),
            reaction_to=f"{chat['id']}:{reaction['message_id']}",
        )]
    m = update.get("message") or update.get("edited_message")
    if not m or (m.get("from") or {}).get("is_bot"):
        return []
    chat = m["chat"]
    reply = m.get("reply_to_message")
    user = m.get("from") or {}
    return [IncomingMessage(
        msg_id=f"{chat['id']}:{m['message_id']}",
        chat_id=str(chat["id"]),
        chat_name=chat.get("title", ""),
        sender=f"telegram:{user.get('id')}",
        sender_name=user.get("username") or user.get("first_name", ""),
        text=m.get("text") or m.get("caption") or "",
        timestamp=datetime.fromtimestamp(m["date"], tz=timezone.utc),
        quoted_msg_id=f"{chat['id']}:{reply['message_id']}" if reply else None,
        has_media=any(k in m for k in ("photo", "video", "document")),
    )]
