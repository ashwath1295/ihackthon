from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from accountability.analyzer import analyze_owner_message_rules, classify_reply
from accountability.config import load_settings
from accountability.db import connect
from accountability.enforcer import Enforcer
from accountability.ingest.chat_export import parse_export
from accountability.ingest.whatsapp_cloud import parse_webhook
from accountability.models import IncomingMessage, ReplyKind
from accountability.notifier import ConsoleNotifier
from accountability.reports import render_markdown, scorecards
from accountability.tracker import Tracker

ROOT = Path(__file__).resolve().parent.parent
TZ = ZoneInfo("America/New_York")
MONDAY_9AM = datetime(2026, 10, 19, 9, 0, tzinfo=TZ)


@pytest.fixture
def env(tmp_path):
    settings = load_settings(ROOT / "config.example.toml")
    settings.db_path = str(tmp_path / "t.db")
    conn = connect(settings.db_path)
    notifier = ConsoleNotifier()
    return settings, Tracker(conn, settings), Enforcer(conn, settings, notifier), notifier, conn


_counter = iter(range(1, 10_000))


def msg(sender, text, at, **kw):
    return IncomingMessage(msg_id=f"m{next(_counter)}", chat_id="crew", sender=sender, text=text, timestamp=at, **kw)


def texts_to(notifier, name):
    return [t for who, t in notifier.sent if who == name]


# ------------------------------------------------------------------ analyzer

def test_juans_example_creates_two_requirements(env):
    settings, *_ = env
    a = analyze_owner_message_rules(
        msg("Juan", "Everyone, confirm you've reviewed today's construction priorities. "
                    "Bryan, make sure the photos are submitted by 4 PM.", MONDAY_9AM), settings)
    assert a.requires_response
    everyone = [i for i in a.items if not i.assignees]
    bryan = [i for i in a.items if i.assignees == ["Bryan"]]
    assert everyone and bryan
    assert bryan[0].needs_evidence
    assert bryan[0].deadline.astimezone(TZ).hour == 16


def test_chatter_and_fyi_need_no_response(env):
    settings, *_ = env
    assert not analyze_owner_message_rules(msg("Juan", "Good morning", MONDAY_9AM), settings).requires_response
    assert not analyze_owner_message_rules(msg("Juan", "FYI the dumpster comes Tuesday", MONDAY_9AM), settings).requires_response


def test_weekday_deadline(env):
    settings, *_ = env
    a = analyze_owner_message_rules(msg("Juan", "Everyone submit your hours by Friday EOD.", MONDAY_9AM), settings)
    deadline = a.items[0].deadline.astimezone(TZ)
    assert (deadline.weekday(), deadline.hour) == (4, 18)


@pytest.mark.parametrize("text,kind", [
    ("got it", ReplyKind.ACK), ("👍", ReplyKind.ACK), ("Copy that", ReplyKind.ACK),
    ("On it", ReplyKind.OWNERSHIP), ("I'll handle it", ReplyKind.OWNERSHIP), ("on my way", ReplyKind.OWNERSHIP),
    ("Done ✅", ReplyKind.DONE), ("Photos submitted", ReplyKind.DONE), ("not done yet", ReplyKind.OWNERSHIP),
    ("I can't get in, the lockbox is broken", ReplyKind.BLOCKED), ("Which house?", ReplyKind.QUESTION),
    ("lol", ReplyKind.OTHER),
])
def test_classify_reply(text, kind):
    assert classify_reply(text) is kind


# ------------------------------------------------------------------ tracking + enforcement

def test_reminder_then_escalation_and_no_duplicates(env):
    settings, tracker, enforcer, notifier, conn = env
    tracker.ingest(msg("Juan", "Everyone confirm you've reviewed the priorities.", MONDAY_9AM))
    for name in [m.name for m in settings.responders() if m.name != "Frank"]:
        tracker.ingest(msg(name, "got it", MONDAY_9AM + timedelta(minutes=5)))

    enforcer.tick(MONDAY_9AM + timedelta(minutes=20))
    assert texts_to(notifier, "Frank") == []  # past ack deadline, not yet reminder time

    enforcer.tick(MONDAY_9AM + timedelta(minutes=31))
    assert len(texts_to(notifier, "Frank")) == 1 and "Reminder" in texts_to(notifier, "Frank")[0]

    enforcer.tick(MONDAY_9AM + timedelta(minutes=61))
    enforcer.tick(MONDAY_9AM + timedelta(minutes=62))  # repeated ticks must not resend
    frank = texts_to(notifier, "Frank")
    assert len(frank) == 2 and "FINAL NOTICE" in frank[1]
    assert any("Frank" in t for t in texts_to(notifier, "Bryan"))  # Frank's manager
    assert any("still silent: Frank" in t for t in texts_to(notifier, "Juan"))

    row = conn.execute("SELECT missed_ack FROM assignments WHERE member='Frank'").fetchone()
    assert row["missed_ack"] == 1


