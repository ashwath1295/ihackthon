"""Read every message in your Google Chat spaces, signed in as you.

A Chat *app* only hears messages that @mention it. To track a whole space,
the tracker reads it with your own Google account instead (read-only):

  python -m accountability --config config.toml google-chat-login   # once, opens a browser
  python -m accountability --config config.toml google-chat-poll    # or let `serve` poll every minute

Senders are matched to the roster by their Workspace email, looked up in your
company directory, so members only need `email` set in config.toml.
"""

from __future__ import annotations

import logging
import sqlite3
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .platforms import parse_google_chat_message

log = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/chat.spaces.readonly",
    "https://www.googleapis.com/auth/chat.messages.readonly",
    "https://www.googleapis.com/auth/directory.readonly",
]
CHAT = "https://chat.googleapis.com/v1"
PEOPLE = "https://people.googleapis.com/v1"


def login(client_secrets: str, token_path: str) -> None:
    """One-time browser sign-in; saves a refreshable token."""
    from google_auth_oauthlib.flow import InstalledAppFlow

    flow = InstalledAppFlow.from_client_secrets_file(client_secrets, SCOPES)
    creds = flow.run_local_server(port=0, open_browser=True)
    Path(token_path).write_text(creds.to_json())


class GoogleChatPoller:
    def __init__(self, conn: sqlite3.Connection, token_path: str, spaces: list[str] | None = None, session=None):
        self.conn = conn
        self.token_path = token_path
        self.spaces = spaces or []
        self._session = session
        self._emails: dict[str, str] = {}
        conn.execute("CREATE TABLE IF NOT EXISTS poll_state (key TEXT PRIMARY KEY, value TEXT)")

    @property
    def session(self):
        if self._session is None:
            from google.auth.transport.requests import AuthorizedSession
            from google.oauth2.credentials import Credentials

            self._session = AuthorizedSession(Credentials.from_authorized_user_file(self.token_path, SCOPES))
        return self._session

    def _get(self, url: str, params: dict | None = None) -> dict:
        resp = self.session.get(url, params=params)
        if resp.status_code >= 300:
            raise RuntimeError(f"Google Chat API error: HTTP {resp.status_code} {resp.text[:200]}")
        return resp.json()

    def list_spaces(self) -> list[dict]:
        spaces, token = [], None
        while True:
            data = self._get(f"{CHAT}/spaces", {"pageSize": 1000, "pageToken": token} if token else {"pageSize": 1000})
            spaces += data.get("spaces", [])
            token = data.get("nextPageToken")
            if not token:
                return [s for s in spaces if s.get("spaceType") != "DIRECT_MESSAGE"]

    def email_for(self, user_name: str) -> str:
        """users/123 -> name@company.com via the Workspace directory (cached)."""
        if user_name not in self._emails:
            email = ""
            try:
                person = self._get(f"{PEOPLE}/people/{user_name.split('/')[-1]}",
                                   {"personFields": "emailAddresses", "sources": "DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE"})
                email = (person.get("emailAddresses") or [{}])[0].get("value", "")
            except RuntimeError as exc:
                log.warning("Could not look up %s: %s", user_name, exc)
            self._emails[user_name] = email
        return self._emails[user_name]

    def poll(self, now: datetime | None = None, lookback: timedelta = timedelta(days=1)):
        """Yield new messages since the last poll, oldest first, for every tracked space."""
        now = now or datetime.now(timezone.utc)
        spaces = [{"name": s} for s in self.spaces] if self.spaces else self.list_spaces()
        for space in spaces:
            key = f"gchat:{space['name']}"
            row = self.conn.execute("SELECT value FROM poll_state WHERE key = ?", (key,)).fetchone()
            since = row["value"] if row else (now - lookback).isoformat().replace("+00:00", "Z")
            newest, token = since, None
            while True:
                params = {"filter": f'createTime > "{since}"', "orderBy": "createTime asc", "pageSize": 1000}
                if token:
                    params["pageToken"] = token
                data = self._get(f"{CHAT}/{space['name']}/messages", params)
                for m in data.get("messages", []):
                    msg = parse_google_chat_message(m, space)
                    if msg is None:
                        continue
                    sender_id = (m.get("sender") or {}).get("name", "")
                    if not msg.sender_name and sender_id:
                        msg.sender_name = self.email_for(sender_id)
                    newest = max(newest, m.get("createTime", newest))
                    yield msg
                token = data.get("nextPageToken")
                if not token:
                    break
            self.conn.execute("INSERT OR REPLACE INTO poll_state (key, value) VALUES (?, ?)", (key, newest))
            self.conn.commit()
