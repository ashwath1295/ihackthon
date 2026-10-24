"""Push the dashboard tables to Google Sheets so the live dashboard stays current.

Setup (once):
  1. Google Cloud console: create a service account, enable the Google Sheets API,
     download its JSON key.
  2. Share each sheet (scorecard, open_messages, message_responses) with the
     service account's email as Editor.
  3. Put the sheet ids and the key path in config.toml under [sheets].
"""

from __future__ import annotations

import logging
import sqlite3
from datetime import datetime

from .config import Settings, SheetsConfig
from .exports import TABLES, build_tables

log = logging.getLogger(__name__)

API = "https://sheets.googleapis.com/v4/spreadsheets"


def table_values(rows: list[dict]) -> list[list]:
    if not rows:
        return []
    header = list(rows[0].keys())
    return [header] + [[r.get(h, "") for h in header] for r in rows]


class SheetsSync:
    def __init__(self, config: SheetsConfig, session=None):
        self.config = config
        self._session = session

    @property
    def session(self):
        if self._session is None:
            from google.auth.transport.requests import AuthorizedSession
            from google.oauth2 import service_account

            creds = service_account.Credentials.from_service_account_file(
                self.config.credentials, scopes=["https://www.googleapis.com/auth/spreadsheets"]
            )
            self._session = AuthorizedSession(creds)
        return self._session

    def push(self, conn: sqlite3.Connection, settings: Settings, now: datetime) -> list[str]:
        """Replace each sheet's contents with the current table. Returns the tables written."""
        tables = build_tables(conn, settings, now)
        written = []
        for name in TABLES:
            sheet_id = self.config.sheet_ids.get(name)
            if not sheet_id:
                continue
            values = table_values(tables[name])
            # The first tab, whatever it is called: a bare A1 range targets it.
            self._check(self.session.post(f"{API}/{sheet_id}/values/A1:ZZ100000:clear", json={}))
            if values:
                self._check(self.session.put(
                    f"{API}/{sheet_id}/values/A1", params={"valueInputOption": "RAW"}, json={"values": values}
                ))
            written.append(name)
        return written

    @staticmethod
    def _check(resp) -> None:
        if resp.status_code >= 300:
            raise RuntimeError(f"Google Sheets update failed: HTTP {resp.status_code} {resp.text[:200]}")
