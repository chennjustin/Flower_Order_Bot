"""Guardrail: backend catalog stays aligned with frontend ORDER_FIELD_REGISTRY."""

from __future__ import annotations

import re
from pathlib import Path

from app.domain.order_fields import (
    ALL_CATALOG_KEYS,
    CORE_ORGANIZE_FIELDS,
    FIELD_LABELS,
    FIXED_VISIBLE_FIELDS,
    OPTIONAL_ORGANIZE_FIELDS,
    OPTIONAL_VISIBLE_FIELDS,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_REGISTRY_PATH = (
    REPO_ROOT / "frontend" / "src" / "config" / "orderDisplayFields.ts"
)


_REGISTRY_ENTRY_RE = re.compile(
    r"key:\s*['\"]([^'\"]+)['\"],\s*label:\s*['\"]([^'\"]+)['\"]",
    re.MULTILINE,
)


def _parse_frontend_registry(path: Path) -> dict[str, str]:
    content = path.read_text(encoding="utf-8")
    pairs: list[tuple[str, str]] = [
        (match.group(1), match.group(2))
        for match in _REGISTRY_ENTRY_RE.finditer(content)
    ]
    seen_keys: set[str] = set()
    duplicate_keys: list[str] = []
    for key, _label in pairs:
        if key in seen_keys:
            duplicate_keys.append(key)
        else:
            seen_keys.add(key)
    assert not duplicate_keys, f"Duplicate registry keys: {sorted(set(duplicate_keys))}"
    return dict(pairs)


def test_frontend_registry_file_exists() -> None:
    assert FRONTEND_REGISTRY_PATH.is_file()


def test_backend_field_labels_match_frontend_registry() -> None:
    frontend = _parse_frontend_registry(FRONTEND_REGISTRY_PATH)
    assert set(frontend.keys()) == set(FIELD_LABELS.keys())
    for key, label in frontend.items():
        assert FIELD_LABELS[key] == label


def test_all_catalog_keys_partition_fixed_and_optional() -> None:
    assert set(ALL_CATALOG_KEYS) == set(FIXED_VISIBLE_FIELDS) | set(OPTIONAL_VISIBLE_FIELDS)
    assert set(FIXED_VISIBLE_FIELDS).isdisjoint(set(OPTIONAL_VISIBLE_FIELDS))


def test_organize_optional_fields_are_subset_of_optional_visible() -> None:
    assert set(OPTIONAL_ORGANIZE_FIELDS) <= set(OPTIONAL_VISIBLE_FIELDS)


def test_core_organize_fields_are_catalog_keys() -> None:
    for key in CORE_ORGANIZE_FIELDS:
        assert key in FIELD_LABELS


def test_default_field_order_matches_frontend_registry_sequence() -> None:
    from app.domain.order_fields import DEFAULT_FIELD_ORDER

    frontend = _parse_frontend_registry(FRONTEND_REGISTRY_PATH)
    frontend_keys = list(frontend.keys())
    assert list(DEFAULT_FIELD_ORDER) == frontend_keys
    assert len(frontend_keys) == len(FIELD_LABELS)
