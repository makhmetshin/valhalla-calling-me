from __future__ import annotations

from datetime import date, timedelta

from valhalla.db.base import now
from valhalla.models import MetricDirection, ReminderCadence, TaskState
from valhalla.schemas.achievements import AchievementCreate
from valhalla.schemas.metrics import MetricAdjust, MetricCreate
from valhalla.schemas.planning import PlanSlotWrite, PlanWrite
from valhalla.schemas.reminders import ReminderCreate
from valhalla.schemas.tasks import TaskCreate
from valhalla.services import achievements as achievement_service
from valhalla.services import metrics as metric_service
from valhalla.services import planning as planning_service
from valhalla.services import reminders as reminder_service
from valhalla.services import tasks as task_service


def make_metric(session, **overrides):
    payload = {"name": "Выходы из дома", "unit": "раз", "step": 1.0, "value": 0.0}
    payload.update(overrides)
    return metric_service.create_metric(session, MetricCreate(**payload))


def test_finishing_a_task_moves_its_metric(session):
    metric = make_metric(session)
    task = task_service.create_task(
        session,
        TaskCreate(title="Выйти на ветер", metric_id=metric.id, metric_delta=2.0),
    )

    task_service.set_state(session, task.id, TaskState.DONE)

    assert metric_service.list_metrics(session)[0].value == 2.0
    assert metric_service.history(session, metric.id)[0].note == "task: Выйти на ветер"


def test_a_task_pays_out_only_once(session):
    metric = make_metric(session)
    task = task_service.create_task(
        session, TaskCreate(title="Наколоть дров", metric_id=metric.id, metric_delta=1.0)
    )

    task_service.set_state(session, task.id, TaskState.DONE)
    task_service.set_state(session, task.id, TaskState.DONE)

    assert metric_service.list_metrics(session)[0].value == 1.0


def test_reopening_a_task_clears_the_stamp(session):
    task = task_service.create_task(session, TaskCreate(title="Прогулка"))

    task_service.set_state(session, task.id, TaskState.DONE)
    assert task_service.list_tasks(session, TaskState.DONE)[0].completed_at is not None

    task_service.set_state(session, task.id, TaskState.OPEN)
    assert task_service.list_tasks(session, TaskState.OPEN)[0].completed_at is None


def test_a_growing_metric_unlocks_its_achievement(session):
    metric = make_metric(session)
    achievement = achievement_service.create_achievement(
        session,
        AchievementCreate(title="Десять выходов", metric_id=metric.id, metric_target=3.0),
    )

    _, unlocked = metric_service.adjust_metric(session, metric.id, MetricAdjust(delta=3.0))

    assert [item.id for item in unlocked] == [achievement.id]
    assert achievement_service.list_achievements(session, unlocked=True)[0].unlocked_at is not None


def test_a_falling_metric_unlocks_when_it_drops(session):
    metric = make_metric(session, name="Сигарет в день", value=10.0, direction=MetricDirection.DOWN)
    achievement_service.create_achievement(
        session,
        AchievementCreate(title="Меньше пяти", metric_id=metric.id, metric_target=5.0),
    )

    _, still_locked = metric_service.adjust_metric(session, metric.id, MetricAdjust(value=7.0))
    _, unlocked = metric_service.adjust_metric(session, metric.id, MetricAdjust(value=4.0))

    assert still_locked == []
    assert [item.title for item in unlocked] == ["Меньше пяти"]


def test_progress_counts_what_is_taken(session):
    achievement_service.create_achievement(session, AchievementCreate(title="Раз"))
    second = achievement_service.create_achievement(session, AchievementCreate(title="Два"))

    achievement_service.set_unlocked(session, second.id, True)

    assert achievement_service.progress(session)["total"] == 2
    assert achievement_service.progress(session)["unlocked"] == 1


def test_a_plan_lays_out_its_slots(session):
    task = task_service.create_task(session, TaskCreate(title="Наколоть дров", units=2))
    plan = planning_service.save_plan(
        session,
        PlanWrite(
            plan_date=date(2026, 8, 14),
            title="Ровный день",
            unit_minutes=30,
            break_minutes=10,
            slots=[
                PlanSlotWrite(task_id=task.id, label="Дрова", units=2),
                PlanSlotWrite(label="Письмо", units=1),
            ],
        ),
    )

    read = planning_service.serialize_plan(plan)

    assert [slot.label for slot in read.slots] == ["Дрова", "Письмо"]
    assert [slot.units for slot in read.slots] == [2, 1]
    assert planning_service.get_plan_for_date(session, date(2026, 8, 14)).id == plan.id


def test_saving_the_same_day_twice_replaces_the_plan(session):
    for title in ("Первый", "Второй"):
        planning_service.save_plan(
            session, PlanWrite(plan_date=date(2026, 8, 14), title=title, slots=[])
        )

    plans = planning_service.list_plans(session)

    assert len(plans) == 1
    assert plans[0].title == "Второй"


def test_a_reminder_comes_due_when_its_hour_arrives(session):
    anchor = now() - timedelta(hours=3)
    reminder = reminder_service.create_reminder(
        session,
        ReminderCreate(title="Выпей воды", cadence=ReminderCadence.EVERY_HOUR, anchor_at=anchor),
    )

    assert reminder_service.due_signals(session) == []

    later = now() + timedelta(hours=2)
    assert [signal.reminder.id for signal in reminder_service.due_signals(session, later)] == [
        reminder.id
    ]


def test_answering_a_call_moves_it_on(session):
    reminder = reminder_service.create_reminder(
        session,
        ReminderCreate(
            title="Выпей воды",
            cadence=ReminderCadence.EVERY_HOUR,
            anchor_at=now() - timedelta(hours=3),
        ),
    )
    was = reminder.next_fire_at

    reminder_service.acknowledge(session, reminder.id)

    assert reminder_service.list_reminders(session)[0].fire_count == 1
    assert reminder_service.list_reminders(session)[0].next_fire_at >= was
    assert reminder_service.due_signals(session) == []


def test_a_one_off_reminder_falls_silent(session):
    reminder = reminder_service.create_reminder(
        session,
        ReminderCreate(
            title="Позвонить брату",
            cadence=ReminderCadence.ONCE,
            anchor_at=now() - timedelta(minutes=5),
        ),
    )

    assert [signal.reminder.id for signal in reminder_service.due_signals(session)] == [reminder.id]

    reminder_service.acknowledge(session, reminder.id)

    assert reminder_service.list_reminders(session)[0].is_active is False
    assert reminder_service.due_signals(session, now() + timedelta(days=2)) == []


def test_snooze_pushes_the_call_forward(session):
    reminder = reminder_service.create_reminder(
        session,
        ReminderCreate(
            title="Разминка",
            cadence=ReminderCadence.ONCE,
            anchor_at=now() - timedelta(minutes=5),
        ),
    )

    assert reminder_service.due_signals(session) != []

    reminder_service.snooze(session, reminder.id, 15)

    assert reminder_service.due_signals(session) == []


def test_a_reminder_can_point_at_a_metric(session):
    metric = make_metric(session)
    reminder_service.create_reminder(
        session,
        ReminderCreate(
            title="Отметь выход",
            cadence=ReminderCadence.ONCE,
            anchor_at=now() - timedelta(minutes=5),
            target_kind="metric",
            target_id=metric.id,
        ),
    )

    signal = reminder_service.due_signals(session)[0]

    assert signal.target_label == "Выходы из дома"
