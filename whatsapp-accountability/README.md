# WhatsApp Accountability System

**Goal:** Juan sends an instruction once. The system tracks who acknowledged it, who took ownership, who finished, and who went silent. It reminds people, escalates, and reports patterns, so Juan never has to repeat himself.

## What it tracks

| Juan wants to know | How the system handles it |
|---|---|
| Who responds and who doesn't | Every required person gets their own record per message. A reply, 👍 reaction, or quoted reply counts. |
| How long it takes to acknowledge | Acknowledgment time is measured in **work minutes** (the clock stops nights and Sundays). |
| Who repeatedly fails to respond | 3 missed deadlines in 30 days flags the person to Juan for review. |
| Who takes ownership and follows through | "On it" / "I'll handle it" = owned. "Done" + photo = completed. Saying "done" without the required photo = **awaiting proof** (not complete). |
| Which messages are still open | A live dashboard lists every unresolved message and who is still silent. |
| Nobody responds | Juan is alerted and the group gets a nudge. Then personal reminders, then escalation to the manager and Juan. |

## The rules (change them in `config.toml`)

| Step | Normal | Urgent ("urgent", "ASAP", 🚨) |
|---|---|---|
| Must acknowledge within | 15 work min | 5 min, 24/7 |
| Nobody answered → alert Juan + nudge the group | 15 min | 5 min |
| Personal reminder | 30 min | 10 min |
| Final notice + escalate to manager and Juan | 60 min | 20 min |
| Flag for review | 3 misses in 30 days | same |

- **Only the people who are required to answer are tracked.** "Everyone, confirm…" means all 17 people. "Bryan, send the photos" means only Bryan.
- **One message can hold several asks.** For example: *"Everyone, confirm you've reviewed today's priorities. Bryan, make sure the photos are submitted by 4 PM."* That creates an acknowledgment for all 17 people, plus a photo task for Bryan due at 4 PM that needs proof.
- **"Who can…?" questions** close as soon as one person steps up. Nobody else gets chased, and the person who stepped up owns the task.
- **No duplicate pings.** Each reminder and escalation goes out once.

## Try it now (2 minutes)

```bash
cd whatsapp-accountability
pip install -r requirements.txt
python -m accountability demo        # replays a sample week in an 18-person group
python -m pytest -q                  # 31 tests
```

## Execution map

### Phase 1: Use it today with your existing groups (no API needed)
1. `cp config.example.toml config.toml` and enter all 18 names and phone numbers. Set each person's manager, and add nicknames as `aliases`.
2. In WhatsApp, open the group → ⋮ → **Export chat** → *Without media*.
3. Run `python -m accountability --config config.toml import-export chat.txt --chat crew`.
4. Run `python -m accountability --config config.toml report --days 30 --out report.md --csv scorecard.csv`.

This gives you the accountability scorecard on past behavior right away. Re-export weekly until Phase 2 is live.

### Phase 2: Live tracking with automatic reminders
**Important limitation:** Meta's official WhatsApp API **cannot read an existing 18-person group.** Its Groups API only covers small groups that the API itself created. Pick one option:

| Option | How | Best for |
|---|---|---|
| **A. Group bridge provider** (Whapi.Cloud, Green API, Wassenger, Periskope) | The provider links a WhatsApp number that's in the group and forwards every message to `POST /webhook/generic` (map their fields to the shape in `accountability/ingest/generic.py`). | Keep the current group as is. Unofficial: test on a separate number first and review the provider's terms. |
| **B. Official Cloud API, 1:1** | Juan sends instructions to the business number, or a bot posts them and each person replies 1:1. Point the Meta webhook at `/webhook/whatsapp`. | Most reliable and fully official. |
| **C. Hybrid (recommended to start)** | Keep the group for discussion. Reminders and escalations go out 1:1 from the business number (`NOTIFIER=whatsapp`). | Best balance. |

Run the server (it also runs the reminder loop every minute):

