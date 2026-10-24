"""Where reminders and escalations go.

- ConsoleNotifier: prints (dry run / testing).
- WhatsAppCloudNotifier: Meta WhatsApp Business Cloud API, 1:1 messages.
- WebhookNotifier: POSTs JSON to n8n, Make, Zapier or a group-capable WhatsApp provider.
"""

from __future__ import annotations

import json
import logging
import os
import urllib.request
from dataclasses import dataclass, field

from .config import Member

log = logging.getLogger(__name__)


class Notifier:
    def send_direct(self, member: Member, text: str) -> None:
        raise NotImplementedError

    def send_group(self, chat_id: str, text: str, mention: list[Member]) -> None:
        """Post in the group. Providers that cannot post to groups DM each person instead."""
        for m in mention:
            self.send_direct(m, text)


@dataclass
class ConsoleNotifier(Notifier):
    sent: list[tuple[str, str]] = field(default_factory=list)

    def send_direct(self, member: Member, text: str) -> None:
        self.sent.append((member.name, text))
        print(f"[DM -> {member.name}] {text}")

    def send_group(self, chat_id: str, text: str, mention: list[Member]) -> None:
        self.sent.append((f"group:{chat_id}", text))
        print(f"[GROUP {chat_id}] {text}")


class WhatsAppCloudNotifier(Notifier):
    """Sends text messages through the official WhatsApp Business Cloud API.

    Free-form text only reaches people who messaged the business number in the
    last 24 hours. Outside that window Meta requires an approved template; set
    WHATSAPP_REMINDER_TEMPLATE to a template with one body variable ({{1}}).
    """

    def __init__(self, token: str | None = None, phone_number_id: str | None = None,
                 template: str | None = None, api_version: str = "v21.0"):
        self.token = token or os.environ["WHATSAPP_TOKEN"]
        self.phone_number_id = phone_number_id or os.environ["WHATSAPP_PHONE_NUMBER_ID"]
        self.template = template or os.environ.get("WHATSAPP_REMINDER_TEMPLATE")
        self.url = f"https://graph.facebook.com/{api_version}/{self.phone_number_id}/messages"

    def send_direct(self, member: Member, text: str) -> None:
        if self.template:
            payload = {
                "messaging_product": "whatsapp",
                "to": member.phone,
                "type": "template",
                "template": {
                    "name": self.template,
                    "language": {"code": "en_US"},
                    "components": [{"type": "body", "parameters": [{"type": "text", "text": text[:1000]}]}],
                },
            }
        else:
            payload = {"messaging_product": "whatsapp", "to": member.phone, "type": "text", "text": {"body": text}}
        _post_json(self.url, payload, {"Authorization": f"Bearer {self.token}"})


class WebhookNotifier(Notifier):
    """Hands every notification to an automation tool, which delivers it however you like."""

    def __init__(self, url: str | None = None):
        self.url = url or os.environ["NOTIFY_WEBHOOK_URL"]

    def send_direct(self, member: Member, text: str) -> None:
        _post_json(self.url, {"type": "direct", "to": member.phone, "name": member.name, "text": text})

    def send_group(self, chat_id: str, text: str, mention: list[Member]) -> None:
        _post_json(self.url, {"type": "group", "chat_id": chat_id, "text": text,
                              "mentions": [m.phone for m in mention]})


def _platform_id(member: Member, platform: str) -> str | None:
    prefix = platform + ":"
    return next((i[len(prefix):] for i in member.ids if i.startswith(prefix)), None)


class SlackNotifier(Notifier):
    """Slack bot (chat:write). DMs go to the member's "slack:U…" id."""

    def __init__(self, token: str | None = None):
        self.token = token or os.environ["SLACK_BOT_TOKEN"]

    def _post(self, channel: str, text: str) -> None:
        _post_json("https://slack.com/api/chat.postMessage", {"channel": channel, "text": text},
                   {"Authorization": f"Bearer {self.token}"})

    def owns(self, chat_id: str) -> bool:
        return chat_id[:1] in ("C", "G") and chat_id.isalnum()

    def send_direct(self, member: Member, text: str) -> None:
        if uid := _platform_id(member, "slack"):
            self._post(uid, text)
        else:
            log.warning("No slack id for %s; reminder not sent", member.name)

    def send_group(self, chat_id: str, text: str, mention: list[Member]) -> None:
        tags = " ".join(f"<@{u}>" for m in mention if (u := _platform_id(m, "slack")))
        self._post(chat_id, f"{text} {tags}".strip())


