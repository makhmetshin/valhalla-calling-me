from __future__ import annotations

from fastapi import APIRouter, status

from valhalla.api.deps import DbSession
from valhalla.models import EntityKind
from valhalla.schemas.links import EntityRef, LinkCreate, LinkRead
from valhalla.services import links as service

router = APIRouter(prefix="/links", tags=["links"])


@router.get("/catalog", response_model=dict[str, list[EntityRef]])
def catalog(session: DbSession) -> dict[str, list[EntityRef]]:
    return service.catalog(session)


@router.get("", response_model=list[LinkRead])
def list_links(
    session: DbSession, kind: EntityKind | None = None, entity_id: int | None = None
) -> list[LinkRead]:
    return service.list_links(session, kind, entity_id)


@router.post("", response_model=LinkRead, status_code=status.HTTP_201_CREATED)
def create_link(session: DbSession, payload: LinkCreate) -> LinkRead:
    return service.create_link(session, payload)


@router.delete("/{link_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_link(session: DbSession, link_id: int) -> None:
    service.delete_link(session, link_id)