```bash
export NOTIFIER=whatsapp                 # or webhook (n8n/Make/Zapier) or console (dry run)
export WHATSAPP_TOKEN=...                # Meta system user token
export WHATSAPP_PHONE_NUMBER_ID=...
export WHATSAPP_VERIFY_TOKEN=pick-any-string
export WHATSAPP_APP_SECRET=...           # verifies Meta's webhook signatures
export WHATSAPP_REMINDER_TEMPLATE=team_reminder   # approved template with one {{1}} variable
export INGEST_TOKEN=...                  # protects /webhook/generic and /tick
export DASHBOARD_TOKEN=...               # protects the dashboard: /?token=...
python -m accountability --config config.toml serve --port 8000
```

Deploy on Render, Railway, Fly.io, or any small VPS, behind HTTPS.

### Live dashboard (Google Sheets)
The interactive dashboard reads three Google Sheets in the Drive folder **Team Accountability (live data)**: `scorecard`, `open_messages` and `message_responses_v2`. Every time someone opens or refreshes it, it reads the sheets again. The tracker rewrites them every few minutes:

1. In Google Cloud, create a service account, turn on the Google Sheets API, and download its JSON key as `service-account.json`.
2. Share the three sheets with the service account's email as **Editor**.
3. Uncomment the `[sheets]` section in `config.toml` (the sheet ids are already filled in).
4. `serve` now pushes fresh numbers every `sync_minutes`. To push once by hand: `python -m accountability --config config.toml sync-sheets`.

### Phase 3: Smarter message reading (optional)
Set `use_claude = true` and `ANTHROPIC_API_KEY`. Claude then reads Juan's messages and works out who owes what, the deadlines, and urgency. If the API is unreachable, the built-in rules take over, so tracking never stops.

### Phase 4: Reports and decisions
- **Dashboard** at `/` shows open messages, who is silent, and the scorecard. It refreshes every minute.
- **Daily exceptions:** `report --days 1`. **Weekly scorecard:** `report --days 7 --csv week.csv`.
- **Patterns** it calls out: repeat no-shows, people who never take ownership, missed deadlines, slowest and fastest responders, and top performers.
- Cron example (Mon 8 AM weekly report): `0 8 * * 1 python -m accountability --config config.toml report --days 7 --out weekly.md`

### Launch checklist
- [ ] Fill in `config.toml` (all 18 people, managers, work hours, time zone)
- [ ] Import one exported chat and review the report with Juan
- [ ] Choose a live option (A, B or C) and connect the webhook
- [ ] Get a WhatsApp reminder template approved (needed for messages outside the 24-hour window)
- [ ] Pilot one group for one week with `NOTIFIER=console`, then switch on real reminders
- [ ] Announce the rules to the team (below)

### Message for the team (post this before going live)
> Starting Monday, every message from Juan that asks a question or gives an instruction is tracked automatically. Please reply within 15 minutes during work hours. "Got it", 👍, or replying to the message all count. When you take something on, say "on it". When it's done, say "done" and send the photo or proof if one was asked for. If there's no reply, the system sends a reminder at 30 minutes and escalates to your manager at 60 minutes. Missing 3 in a month gets flagged for review.

## How it works

```
WhatsApp ──► ingest (Cloud API / bridge / chat export)
               │
               ▼
          analyzer ── is this an instruction or question? who owes what? deadline? proof needed? urgent?
               │
               ▼
          tracker ─── one record per person: pending → acknowledged → owned → completed
               │
          enforcer (every minute) ── group alert → reminder → final notice + escalation → overdue → repeat-offender flag
               │
               ▼
          reports + dashboard ── scorecards, unresolved messages, patterns
```

| File | Purpose |
|---|---|
| `accountability/config.py` | Team roster and rules |
| `accountability/analyzer.py` | Reads owner messages and team replies (rules, or Claude) |
| `accountability/tracker.py` | Per-person acknowledgment and ownership records |
| `accountability/enforcer.py` | Reminders, escalations, overdue tasks, repeat-offender flags |
| `accountability/reports.py` | Scorecards, unresolved items, patterns |
| `accountability/server.py` | Webhooks, dashboard, JSON API |
| `accountability/notifier.py` | Delivery via the WhatsApp Cloud API, a webhook (n8n), or the console |
| `accountability/ingest/` | Cloud API, generic bridge, and chat-export parsers |

Data is stored in SQLite (`accountability.db`). To move to Postgres, Supabase, or THB WorkOS, port `db.py`; the SQL is standard.

**Privacy:** tell your team that work-group messages are tracked, and keep the database and dashboard access-controlled.