class TelegramNotifier(Notifier):
    """Telegram bot. DMs need the person to have started a chat with the bot once."""

    def __init__(self, token: str | None = None):
        self.token = token or os.environ["TELEGRAM_BOT_TOKEN"]

    def _post(self, chat_id: str, text: str) -> None:
        _post_json(f"https://api.telegram.org/bot{self.token}/sendMessage", {"chat_id": chat_id, "text": text})

    def owns(self, chat_id: str) -> bool:
        return chat_id.lstrip("-").isdigit() and chat_id.startswith("-")

    def send_direct(self, member: Member, text: str) -> None:
        if uid := _platform_id(member, "telegram"):
            self._post(uid, text)
        else:
            log.warning("No telegram id for %s; reminder not sent", member.name)

    def send_group(self, chat_id: str, text: str, mention: list[Member]) -> None:
        self._post(chat_id, text + ("\n" + ", ".join(m.name for m in mention) if mention else ""))


class GoogleChatNotifier(Notifier):
    """Posts into a Google Chat space through its incoming webhook, @mentioning people.

    Set GOOGLE_CHAT_WEBHOOKS to "spaces/AAA=https://chat.googleapis.com/v1/spaces/AAA/messages?key=...,..."
    A "direct" reminder is posted in the person's default space (GOOGLE_CHAT_DEFAULT_SPACE) with an @mention.
    """

    def __init__(self, webhooks: dict[str, str] | None = None, default_space: str | None = None):
        if webhooks is None:
            raw = os.environ.get("GOOGLE_CHAT_WEBHOOKS", "")
            webhooks = dict(pair.split("=", 1) for pair in raw.split(",") if "=" in pair)
        self.webhooks = webhooks
        self.default_space = default_space or os.environ.get("GOOGLE_CHAT_DEFAULT_SPACE") or next(iter(webhooks), None)

    def owns(self, chat_id: str) -> bool:
        return chat_id in self.webhooks

    @staticmethod
    def _mention(m: Member) -> str:
        uid = _platform_id(m, "gchat")
        return f"<{uid}>" if uid else m.name

    def send_direct(self, member: Member, text: str) -> None:
        if not self.default_space:
            log.warning("No Google Chat space configured; reminder for %s not sent", member.name)
            return
        _post_json(self.webhooks[self.default_space], {"text": f"{self._mention(member)} {text}"})

    def send_group(self, chat_id: str, text: str, mention: list[Member]) -> None:
        tags = " ".join(self._mention(m) for m in mention)
        _post_json(self.webhooks[chat_id], {"text": f"{text} {tags}".strip()})


class RoutingNotifier(Notifier):
    """Sends each person's reminders on their own platform (member.notify), group posts to the group's platform."""

    def __init__(self, channels: dict[str, Notifier], default: str):
        self.channels = channels
        self.default = default

    def send_direct(self, member: Member, text: str) -> None:
        channel = self.channels.get(member.notify) or self.channels[self.default]
        channel.send_direct(member, text)

    def send_group(self, chat_id: str, text: str, mention: list[Member]) -> None:
        for channel in self.channels.values():
            owns = getattr(channel, "owns", None)
            if owns and owns(chat_id):
                channel.send_group(chat_id, text, mention)
                return
        for m in mention:  # a group we can't post to: tell each person directly
            self.send_direct(m, text)


def _post_json(url: str, payload: dict, headers: dict | None = None) -> None:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", **(headers or {})},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        if resp.status >= 300:
            raise RuntimeError(f"Notification failed: HTTP {resp.status}")


BUILDERS = {
    "whatsapp": WhatsAppCloudNotifier,
    "webhook": WebhookNotifier,
    "slack": SlackNotifier,
    "telegram": TelegramNotifier,
    "google_chat": GoogleChatNotifier,
    "console": ConsoleNotifier,
}


def notifier_from_env() -> Notifier:
    """NOTIFIER is the default channel; NOTIFIERS lists every channel to enable, e.g. "whatsapp,slack,google_chat"."""
    default = os.environ.get("NOTIFIER", "console").lower()
    names = {n.strip().lower() for n in os.environ.get("NOTIFIERS", default).split(",") if n.strip()} | {default}
    channels = {name: BUILDERS[name]() for name in names}
    return channels[default] if len(channels) == 1 else RoutingNotifier(channels, default)
