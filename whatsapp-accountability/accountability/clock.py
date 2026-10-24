"""Work-hours math: timers only run during the team's assigned work hours."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from .config import Policy


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def work_minutes_between(start: datetime, end: datetime, policy: Policy, urgent: bool = False) -> float:
    """Minutes elapsed between start and end, counting only work hours.

    Urgent items run on the wall clock (on-call rule), not work hours.
    """
    if end <= start:
        return 0.0
    if urgent:
        return (end - start).total_seconds() / 60

    tz = policy.tz
    cur = start.astimezone(tz)
    stop = end.astimezone(tz)
    total = 0.0
    while cur.date() <= stop.date():
        if cur.weekday() in policy.work_days:
            day_open = cur.replace(hour=policy.work_start.hour, minute=policy.work_start.minute, second=0, microsecond=0)
            day_close = cur.replace(hour=policy.work_end.hour, minute=policy.work_end.minute, second=0, microsecond=0)
            lo = max(cur, day_open)
            hi = min(stop, day_close)
            if hi > lo:
                total += (hi - lo).total_seconds() / 60
        cur = (cur + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return total


def is_work_time(moment: datetime, policy: Policy) -> bool:
    local = moment.astimezone(policy.tz)
    return local.weekday() in policy.work_days and policy.work_start <= local.time() < policy.work_end
