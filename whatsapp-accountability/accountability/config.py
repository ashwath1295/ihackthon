"""Team roster and accountability policy, loaded from a TOML file."""

from __future__ import annotations

import tomllib
from dataclasses import dataclass, field
from datetime import time
from pathlib import Path
from zoneinfo import ZoneInfo


@dataclass
class Member:
    name: str
    phone: str  # E.164 digits, e.g. "15551234567"
    role: str = ""
    manager: str | None = None  # name of the person who gets escalations
    aliases: list[str] = field(default_factory=list)
    is_owner: bool = False  # the boss whose messages create instructions
    exempt: bool = False  # never expected to respond (e.g. a bot or an observer)


@dataclass
class Policy:
    ack_minutes: int = 15  # acknowledge within this many work minutes
    reminder_minutes: int = 30  # first reminder
    escalate_minutes: int = 60  # escalate to manager + owner
    urgent_ack_minutes: int = 5
    urgent_reminder_minutes: int = 10
    urgent_escalate_minutes: int = 20
    failure_threshold: int = 3  # missed acks that flag someone for review
    failure_window_days: int = 30
    timezone: str = "America/New_York"
    work_start: time = time(8, 0)
    work_end: time = time(18, 0)
    work_days: tuple[int, ...] = (0, 1, 2, 3, 4, 5)  # Mon=0 .. Sat=5
    group_no_response_alert: bool = True  # alert owner when nobody answers at all

    @property
    def tz(self) -> ZoneInfo:
        return ZoneInfo(self.timezone)

    def windows(self, urgent: bool) -> tuple[int, int, int]:
        if urgent:
            return self.urgent_ack_minutes, self.urgent_reminder_minutes, self.urgent_escalate_minutes
        return self.ack_minutes, self.reminder_minutes, self.escalate_minutes


@dataclass
class Settings:
    policy: Policy
    members: list[Member]
    db_path: str = "accountability.db"
    use_claude: bool = False
    claude_model: str = "claude-opus-5-5"

    @property
    def owner(self) -> Member:
        for m in self.members:
            if m.is_owner:
                return m
        raise ValueError("No member has is_owner = true in the config")

    def find_member(self, phone_or_name: str | None) -> Member | None:
        if not phone_or_name:
            return None
        key = normalize_phone(phone_or_name)
        for m in self.members:
            if key and normalize_phone(m.phone) == key:
                return m
        low = phone_or_name.strip().lower()
        for m in self.members:
            if m.name.lower() == low or low in (a.lower() for a in m.aliases):
                return m
        return None

    def responders(self) -> list[Member]:
        """Everyone who is expected to answer the owner's instructions."""
        return [m for m in self.members if not m.is_owner and not m.exempt]


def normalize_phone(value: str) -> str:
    return "".join(ch for ch in value if ch.isdigit())


def _parse_time(value: str) -> time:
    hh, mm = value.split(":")
    return time(int(hh), int(mm))


def load_settings(path: str | Path) -> Settings:
    data = tomllib.loads(Path(path).read_text())
    p = data.get("policy", {})
    policy = Policy(
        **{k: v for k, v in p.items() if k not in ("work_start", "work_end", "work_days")},
    )
    if "work_start" in p:
        policy.work_start = _parse_time(p["work_start"])
    if "work_end" in p:
        policy.work_end = _parse_time(p["work_end"])
    if "work_days" in p:
        policy.work_days = tuple(p["work_days"])

    members = [Member(**m) for m in data.get("members", [])]
    app = data.get("app", {})
    settings = Settings(
        policy=policy,
        members=members,
        db_path=app.get("db_path", "accountability.db"),
        use_claude=app.get("use_claude", False),
        claude_model=app.get("claude_model", "claude-opus-5-5"),
    )
    settings.owner  # fail fast if no owner is configured
    return settings