def test_nobody_responds_alerts_owner_and_group(env):
    settings, tracker, enforcer, notifier, _ = env
    tracker.ingest(msg("Juan", "Team, please confirm the dumpster is ordered.", MONDAY_9AM))
    enforcer.tick(MONDAY_9AM + timedelta(minutes=16))
    assert any(who == "group:crew" for who, _ in notifier.sent)
    assert any("Nobody responded" in t for t in texts_to(notifier, "Juan"))


def test_timers_pause_outside_work_hours(env):
    settings, tracker, enforcer, notifier, _ = env
    friday_545pm = datetime(2026, 10, 23, 17, 45, tzinfo=TZ)
    tracker.ingest(msg("Juan", "Diego, please send the lumber invoice.", friday_545pm))
    enforcer.tick(datetime(2026, 10, 23, 22, 0, tzinfo=TZ))  # night: nothing sent
    assert notifier.sent == []
    enforcer.tick(datetime(2026, 10, 24, 8, 10, tzinfo=TZ))  # Saturday 8:10 = 25 work minutes
    assert notifier.sent == []
    enforcer.tick(datetime(2026, 10, 24, 8, 20, tzinfo=TZ))  # 35 work minutes: reminder
    assert len(texts_to(notifier, "Diego")) == 1


def test_urgent_runs_on_the_wall_clock(env):
    settings, tracker, enforcer, notifier, _ = env
    sunday_night = datetime(2026, 10, 25, 23, 0, tzinfo=TZ)
    tracker.ingest(msg("Juan", "URGENT: water leak at 88 Maple. Ricky, get there ASAP.", sunday_night))
    enforcer.tick(sunday_night + timedelta(minutes=11))
    assert len(texts_to(notifier, "Ricky")) == 1


def test_task_ownership_evidence_and_completion(env):
    settings, tracker, enforcer, notifier, conn = env
    tracker.ingest(msg("Juan", "Luis, send me before and after pictures of the kitchen by 5 PM.", MONDAY_9AM))
    tracker.ingest(msg("Luis", "On it", MONDAY_9AM + timedelta(minutes=3)))
    tracker.ingest(msg("Luis", "Done", MONDAY_9AM + timedelta(hours=2)))
    task = conn.execute("SELECT * FROM assignments WHERE kind='task'").fetchone()
    assert task["status"] == "awaiting_evidence"
    assert task["ack_minutes"] == 3.0

    tracker.ingest(msg("Luis", "", MONDAY_9AM + timedelta(hours=2, minutes=5), has_media=True))
    task = conn.execute("SELECT * FROM assignments WHERE kind='task'").fetchone()
    assert task["status"] == "completed" and task["evidence_msg_id"]
    assert conn.execute("SELECT resolved_at FROM requests").fetchone()["resolved_at"]


def test_overdue_task_is_escalated(env):
    settings, tracker, enforcer, notifier, _ = env
    tracker.ingest(msg("Juan", "Oscar, update the permit status by 11 AM.", MONDAY_9AM))
    tracker.ingest(msg("Oscar", "will do", MONDAY_9AM + timedelta(minutes=2)))
    enforcer.tick(MONDAY_9AM + timedelta(hours=2, minutes=1))
    assert any("OVERDUE" in t for t in texts_to(notifier, "Oscar"))
    assert any("Oscar" in t and "OVERDUE" in t for t in texts_to(notifier, "Juan"))


def test_volunteer_question_closes_when_someone_steps_up(env):
    settings, tracker, enforcer, notifier, conn = env
    tracker.ingest(msg("Juan", "Who can meet the inspector at 412 Elm tomorrow at 10?", MONDAY_9AM))
    tracker.ingest(msg("Carlos", "I'll handle it", MONDAY_9AM + timedelta(minutes=4)))
    enforcer.tick(MONDAY_9AM + timedelta(minutes=45))
    assert notifier.sent == []  # nobody else gets chased
    task = conn.execute("SELECT * FROM assignments WHERE kind='task'").fetchone()
    assert (task["member"], task["status"]) == ("Carlos", "owned")


def test_quoted_reply_and_reaction_link_to_the_right_message(env):
    settings, tracker, _, _, conn = env
    first = msg("Juan", "Everyone confirm the Monday safety meeting.", MONDAY_9AM)
    tracker.ingest(first)
    tracker.ingest(msg("Juan", "Everyone confirm you got the new lockbox codes.", MONDAY_9AM + timedelta(minutes=1)))
    tracker.ingest(msg("Grace", "👍", MONDAY_9AM + timedelta(minutes=2), reaction_to=first.msg_id))
    tracker.ingest(msg("Kevin", "yes", MONDAY_9AM + timedelta(minutes=3), quoted_msg_id=first.msg_id))
    acked = conn.execute(
        "SELECT a.member FROM assignments a JOIN requests r ON r.id=a.request_id "
        "WHERE r.msg_id=? AND a.ack_at IS NOT NULL", (first.msg_id,)).fetchall()
    assert {r["member"] for r in acked} == {"Grace", "Kevin"}


