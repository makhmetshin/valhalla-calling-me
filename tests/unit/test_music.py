from __future__ import annotations

from valhalla.models import Track
from valhalla.schemas.music import PlaylistCreate, PlaylistUpdate
from valhalla.services import media as media_service
from valhalla.services import music as service


def sync(session) -> int:
    media_service.scan_vault(session)
    return service.sync_playlists(session)


def test_creating_a_playlist_makes_a_folder(session, settings):
    playlist = service.create_playlist(session, PlaylistCreate(name="Поход к морю"))

    assert playlist.directory == "Поход к морю"
    assert (settings.playlists_dir / "Поход к морю").is_dir()


def test_awkward_names_become_safe_folders(session, settings):
    playlist = service.create_playlist(session, PlaylistCreate(name="Зима / лёд: 2026"))

    assert "/" not in playlist.directory
    assert ":" not in playlist.directory
    assert (settings.playlists_dir / playlist.directory).is_dir()


def test_upload_lands_inside_the_playlist_folder(session, settings, wav_bytes):
    playlist = service.create_playlist(session, PlaylistCreate(name="Поход"))

    track = service.import_upload(session, playlist.id, "01 - Odin - Storm Call.wav", wav_bytes())

    assert track.title == "Storm Call"
    assert track.artist == "Odin"
    assert track.playlist_id == playlist.id
    assert track.asset.relative_path.startswith("playlist/Поход/")
    stored = settings.audio_dir / track.asset.relative_path
    assert stored.is_file()


def test_folders_on_disk_become_playlists(session, settings, make_playlist_files):
    make_playlist_files(
        "Storm",
        ["02 - Odin - Winter Watch.wav", "01 - Odin - Thunder Road.wav"],
        cover="cover.png",
    )
    make_playlist_files("Calm", ["01 - Sigrun - Anchor Song.wav"])

    sync(session)

    playlists = {item.name: item for item in service.list_playlists(session)}
    assert sorted(playlists) == ["Calm", "Storm"]

    storm = service.serialize_playlist(session, playlists["Storm"])
    calm = service.serialize_playlist(session, playlists["Calm"])
    assert storm.cover_url.endswith("cover.png")
    assert calm.cover_url is None
    assert (storm.track_count, calm.track_count) == (2, 1)


def test_tracks_follow_filename_order_inside_a_playlist(session, make_playlist_files):
    make_playlist_files("Storm", ["02 - Odin - Winter Watch.wav", "01 - Odin - Thunder Road.wav"])
    sync(session)
    playlist = service.list_playlists(session)[0]

    inside = service.list_tracks(session, playlist.id)

    assert [track.title for track in inside] == ["Thunder Road", "Winter Watch"]


def test_the_general_list_is_alphabetical(session, make_playlist_files):
    make_playlist_files("Storm", ["02 - Odin - Winter Watch.wav", "01 - Odin - Thunder Road.wav"])
    make_playlist_files("Calm", ["01 - Sigrun - Anchor Song.wav"])
    sync(session)

    everything = service.list_tracks(session)

    assert [track.title for track in everything] == [
        "Anchor Song",
        "Thunder Road",
        "Winter Watch",
    ]


def test_loose_audio_outside_playlists_stays_out(session, settings, wav_bytes):
    (settings.audio_dir / "loose-bell.wav").write_bytes(wav_bytes())

    sync(session)

    assert service.list_tracks(session) == []


def test_syncing_twice_changes_nothing(session, make_playlist_files):
    make_playlist_files("Storm", ["01 - Odin - Thunder Road.wav"])

    first = sync(session)
    second = sync(session)

    assert first == 1
    assert second == 0
    assert len(service.list_tracks(session)) == 1


def test_renaming_a_playlist_moves_its_folder(session, settings, make_playlist_files):
    make_playlist_files("Storm", ["01 - Odin - Thunder Road.wav"])
    sync(session)
    playlist = service.list_playlists(session)[0]

    service.update_playlist(session, playlist.id, PlaylistUpdate(name="Буря"))

    assert (settings.playlists_dir / "Буря").is_dir()
    assert not (settings.playlists_dir / "Storm").exists()
    track = service.list_tracks(session, playlist.id)[0]
    assert track.asset.relative_path.startswith("playlist/Буря/")
    assert (settings.audio_dir / track.asset.relative_path).is_file()


def test_dropping_a_playlist_can_spare_the_files(session, settings, make_playlist_files):
    make_playlist_files("Storm", ["01 - Odin - Thunder Road.wav"])
    sync(session)
    playlist = service.list_playlists(session)[0]

    service.delete_playlist(session, playlist.id, with_files=False)

    assert service.list_playlists(session) == []
    assert (settings.playlists_dir / "Storm").is_dir()


def test_dropping_a_playlist_can_take_the_folder(session, settings, make_playlist_files):
    make_playlist_files("Storm", ["01 - Odin - Thunder Road.wav"])
    sync(session)
    playlist = service.list_playlists(session)[0]

    service.delete_playlist(session, playlist.id, with_files=True)

    assert not (settings.playlists_dir / "Storm").exists()
    assert service.list_tracks(session) == []


def test_orphaned_tracks_are_adopted_by_their_folder(session, make_playlist_files):
    make_playlist_files("Storm", ["01 - Odin - Thunder Road.wav"])
    sync(session)
    track = session.query(Track).one()
    track.playlist_id = None
    session.flush()

    sync(session)

    session.refresh(track)
    assert track.playlist_id is not None
    assert service.list_tracks(session, track.playlist_id)[0].id == track.id


def test_played_count_grows(session, make_playlist_files):
    make_playlist_files("Storm", ["01 - Odin - Thunder Road.wav"])
    sync(session)
    track = service.list_tracks(session)[0]

    service.mark_played(session, track.id)
    service.mark_played(session, track.id)

    assert service.list_tracks(session)[0].play_count == 2
    assert service.list_tracks(session)[0].last_played_at is not None
