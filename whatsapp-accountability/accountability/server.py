"""Web service: WhatsApp webhooks in, live dashboard and reports out.

Run with:  python -m accountability serve --config config.toml
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import html
import logging
import os
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, PlainTextResponse

from .clock import utcnow
from .config import Settings
from .db import connect
from .enforcer import Enforcer
from .ingest.generic import parse_generic
from .ingest.whatsapp_cloud import parse_webhook
from .notifier import Notifier
from .reports import render_markdown, scorecards, unresolved
from .tracker import Tracker

log = logging.getLogger(__name__)


def create_app(settings: Settings, notifier: Notifier, tick_seconds: int = 60) -> FastAPI:
    conn = connect(settings.db_path)
    lock = threading.Lock()
    tracker = Tracker(conn, settings)
    enforcer = Enforcer(conn, settings, notifier)

    async def ticker():
        while True:
            try:
                with lock:
                    for event in enforcer.tick(utcnow()):
                        log.info("enforcer: %s", event)
            except Exception:
                log.exception("enforcer tick failed")
            await asyncio.sleep(tick_seconds)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        task = asyncio.create_task(ticker()) if tick_seconds > 0 else None
        yield
        if task:
            task.cancel()

    app = FastAPI(title="WhatsApp Accountability", lifespan=lifespan)

    def require_token(request: Request, env_var: str) -> None:
        expected = os.environ.get(env_var)
        if not expected:
            return
        supplied = request.query_params.get("token") or request.headers.get("authorization", "").removeprefix("Bearer ")
        if not hmac.compare_digest(supplied, expected):
            raise HTTPException(status_code=401, detail="Invalid token")

    # ---------------------------------------------------------------- WhatsApp Cloud API

    @app.get("/webhook/whatsapp")
    def verify(request: Request):
        q = request.query_params
        if q.get("hub.mode") == "subscribe" and q.get("hub.verify_token") == os.environ.get("WHATSAPP_VERIFY_TOKEN"):
            return PlainTextResponse(q.get("hub.challenge", ""))
        raise HTTPException(status_code=403, detail="Verification failed")

    @app.post("/webhook/whatsapp")
    async def whatsapp_webhook(request: Request):
        body = await request.body()
        secret = os.environ.get("WHATSAPP_APP_SECRET")
        if secret:
            sig = request.headers.get("x-hub-signature-256", "")
            expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
            if not hmac.compare_digest(sig, expected):
                raise HTTPException(status_code=401, detail="Bad signature")
        results = []
        with lock:
            for msg in parse_webhook(await request.json()):
                results.append(tracker.ingest(msg))
        return {"ok": True, "results": results}

    # ---------------------------------------------------------------- any other provider

    @app.post("/webhook/generic")
    async def generic_webhook(request: Request):
        require_token(request, "INGEST_TOKEN")
        data = await request.json()
        items = data if isinstance(data, list) else [data]
        with lock:
            results = [tracker.ingest(parse_generic(item)) for item in items]
        return {"ok": True, "results": results}

    @app.post("/tick")
    def tick(request: Request):
        require_token(request, "INGEST_TOKEN")
        with lock:
            return {"events": enforcer.tick(utcnow())}

    # ---------------------------------------------------------------- dashboard + reports

    @app.get("/api/open")
    def api_open(request: Request):
        require_token(request, "DASHBOARD_TOKEN")
        with lock:
            return unresolved(conn, settings, utcnow())

    @app.get("/api/scorecard")
    def api_scorecard(request: Request, days: int = 7):
        require_token(request, "DASHBOARD_TOKEN")
        from datetime import timedelta
        now = utcnow()
        with lock:
            return [c.__dict__ for c in scorecards(conn, settings, now - timedelta(days=days), now)]

    @app.get("/report", response_class=PlainTextResponse)
    def report(request: Request, days: int = 1):
        require_token(request, "DASHBOARD_TOKEN")
        with lock:
            return render_markdown(conn, settings, utcnow(), days)

    @app.get("/", response_class=HTMLResponse)
    def dashboard(request: Request, days: int = 7):
        require_token(request, "DASHBOARD_TOKEN")
        from datetime import timedelta
        now = utcnow()
        with lock:
            items = unresolved(conn, settings, now)
            cards = scorecards(conn, settings, now - timedelta(days=days), now)
        return _render_dashboard(items, cards, days)

    return app


def _render_dashboard(items: list[dict], cards: list, days: int) -> str:
    e = html.escape
    expected = sum(i["expected"] for i in items)
    acked = sum(i["acknowledged"] for i in items)
    open_rows = "".join(
        f"<tr class='{'urgent' if i['urgent'] else ''}'><td>{e(i['summary'][:140])}</td><td>{e(i['sent'])}</td>"
        f"<td>{i['age_work_min']} min</td><td>{i['acknowledged']}/{i['expected']}</td>"
        f"<td>{e(', '.join(i['silent'])) or '—'}</td><td>{'<br>'.join(e(t) for t in i['open_tasks']) or '—'}</td></tr>"
        for i in items
    ) or "<tr><td colspan='6'>Nothing open. Everyone is accounted for.</td></tr>"
    card_rows = "".join(
        f"<tr><td>{e(c.member)}</td><td><b>{c.score}</b></td><td class='r-{c.rating.split()[0].lower()}'>{c.rating}</td>"
        f"<td>{c.acknowledged}/{c.required}</td><td>{c.on_time}</td><td>{c.missed}</td>"
        f"<td>{c.median_ack_min if c.median_ack_min is not None else '—'}</td>"
        f"<td>{c.completed}/{c.tasks}</td><td>{c.overdue}</td><td>{c.escalations}</td></tr>"
        for c in cards
    )
    return f"""<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="refresh" content="60">
