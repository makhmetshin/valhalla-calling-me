from __future__ import annotations

from sqlalchemy import Engine, inspect, text

ADDED_COLUMNS: dict[str, dict[str, str]] = {
    "tracks": {"playlist_id": "INTEGER REFERENCES playlists(id)"},
    "tasks": {"group_id": "INTEGER REFERENCES task_groups(id)"},
}

ADDED_INDEXES: dict[str, dict[str, str]] = {
    "tasks": {"ix_tasks_group_id": "group_id"},
}


def apply_migrations(engine: Engine) -> None:
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    with engine.begin() as connection:
        for table, columns in ADDED_COLUMNS.items():
            if table not in tables:
                continue
            known = {column["name"] for column in inspector.get_columns(table)}
            for name, definition in columns.items():
                if name in known:
                    continue
                connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {definition}"))

        for table, indexes in ADDED_INDEXES.items():
            if table not in tables:
                continue
            for name, column in indexes.items():
                connection.execute(text(f"CREATE INDEX IF NOT EXISTS {name} ON {table} ({column})"))
