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


def notifier_from_env() -> Notifier:
    mode = os.environ.get("NOTIFIER", "console").lower()
    if mode == "whatsapp":
        return WhatsAppCloudNotifier()
    if mode == "webhook":
        return WebhookNotifier()
    return ConsoleNotifier()
