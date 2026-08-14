from __future__ import annotations

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from valhalla.db.base import Base, TimestampMixin
from valhalla.models.media import MediaAsset


class TabletKind(TimestampMixin, Base):
    __tablename__ = "tablet_kinds"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text, default="")
    position: Mapped[int] = mapped_column(default=0)
    icon_id: Mapped[int | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"), default=None
    )

    icon: Mapped[MediaAsset | None] = relationship(lazy="selectin")
    columns: Mapped[list[TabletColumn]] = relationship(
        back_populates="kind",
        cascade="all, delete-orphan",
        order_by="TabletColumn.position",
        lazy="selectin",
    )
    pages: Mapped[list[TabletPage]] = relationship(
        back_populates="kind", cascade="all, delete-orphan", order_by="TabletPage.position"
    )


class TabletColumn(Base):
    __tablename__ = "tablet_columns"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind_id: Mapped[int] = mapped_column(
        ForeignKey("tablet_kinds.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(120))
    position: Mapped[int] = mapped_column(default=0)

    kind: Mapped[TabletKind] = relationship(back_populates="columns")


class TabletPage(TimestampMixin, Base):
    __tablename__ = "tablet_pages"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind_id: Mapped[int] = mapped_column(
        ForeignKey("tablet_kinds.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    purpose: Mapped[str] = mapped_column(Text, default="")
    position: Mapped[int] = mapped_column(default=0)

    kind: Mapped[TabletKind] = relationship(back_populates="pages")
    rows: Mapped[list[TabletRow]] = relationship(
        back_populates="page",
        cascade="all, delete-orphan",
        order_by="TabletRow.position",
        lazy="selectin",
    )


class TabletRow(Base):
    __tablename__ = "tablet_rows"

    id: Mapped[int] = mapped_column(primary_key=True)
    page_id: Mapped[int] = mapped_column(
        ForeignKey("tablet_pages.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(default=0)

    page: Mapped[TabletPage] = relationship(back_populates="rows")
    cells: Mapped[list[TabletCell]] = relationship(
        back_populates="row", cascade="all, delete-orphan", lazy="selectin"
    )


class TabletCell(Base):
    __tablename__ = "tablet_cells"
    __table_args__ = (UniqueConstraint("row_id", "column_id", name="tablet_cell_slot"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    row_id: Mapped[int] = mapped_column(
        ForeignKey("tablet_rows.id", ondelete="CASCADE"), index=True
    )
    column_id: Mapped[int] = mapped_column(
        ForeignKey("tablet_columns.id", ondelete="CASCADE"), index=True
    )
    value: Mapped[str] = mapped_column(Text, default="")

    row: Mapped[TabletRow] = relationship(back_populates="cells")