<title>Team Accountability</title>
<style>
:root {{ --bg:#f7f7f5; --fg:#1d1d1f; --muted:#6b6b70; --card:#fff; --line:#e3e3e0; --red:#c0392b; --amber:#b9770e; --green:#1e8449; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg:#141416; --fg:#f2f2f2; --muted:#a0a0a8; --card:#1e1e22; --line:#2e2e34; }} }}
body {{ margin:0; padding:16px; font:15px/1.45 system-ui,sans-serif; background:var(--bg); color:var(--fg); }}
h1 {{ margin:0 0 4px; font-size:22px; }} h2 {{ font-size:17px; margin:28px 0 8px; }}
.kpis {{ display:flex; gap:12px; flex-wrap:wrap; margin:16px 0; }}
.kpi {{ background:var(--card); border:1px solid var(--line); border-radius:10px; padding:12px 16px; min-width:120px; }}
.kpi b {{ display:block; font-size:26px; }} .kpi span {{ color:var(--muted); font-size:13px; }}
.wrap {{ overflow-x:auto; background:var(--card); border:1px solid var(--line); border-radius:10px; }}
table {{ border-collapse:collapse; width:100%; }} th,td {{ text-align:left; padding:8px 10px; border-bottom:1px solid var(--line); vertical-align:top; }}
th {{ font-size:12px; text-transform:uppercase; color:var(--muted); }}
tr.urgent td:first-child {{ border-left:4px solid var(--red); }}
.r-at {{ color:var(--red); font-weight:600; }} .r-needs {{ color:var(--amber); font-weight:600; }} .r-reliable {{ color:var(--green); }}
</style></head><body>
<h1>Team Accountability</h1><div style="color:var(--muted)">Auto-refreshes every minute · scorecard covers the last {days} days</div>
<div class="kpis">
 <div class="kpi"><b>{len(items)}</b><span>Unresolved messages</span></div>
 <div class="kpi"><b>{acked}/{expected}</b><span>Acknowledged on open items</span></div>
 <div class="kpi"><b>{sum(1 for c in cards if c.rating == 'At risk')}</b><span>People at risk</span></div>
</div>
<h2>Unanswered and unresolved</h2>
<div class="wrap"><table><tr><th>Message</th><th>Sent</th><th>Age</th><th>Acked</th><th>Silent</th><th>Open tasks</th></tr>{open_rows}</table></div>
<h2>Scorecard (lowest first)</h2>
<div class="wrap"><table><tr><th>Person</th><th>Score</th><th>Rating</th><th>Responded</th><th>On time</th><th>Missed</th><th>Median ack (min)</th><th>Tasks done</th><th>Overdue</th><th>Escalated</th></tr>{card_rows}</table></div>
</body></html>"""
