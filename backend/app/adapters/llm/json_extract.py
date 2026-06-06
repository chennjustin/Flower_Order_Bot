from __future__ import annotations

import json
import re


class JsonExtractError(ValueError):
    """Raised when LLM output cannot be parsed as a JSON object."""


def extract_json_object(raw: str) -> dict:
    """Parse a JSON object from raw LLM text (plain, fenced, or embedded)."""

    if not raw or not raw.strip():
        raise JsonExtractError("Empty LLM response")

    text = raw.strip()

    # 1) Direct parse
    try:
        parsed = json.loads(text)
        if isinstance(parsed, dict):
            return parsed
    except json.JSONDecodeError:
        pass

    # 2) Markdown ```json ... ``` fence
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL | re.IGNORECASE)
    if fenced:
        try:
            parsed = json.loads(fenced.group(1))
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

    # 3) First {...} block in surrounding prose
    brace_match = re.search(r"\{.*\}", text, re.DOTALL)
    if brace_match:
        try:
            parsed = json.loads(brace_match.group(0))
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass

    raise JsonExtractError("LLM response is not a valid JSON object")