def test_repeat_offender_flagged_once(env):
    settings, tracker, enforcer, notifier, _ = env
    for day in range(3):
        start = MONDAY_9AM + timedelta(days=day)
        tracker.ingest(msg("Juan", f"Everyone confirm item {day}.", start))
        enforcer.tick(start + timedelta(minutes=16))
    enforcer.tick(MONDAY_9AM + timedelta(days=2, minutes=20))
    flags = [t for t in texts_to(notifier, "Juan") if "Flagged for management review" in t]
    assert len([t for t in flags if t.startswith("🚩 Frank")]) == 1


def test_scorecard_and_report(env):
    settings, tracker, enforcer, _, conn = env
    tracker.ingest(msg("Juan", "Everyone confirm the schedule.", MONDAY_9AM))
    tracker.ingest(msg("Maria", "got it", MONDAY_9AM + timedelta(minutes=2)))
    now = MONDAY_9AM + timedelta(hours=1)
    enforcer.tick(now)
    cards = {c.member: c for c in scorecards(conn, settings, MONDAY_9AM - timedelta(days=1), now)}
    assert cards["Maria"].acknowledged == 1 and cards["Maria"].median_ack_min == 2.0
    assert cards["Frank"].never_responded == 1 and cards["Frank"].missed == 1
    report = render_markdown(conn, settings, now, days=7)
    assert "Unanswered and unresolved" in report and "Frank" in report


def test_owner_messages_are_not_tracked_as_replies(env):
    settings, tracker, *_ = env
    assert tracker.ingest(msg("Juan", "thanks", MONDAY_9AM))["action"] == "no_response_needed"
    assert tracker.ingest(msg("Stranger", "hi", MONDAY_9AM))["action"] == "ignored"


# ------------------------------------------------------------------ ingest adapters

def test_parse_cloud_api_webhook():
    payload = {"entry": [{"changes": [{"value": {
        "contacts": [{"wa_id": "15550000002", "profile": {"name": "Bryan"}}],
        "messages": [
            {"from": "15550000002", "id": "wamid.1", "timestamp": "1760000000", "type": "text",
             "text": {"body": "got it"}, "context": {"id": "wamid.0"}},
            {"from": "15550000002", "id": "wamid.2", "timestamp": "1760000060", "type": "image",
             "image": {"caption": "done"}},
            {"from": "15550000002", "id": "wamid.3", "timestamp": "1760000070", "type": "reaction",
             "reaction": {"message_id": "wamid.0", "emoji": "👍"}},
        ]}}]}]}
    out = parse_webhook(payload)
    assert [m.msg_id for m in out] == ["wamid.1", "wamid.2", "wamid.3"]
    assert out[0].quoted_msg_id == "wamid.0" and out[0].sender_name == "Bryan"
    assert out[1].has_media and out[1].text == "done"
    assert out[2].reaction_to == "wamid.0"


def test_parse_iphone_export(tmp_path):
    f = tmp_path / "chat.txt"
    f.write_text(
        "[10/19/26, 8:05:00 AM] Juan: Everyone confirm\n"
        "the schedule please\n"
        "[10/19/26, 8:07:12 AM] Maria: Got it\n"
        "[10/19/26, 3:42:00 PM] Bryan: <attached: 00000012-PHOTO-2026-10-19.jpg>\n"
    )
    out = parse_export(f, "crew", TZ)
    assert len(out) == 3
    assert out[0].text == "Everyone confirm\nthe schedule please"
    assert out[2].has_media and out[2].text == ""
    assert out[2].timestamp.hour == 15


def test_sample_export_parses():
    out = parse_export(ROOT / "sample_data" / "crew_chat.txt", "crew", TZ)
    assert len(out) > 40 and out[0].sender == "Juan"


def test_server_webhook_and_dashboard(env, monkeypatch):
    from fastapi.testclient import TestClient

    from accountability.server import create_app

    settings, *_ = env
    monkeypatch.delenv("DASHBOARD_TOKEN", raising=False)
    monkeypatch.setenv("INGEST_TOKEN", "secret")
    client = TestClient(create_app(settings, ConsoleNotifier(), tick_seconds=0))

    body = {"msg_id": "g1", "chat_id": "crew", "sender": "15550000001",
            "text": "Everyone confirm the schedule.", "timestamp": "2026-10-19T13:00:00Z"}
    assert client.post("/webhook/generic", json=body).status_code == 401
    r = client.post("/webhook/generic", json=body, headers={"Authorization": "Bearer secret"})
    assert r.json()["results"][0]["action"] == "request_created"

    assert client.get("/").status_code == 200
    assert client.get("/api/open").json()[0]["expected"] == 17


def test_claude_failure_falls_back_to_rules(env, monkeypatch):
    from accountability import analyzer

    settings, *_ = env
    settings.use_claude = True

    def boom(*a, **k):
        raise RuntimeError("no API key")

    monkeypatch.setattr(analyzer, "analyze_owner_message_claude", boom)
    a = analyzer.analyze_owner_message(msg("Juan", "Everyone confirm the schedule.", MONDAY_9AM), settings)
    assert a.requires_response
