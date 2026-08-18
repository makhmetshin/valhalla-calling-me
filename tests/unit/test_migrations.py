from __future__ import annotations

import sqlite3

from sqlalchemy import create_engine, inspect, text

from valhalla.db.migrations import ADDED_COLUMNS, ADDED_INDEXES, apply_migrations


def columns_of(path, table):
    with sqlite3.connect(path) as connection:
        return {row[1] for row in connection.execute(f"PRAGMA table_info({table})")}


def indexes_of(path, table):
    with sqlite3.connect(path) as connection:
        return {row[1] for row in connection.execute(f"PRAGMA index_list({table})")}


def old_database(tmp_path):
    path = tmp_path / "valhalla.db"
    with sqlite3.connect(path) as connection:
        connection.execute("CREATE TABLE tracks (id INTEGER PRIMARY KEY, title TEXT)")
        connection.execute("CREATE TABLE playlists (id INTEGER PRIMARY KEY, name TEXT)")
        connection.execute("CREATE TABLE tasks (id INTEGER PRIMARY KEY, title TEXT)")
        connection.execute("INSERT INTO tracks (title) VALUES ('Old Song')")
        connection.execute("INSERT INTO tasks (title) VALUES ('Наколоть дров')")
        connection.execute(
            """
            CREATE TABLE codex_chapters (
                id INTEGER NOT NULL,
                title VARCHAR(200) NOT NULL,
                icon_id INTEGER,
                CONSTRAINT pk_codex_chapters PRIMARY KEY (id),
                CONSTRAINT fk_codex_chapters_icon_id_media_assets
                    FOREIGN KEY(icon_id) REFERENCES media_assets (id) ON DELETE SET NULL
            )
            """
        )
        connection.execute("INSERT INTO codex_chapters (title) VALUES ('Путь')")
        connection.commit()
    return path


def test_missing_columns_are_added(tmp_path):
    path = old_database(tmp_path)
    engine = create_engine(f"sqlite:///{path.as_posix()}")

    apply_migrations(engine)
    engine.dispose()

    assert "playlist_id" in columns_of(path, "tracks")
    assert "group_id" in columns_of(path, "tasks")


def test_missing_indexes_are_added(tmp_path):
    path = old_database(tmp_path)
    engine = create_engine(f"sqlite:///{path.as_posix()}")

    apply_migrations(engine)
    apply_migrations(engine)
    engine.dispose()

    assert "ix_tasks_group_id" in indexes_of(path, "tasks")


def test_a_column_the_app_stopped_using_is_left_where_it_lies(tmp_path):
    path = old_database(tmp_path)
    engine = create_engine(f"sqlite:///{path.as_posix()}")

    apply_migrations(engine)
    with engine.begin() as connection:
        rows = list(connection.execute(text("SELECT title FROM codex_chapters")))
    engine.dispose()

    assert "icon_id" in columns_of(path, "codex_chapters")
    assert rows == [("Путь",)]


def test_rows_survive_the_migration(tmp_path):
    path = old_database(tmp_path)
    engine = create_engine(f"sqlite:///{path.as_posix()}")

    apply_migrations(engine)
    with engine.begin() as connection:
        rows = list(connection.execute(text("SELECT title, playlist_id FROM tracks")))
    engine.dispose()

    assert rows == [("Old Song", None)]


def test_running_twice_is_harmless(tmp_path):
    path = old_database(tmp_path)
    engine = create_engine(f"sqlite:///{path.as_posix()}")

    apply_migrations(engine)
    apply_migrations(engine)
    engine.dispose()

    assert "playlist_id" in columns_of(path, "tracks")


def test_unknown_tables_are_skipped(tmp_path):
    path = tmp_path / "empty.db"
    sqlite3.connect(path).close()
    engine = create_engine(f"sqlite:///{path.as_posix()}")

    apply_migrations(engine)
    names = set(inspect(engine).get_table_names())
    engine.dispose()

    assert names == set()


def test_every_planned_column_lands_on_a_real_table():
    import valhalla.models  # noqa: F401
    from valhalla.db.base import Base

    for table, columns in ADDED_COLUMNS.items():
        assert table in Base.metadata.tables
        assert set(columns) <= set(Base.metadata.tables[table].columns.keys())


def test_every_planned_index_lands_on_a_real_column():
    import valhalla.models  # noqa: F401
    from valhalla.db.base import Base

    for table, indexes in ADDED_INDEXES.items():
        assert table in Base.metadata.tables
        known = set(Base.metadata.tables[table].columns.keys())
        assert set(indexes.values()) <= known
