from __future__ import annotations


def make_playlist(client, name="Поход"):
    response = client.post("/api/music/playlists", json={"name": name})
    assert response.status_code == 201, response.text
    return response.json()


def upload(client, playlist_id, filename, payload):
    return client.post(
        "/api/music/tracks/upload",
        data={"playlist_id": str(playlist_id), "title": ""},
        files={"file": (filename, payload, "audio/wav")},
    )


def test_a_playlist_is_a_folder(client, settings):
    playlist = make_playlist(client)

    assert playlist["name"] == "Поход"
    assert (settings.playlists_dir / "Поход").is_dir()
    assert client.get("/api/music/playlists").json()[0]["track_count"] == 0


def test_music_uploads_into_the_chosen_playlist(client, settings, wav_bytes):
    playlist = make_playlist(client)

    response = upload(client, playlist["id"], "01 - Odin - Storm Call.wav", wav_bytes())

    assert response.status_code == 201, response.text
    track = response.json()
    assert (track["title"], track["artist"]) == ("Storm Call", "Odin")
    assert track["playlist_id"] == playlist["id"]
    assert (settings.playlists_dir / "Поход").is_dir()
    assert client.get("/api/music/playlists").json()[0]["track_count"] == 1


def test_tracks_can_be_asked_for_by_playlist(client, wav_bytes):
    walk = make_playlist(client, "Поход")
    calm = make_playlist(client, "Покой")
    upload(client, walk["id"], "01 - Odin - Storm Call.wav", wav_bytes(196.0))
    upload(client, calm["id"], "01 - Sigrun - Anchor Song.wav", wav_bytes(262.0))

    inside = client.get(f"/api/music/tracks?playlist_id={walk['id']}").json()
    everything = client.get("/api/music/tracks").json()

    assert [track["title"] for track in inside] == ["Storm Call"]
    assert [track["title"] for track in everything] == ["Anchor Song", "Storm Call"]


def test_upload_needs_a_playlist(client, wav_bytes):
    response = client.post(
        "/api/music/tracks/upload",
        data={"title": ""},
        files={"file": ("song.wav", wav_bytes(), "audio/wav")},
    )

    assert response.status_code == 422


def test_a_playlist_can_go_without_its_folder(client, settings, wav_bytes):
    playlist = make_playlist(client)
    upload(client, playlist["id"], "01 - Odin - Storm Call.wav", wav_bytes())

    dropped = client.delete(f"/api/music/playlists/{playlist['id']}?with_files=false")

    assert dropped.status_code == 204
    assert (settings.playlists_dir / "Поход").is_dir()
    assert client.get("/api/music/playlists").json() == []


def test_scanning_the_vault_finds_folder_music(client, settings, wav_bytes):
    folder = settings.playlists_dir / "Storm"
    folder.mkdir(parents=True, exist_ok=True)
    (folder / "01 - Odin - Thunder Road.wav").write_bytes(wav_bytes())

    result = client.post("/api/vault/scan").json()

    assert result["tracks"] == 1
    assert [item["name"] for item in client.get("/api/music/playlists").json()] == ["Storm"]
    assert [track["title"] for track in client.get("/api/music/tracks").json()] == ["Thunder Road"]
