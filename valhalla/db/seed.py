from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from valhalla.models import (
    Achievement,
    AchievementGroup,
    CodexChapter,
    CodexEntry,
    MediaAsset,
    MediaOrigin,
    Metric,
)

PRESET_CHAPTERS: list[dict[str, object]] = [
    {
        "title": "Бестиарий",
        "summary": "Твари, что приходят в тумане. Назови зверя — и он потеряет часть силы.",
        "icon": "icons/wolf.svg",
        "entries": [
            {
                "title": "Фенрир. Тревога",
                "body": (
                    "Волк, которого нельзя убить, но можно связать.\n\n"
                    "Приходит без причины и требует, чтобы ты слушал только его. "
                    "Боги сковали его лентой из вещей, которых не существует: "
                    "шума кошачьих шагов, женской бороды, корней горы.\n\n"
                    "**Как связывают:** мелким, невозможным на вид действием. "
                    "Не победой, а одним шагом, который слишком мал, чтобы провалиться.\n\n"
                    "**Твои наблюдения:**\n"
                ),
            },
            {
                "title": "Нидхёгг. Апатия",
                "body": (
                    "Змей у корней Иггдрасиля. Не нападает — грызёт медленно, снизу.\n\n"
                    "Ты не замечаешь укуса. Замечаешь, что дерево больше не держит.\n\n"
                    "**Признаки:** утро без веса, задачи без размера, время без формы.\n\n"
                    "**Что держит корень:** вода, свет, движение, чужой голос.\n\n"
                    "**Твои наблюдения:**\n"
                ),
            },
            {
                "title": "Драугр. Прошлое",
                "body": (
                    "Мертвец, что не остался в кургане. Тяжёлый, синий, сильный после смерти.\n\n"
                    "Он приходит говорить о том, что уже случилось, и требует, "
                    "чтобы ты платил снова.\n\n"
                    "**Как усмиряют:** курган запечатывают. Записывают имя. Не спорят.\n\n"
                    "**Твои наблюдения:**\n"
                ),
            },
        ],
    },
    {
        "title": "Руны",
        "summary": "Малые знаки силы. Практики, которые работают, даже когда ты не веришь.",
        "icon": "icons/rune-stone.svg",
        "entries": [
            {
                "title": "Ур — сырая сила тела",
                "body": (
                    "Тело идёт первым, разум догоняет.\n\n"
                    "Холодная вода, вес, дыхание, десять шагов на ветру. "
                    "Разум спорит — тело не умеет спорить.\n\n"
                    "**Что сработало у тебя:**\n"
                ),
            },
            {
                "title": "Райдо — движение",
                "body": (
                    "Путь важнее цели, потому что цель ты сегодня не видишь.\n\n"
                    "Правило одного шага: сделай то, что займёт меньше двух минут, "
                    "и не оценивай результат.\n\n"
                    "**Что сработало у тебя:**\n"
                ),
            },
        ],
    },
    {
        "title": "Девять миров",
        "summary": "Области жизни. Каждый мир требует своей дани.",
        "icon": "icons/yggdrasil.svg",
        "entries": [
            {
                "title": "Мидгард — быт",
                "body": "Дом, еда, сон, деньги. Скучные боги, которые мстят первыми.\n\n",
            },
            {
                "title": "Асгард — смысл",
                "body": (
                    "То, ради чего стоит вставать. Пишется медленно и переписывается часто.\n\n"
                ),
            },
        ],
    },
    {
        "title": "Саги",
        "summary": "Твоя собственная летопись. Записывай, пока помнишь.",
        "icon": "icons/longship.svg",
        "entries": [
            {
                "title": "Как начать сагу",
                "body": (
                    "Скальд не ждёт вдохновения, он ждёт вечера.\n\n"
                    "Три строки: что было, что выдержал, что понял. "
                    "Этого достаточно, чтобы день перестал быть пустым.\n\n"
                ),
            }
        ],
    },
]

PRESET_GROUPS: list[dict[str, str]] = [
    {"name": "Первый поход", "description": "То, с чего начинается любой путь."},
    {"name": "Испытания", "description": "То, что не убивает и требует повторения."},
    {"name": "Долгий путь", "description": "Победы, которые считают неделями и месяцами."},
]

PRESET_METRICS: list[dict[str, object]] = [
    {"name": "Дни в пути", "unit": "дн.", "step": 1.0, "description": "Дни без отступления."},
    {"name": "Холодная вода", "unit": "раз", "step": 1.0, "description": "Испытания холодом."},
]

PRESET_ACHIEVEMENTS: list[dict[str, object]] = [
    {
        "title": "Проснулся и встал",
        "description": "Ты поднялся с постели до полудня. Это уже сражение.",
        "group": "Первый поход",
        "icon": "icons/dawn-horn.svg",
    },
    {
        "title": "Семь дней в пути",
        "description": "Неделя без отступления.",
        "group": "Долгий путь",
        "icon": "icons/longship.svg",
        "metric": "Дни в пути",
        "metric_target": 7.0,
    },
]


def _asset_id(session: Session, relative_path: str) -> int | None:
    return session.execute(
        select(MediaAsset.id).where(
            MediaAsset.origin == MediaOrigin.PRESET,
            MediaAsset.relative_path == relative_path,
        )
    ).scalar_one_or_none()


def seed_codex(session: Session) -> None:
    if session.execute(select(func.count()).select_from(CodexChapter)).scalar_one():
        return
    for position, chapter_data in enumerate(PRESET_CHAPTERS):
        chapter = CodexChapter(
            title=str(chapter_data["title"]),
            summary=str(chapter_data["summary"]),
            position=position,
            is_preset=True,
            icon_id=_asset_id(session, str(chapter_data["icon"])),
        )
        session.add(chapter)
        session.flush()
        for entry_position, entry_data in enumerate(chapter_data["entries"]):  # type: ignore[union-attr]
            session.add(
                CodexEntry(
                    chapter_id=chapter.id,
                    title=str(entry_data["title"]),
                    body=str(entry_data["body"]),
                    position=entry_position,
                    is_preset=True,
                )
            )
    session.flush()


def seed_progression(session: Session) -> None:
    if session.execute(select(func.count()).select_from(AchievementGroup)).scalar_one():
        return

    groups: dict[str, AchievementGroup] = {}
    for position, group_data in enumerate(PRESET_GROUPS):
        group = AchievementGroup(
            name=group_data["name"], description=group_data["description"], position=position
        )
        session.add(group)
        groups[group.name] = group

    metrics: dict[str, Metric] = {}
    for position, metric_data in enumerate(PRESET_METRICS):
        metric = Metric(
            name=str(metric_data["name"]),
            unit=str(metric_data["unit"]),
            step=float(metric_data["step"]),
            description=str(metric_data["description"]),
            position=position,
        )
        session.add(metric)
        metrics[metric.name] = metric
    session.flush()

    for position, achievement_data in enumerate(PRESET_ACHIEVEMENTS):
        metric_name = achievement_data.get("metric")
        session.add(
            Achievement(
                title=str(achievement_data["title"]),
                description=str(achievement_data["description"]),
                position=position,
                group_id=groups[str(achievement_data["group"])].id,
                icon_id=_asset_id(session, str(achievement_data["icon"])),
                metric_id=metrics[str(metric_name)].id if metric_name else None,
                metric_target=achievement_data.get("metric_target"),  # type: ignore[arg-type]
            )
        )
    session.flush()


def seed_all(session: Session) -> None:
    seed_codex(session)
    seed_progression(session)
