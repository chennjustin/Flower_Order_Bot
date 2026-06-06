from __future__ import annotations

from openai import APIConnectionError, APITimeoutError, OpenAIError, RateLimitError

from app.core.deps import get_openai_client

# Default model for order extraction flows (override via OPENAI_MODEL in Phase 3).
DEFAULT_LLM_MODEL = "gpt-4.1"
DEFAULT_LLM_TIMEOUT_SECONDS = 30.0


class LlmServiceUnavailableError(Exception):
    """Transient OpenAI failure (timeout, rate limit, connection)."""


def complete_system_prompt(
    prompt: str,
    *,
    model: str = DEFAULT_LLM_MODEL,
    temperature: float = 0,
    json_object: bool = True,
    timeout: float = DEFAULT_LLM_TIMEOUT_SECONDS,
) -> str:
    """Call OpenAI chat completions with optional JSON-object response format."""

    kwargs: dict = {
        "model": model,
        "messages": [{"role": "system", "content": prompt}],
        "temperature": temperature,
        "timeout": timeout,
    }
    if json_object:
        kwargs["response_format"] = {"type": "json_object"}

    try:
        response = get_openai_client().chat.completions.create(**kwargs)
    except (APITimeoutError, APIConnectionError, RateLimitError) as exc:
        raise LlmServiceUnavailableError(str(exc)) from exc
    except OpenAIError as exc:
        raise LlmServiceUnavailableError(str(exc)) from exc

    content = response.choices[0].message.content
    if not content:
        return ""
    return content.strip()
