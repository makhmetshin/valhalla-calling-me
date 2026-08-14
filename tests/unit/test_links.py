from __future__ import annotations

import pytest

from valhalla.models import EntityKind
from valhalla.schemas.links import LinkCreate
from valhalla.schemas.metrics import MetricCreate
from valhalla.schemas.tablets import TabletColumnWrite, TabletKindCreate, TabletPageCreate
from valhalla.schemas.tasks import TaskCreate
from valhalla.services import links as service
from valhalla.services import metrics as metric_service
from valhalla.services import tablets as tablet_service
from valhalla.services import tasks as task_service
from valhalla.services.errors import ConflictError, NotFoundError


def test_every_kind_can_be_resolved(session):
    metric = metric_service.create_metric(session, MetricCreate(name="Сон", unit="ч", value=6.0))

    found = service.resolve(session, EntityKind.METRIC, metric.id)

    assert found.label == "Сон"
    assert found.detail == "6 ч"
    assert service.resolve(session, EntityKind.METRIC, 404) is None


def test_tablets_joined_the_catalogue(session):
    kind = tablet_service.create_kind(
        session,
        TabletKindCreate(title="Колесо баланса", columns=[TabletColumnWrite(title="Сфера")]),
    )
    tablet_service.create_page(session, TabletPageCreate(kind_id=kind.id, title="Август"))

    catalogue = service.catalog(session)

    assert [item.label for item in catalogue["tablet_kind"]] == ["Колесо баланса"]
    assert [item.label for item in catalogue["tablet_page"]] == ["Август"]
    assert catalogue["tablet_page"][0].detail == "Колесо баланса"


def test_a_link_binds_two_things(session):
    task = task_service.create_task(session, TaskCreate(title="Прогулка"))
    metric = metric_service.create_metric(session, MetricCreate(name="Шаги", unit="шт"))

    link = service.create_link(
        session,
        LinkCreate(
            source_kind=EntityKind.TASK,
            source_id=task.id,
            target_kind=EntityKind.METRIC,
            target_id=metric.id,
            note="считаю шаги",
        ),
    )

    assert link.source.label == "Прогулка"
    assert link.target.label == "Шаги"
    assert len(service.list_links(session, EntityKind.METRIC, metric.id)) == 1
    assert len(service.list_links(session, EntityKind.TASK, task.id)) == 1


def test_a_thing_cannot_be_linked_to_itself(session):
    task = task_service.create_task(session, TaskCreate(title="Прогулка"))
    payload = LinkCreate(
        source_kind=EntityKind.TASK,
        source_id=task.id,
        target_kind=EntityKind.TASK,
        target_id=task.id,
    )

    with pytest.raises(ConflictError):
        service.create_link(session, payload)


def test_the_same_link_is_not_made_twice(session):
    task = task_service.create_task(session, TaskCreate(title="Прогулка"))
    metric = metric_service.create_metric(session, MetricCreate(name="Шаги", unit="шт"))
    payload = LinkCreate(
        source_kind=EntityKind.TASK,
        source_id=task.id,
        target_kind=EntityKind.METRIC,
        target_id=metric.id,
    )
    service.create_link(session, payload)

    with pytest.raises(ConflictError):
        service.create_link(session, payload)


def test_linking_to_nothing_is_refused(session):
    task = task_service.create_task(session, TaskCreate(title="Прогулка"))

    with pytest.raises(NotFoundError):
        service.create_link(
            session,
            LinkCreate(
                source_kind=EntityKind.TASK,
                source_id=task.id,
                target_kind=EntityKind.METRIC,
                target_id=404,
            ),
        )
