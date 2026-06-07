from unittest.mock import MagicMock, patch

import pytest

from app.utils.chat_image_storage import save_chat_image
from app.utils.supabase_storage import (
    _mint_service_role_jwt,
    _resolve_service_role_key,
    public_storage_url,
    upload_public_object,
)


def test_save_chat_image_builds_store_scoped_path():
    with patch("app.utils.chat_image_storage.upload_public_object") as upload:
        upload.return_value = (
            "https://example.supabase.co/storage/v1/object/public/chat-images/"
            "store_3/staff_chat/abc.jpg"
        )
        url = save_chat_image(
            store_id=3,
            raw=b"fake",
            content_type="image/jpeg",
            subdir="staff_chat",
        )

    assert "store_3/staff_chat/" in url
    args, kwargs = upload.call_args
    assert args[0].startswith("store_3/staff_chat/")
    assert args[1] == b"fake"
    assert args[2] == "image/jpeg"


def test_upload_public_object_posts_to_supabase():
    settings = MagicMock()
    settings.supabase_url = "https://example.supabase.co"
    settings.supabase_service_role_key = "service-role-key"
    settings.supabase_storage_bucket = "chat-images"

    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.text = ""

    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.post.return_value = mock_response

    with patch("app.utils.supabase_storage.get_settings", return_value=settings), patch(
        "app.utils.supabase_storage.httpx.Client",
        return_value=mock_client,
    ):
        url = upload_public_object(
            "store_1/line_images/test.jpg",
            b"bytes",
            "image/png",
        )

    assert url == (
        "https://example.supabase.co/storage/v1/object/public/"
        "chat-images/store_1/line_images/test.jpg"
    )
    mock_client.post.assert_called_once()
    call_kwargs = mock_client.post.call_args.kwargs
    assert call_kwargs["headers"]["Content-Type"] == "image/png"
    assert call_kwargs["content"] == b"bytes"


def test_public_storage_url_encodes_path_segments():
    settings = MagicMock()
    settings.supabase_url = "https://example.supabase.co"
    settings.supabase_service_role_key = "service-role-key"
    settings.supabase_storage_bucket = "chat-images"

    with patch("app.utils.supabase_storage.get_settings", return_value=settings):
        url = public_storage_url("store_1/staff_chat/file name.jpg")

    assert url.endswith("store_1/staff_chat/file%20name.jpg")


def test_resolve_service_role_key_prefers_explicit_key():
    key = _resolve_service_role_key(
        supabase_url="https://abc.supabase.co",
        explicit_key="explicit-key",
        jwt_secret="jwt-secret",
    )
    assert key == "explicit-key"


def test_mint_service_role_jwt_has_service_role_claim():
    token = _mint_service_role_jwt("secret", "abc")
    assert isinstance(token, str)
    assert len(token.split(".")) == 3


def test_upload_public_object_raises_on_failure():
    settings = MagicMock()
    settings.supabase_url = "https://example.supabase.co"
    settings.supabase_service_role_key = "service-role-key"
    settings.supabase_storage_bucket = "chat-images"

    mock_response = MagicMock()
    mock_response.status_code = 400
    mock_response.text = "bad request"

    mock_client = MagicMock()
    mock_client.__enter__.return_value = mock_client
    mock_client.post.return_value = mock_response

    with patch("app.utils.supabase_storage.get_settings", return_value=settings), patch(
        "app.utils.supabase_storage.httpx.Client",
        return_value=mock_client,
    ):
        with pytest.raises(RuntimeError, match="Supabase Storage upload failed"):
            upload_public_object("store_1/staff_chat/a.jpg", b"x", "image/jpeg")
