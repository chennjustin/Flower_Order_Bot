import pytest

from app.adapters.llm.json_extract import JsonExtractError, extract_json_object


def test_extract_plain_json():
    assert extract_json_object('{"item": "rose"}') == {"item": "rose"}


def test_extract_markdown_fence():
    raw = 'Here is the result:\n```json\n{"total_amount": 2500}\n```'
    assert extract_json_object(raw) == {"total_amount": 2500}


def test_extract_embedded_json():
    raw = 'Sure! {"note": "粉白色系"} is the update.'
    assert extract_json_object(raw) == {"note": "粉白色系"}


def test_extract_empty_raises():
    with pytest.raises(JsonExtractError):
        extract_json_object("")
