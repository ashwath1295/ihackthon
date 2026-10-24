"""The Claude connector: a remote MCP server over the tracker's data.

Run:   python -m accountability --config config.toml connector --port 8001
Add in Claude: Settings → Connectors → Add custom connector →
       https://<your-server>/mcp/<CONNECTOR_TOKEN>

Once added on claude.ai it is available in every Claude app on that account
(web, desktop, iPhone/Android, Claude Code). All tools are read-only.
"""

from __future__ import annotations

import os
import secrets
import sqlite3
import threading
from datetime import timedelta

from mcp.server.mcpserver import MCPServer
from mcp.server.transport_security import TransportSecuritySettings

from .clock import utcnow
from .config import Settings
from .db import connect
from .exports import build_tables
from .reports import render_markdown

INSTRUCTIONS = """Team accountability tracker for Juan's team. It watches team group chats (WhatsApp, Google Chat,
Slack, Teams, Telegram), records who acknowledged each of Juan's instructions, how fast, who took
ownership and finished, and which messages are still unanswered. Use it to answer questions like
"who hasn't replied to my message this morning?", "how is Bryan's team doing this week?" or
"who keeps ignoring messages?". Times are work minutes (the clock stops outside work hours)."""


def build_server(settings: Settings, conn: sqlite3.Connection | None = None) -> MCPServer:
    conn = conn or connect(settings.db_path)
    lock = threading.Lock()
    server = MCPServer("Team Accountability", instructions=INSTRUCTIONS)

    def tables(days: int = 30) -> dict[str, list[dict]]:
        with lock:
            return build_tables(conn, settings, utcnow(), days)

    def in_team(name: str, team: str | None) -> bool:
        if not team:
            return True
        m = settings.find_member(name)
        return bool(m and m.manager and m.manager.lower() == team.lower())

    @server.tool(description="Messages from Juan that are still open: who has not acknowledged them and which tasks are unfinished. "
                             "Optionally only those involving one person, or one manager's team.")
    def get_open_messages(person: str | None = None, team: str | None = None) -> list[dict]:
        rows = tables()["open_messages"]
        if person:
            rows = [r for r in rows if person.lower() in r["silent"].lower() or person.lower() in r["open_tasks"].lower()]
        if team:
            rows = [r for r in rows if any(in_team(n.strip(), team) for n in r["silent"].split(",") if n.strip())]
        return rows

    @server.tool(description="Per-person accountability scorecard (0-100 score, rating, replies, misses, median reply time, "
                             "tasks done, overdue, escalations), lowest score first. Optionally one manager's team.")
    def get_scorecard(days: int = 30, team: str | None = None) -> list[dict]:
        return [r for r in tables(days)["scorecard"] if in_team(r["member"], team)]

    @server.tool(description="One person's record: their scorecard row and, for each message that needed their reply, "
                             "whether they answered on time, late or never.")
    def get_person(name: str, days: int = 30) -> dict:
        m = settings.find_member(name)
        if not m:
            return {"error": f"No one called {name} is on the roster.", "roster": [x.name for x in settings.members]}
        t = tables(days)
        history = []
        for r in t["message_responses"]:
            for status in ("on_time", "late", "silent"):
                if m.name in [n.strip() for n in r[f"{status}_names"].split(",")]:
                    history.append({"sent": r["sent"], "message": r["message"], "result": status, "status": r["status"]})
        card = next((c for c in t["scorecard"] if c["member"] == m.name), None)
        return {"name": m.name, "role": m.role, "manager": m.manager, "scorecard": card, "messages": history}

    @server.tool(description="Every message from Juan that needed a reply in the period, with who answered on time, late or never.")
    def get_messages(days: int = 7) -> list[dict]:
        return tables(days)["message_responses"]

    @server.tool(description="The full written accountability report (unresolved items, patterns, scorecard) as Markdown.")
    def get_report(days: int = 7) -> str:
        with lock:
            return render_markdown(conn, settings, utcnow(), days)

    @server.tool(description="The roster: names, roles, managers, and which chat platforms each person is tracked on.")
    def list_team() -> list[dict]:
        return [{"name": m.name, "role": m.role, "manager": m.manager, "owner": m.is_owner,
                 "platforms": sorted({i.split(":")[0] for i in m.ids} | ({"whatsapp"} if m.phone else set()))}
                for m in settings.members]

    @server.tool(description="Notifications the tracker sent recently (reminders, escalations, alerts that nobody answered).")
    def get_recent_alerts(hours: int = 24) -> list[dict]:
        since = (utcnow() - timedelta(hours=hours)).isoformat()
        with lock:
            rows = conn.execute(
                "SELECT kind, member AS recipient, text, sent_at FROM notifications WHERE sent_at >= ? ORDER BY sent_at DESC LIMIT 200",
                (since,),
            ).fetchall()
        return [dict(r) for r in rows]

    return server


def run_connector(settings: Settings, host: str, port: int) -> None:
    import uvicorn

    token = os.environ.get("CONNECTOR_TOKEN")
    if not token:
        token = secrets.token_urlsafe(24)
        print(f"No CONNECTOR_TOKEN set; using a one-time token: {token}")
    hosts = [h.strip() for h in os.environ.get("CONNECTOR_HOSTS", "").split(",") if h.strip()]
    security = TransportSecuritySettings(enable_dns_rebinding_protection=bool(hosts), allowed_hosts=hosts)
    app = build_server(settings).streamable_http_app(
        streamable_http_path=f"/mcp/{token}", stateless_http=True, json_response=True,
        transport_security=security, host=host,
    )
    print(f"Connector URL path: /mcp/{token}")
    uvicorn.run(app, host=host, port=port)
