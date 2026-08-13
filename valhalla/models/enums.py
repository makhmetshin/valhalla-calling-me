from __future__ import annotations

from enum import StrEnum


class MediaKind(StrEnum):
    IMAGE = "image"
    AUDIO = "audio"
    VIDEO = "video"
    FONT = "font"


class MediaOrigin(StrEnum):
    PRESET = "preset"
    UPLOAD = "upload"


class EntityKind(StrEnum):
    ACHIEVEMENT = "achievement"
    ACHIEVEMENT_GROUP = "achievement_group"
    METRIC = "metric"
    TASK = "task"
    DAY_PLAN = "day_plan"
    REMINDER = "reminder"
    CODEX_CHAPTER = "codex_chapter"
    CODEX_ENTRY = "codex_entry"
    TRACK = "track"


class TaskState(StrEnum):
    OPEN = "open"
    ACTIVE = "active"
    DONE = "done"
    ABANDONED = "abandoned"


class MetricDirection(StrEnum):
    UP = "up"
    DOWN = "down"


class ReminderCadence(StrEnum):
    ONCE = "once"
    EVERY_15_MINUTES = "every_15_minutes"
    EVERY_HOUR = "every_hour"
    EVERY_3_HOURS = "every_3_hours"
    EVERY_6_HOURS = "every_6_hours"
    DAILY = "daily"


CADENCE_SECONDS: dict[ReminderCadence, int] = {
    ReminderCadence.EVERY_15_MINUTES: 15 * 60,
    ReminderCadence.EVERY_HOUR: 60 * 60,
    ReminderCadence.EVERY_3_HOURS: 3 * 60 * 60,
    ReminderCadence.EVERY_6_HOURS: 6 * 60 * 60,
    ReminderCadence.DAILY: 24 * 60 * 60,
}
