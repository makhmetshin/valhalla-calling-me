from __future__ import annotations

from fastapi import APIRouter, status

from valhalla.api.deps import DbSession
from valhalla.models import TabletKind, TabletPage
from valhalla.schemas.common import OrderUpdate
from valhalla.schemas.tablets import (
    TabletKindCreate,
    TabletKindRead,
    TabletKindUpdate,
    TabletPageCreate,
    TabletPageRead,
    TabletPageSummary,
    TabletPageUpdate,
)
from valhalla.services import tablets as service
from valhalla.services.repository import apply_order

router = APIRouter(prefix="/tablets", tags=["tablets"])


@router.get("/kinds", response_model=list[TabletKindRead])
def list_kinds(session: DbSession) -> list[TabletKindRead]:
    return service.list_kinds(session)


@router.post("/kinds", response_model=TabletKindRead, status_code=status.HTTP_201_CREATED)
def create_kind(session: DbSession, payload: TabletKindCreate) -> TabletKindRead:
    return service.create_kind(session, payload)


@router.patch("/kinds/{kind_id}", response_model=TabletKindRead)
def update_kind(session: DbSession, kind_id: int, payload: TabletKindUpdate) -> TabletKindRead:
    return service.update_kind(session, kind_id, payload)


@router.delete("/kinds/{kind_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_kind(session: DbSession, kind_id: int) -> None:
    service.delete_kind(session, kind_id)


@router.post("/kinds/order", response_model=list[TabletKindRead])
def reorder_kinds(session: DbSession, payload: OrderUpdate) -> list[TabletKindRead]:
    apply_order(session, TabletKind, payload.ids)
    return service.list_kinds(session)


@router.get("/kinds/{kind_id}/pages", response_model=list[TabletPageSummary])
def list_pages(session: DbSession, kind_id: int) -> list[TabletPageSummary]:
    return service.list_pages(session, kind_id)


@router.post("/pages", response_model=TabletPageRead, status_code=status.HTTP_201_CREATED)
def create_page(session: DbSession, payload: TabletPageCreate) -> TabletPageRead:
    return service.create_page(session, payload)


@router.get("/pages/{page_id}", response_model=TabletPageRead)
def get_page(session: DbSession, page_id: int) -> TabletPageRead:
    return service.get_page(session, page_id)


@router.patch("/pages/{page_id}", response_model=TabletPageRead)
def save_page(session: DbSession, page_id: int, payload: TabletPageUpdate) -> TabletPageRead:
    return service.save_page(session, page_id, payload)


@router.delete("/pages/{page_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_page(session: DbSession, page_id: int) -> None:
    service.delete_page(session, page_id)


@router.post("/pages/{page_id}/rows", response_model=TabletPageRead)
def add_row(session: DbSession, page_id: int) -> TabletPageRead:
    return service.add_row(session, page_id)


@router.post("/pages/order", response_model=list[TabletPageSummary])
def reorder_pages(
    session: DbSession, payload: OrderUpdate, kind_id: int
) -> list[TabletPageSummary]:
    apply_order(session, TabletPage, payload.ids)
    return service.list_pages(session, kind_id)
