from __future__ import annotations

from app.core.deps import get_openai_client


def complete_system_prompt(prompt: str, *, model: str = "gpt-4.1", temperature: float = 0) -> str:
    response = get_openai_client().chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": prompt}],
        temperature=temperature,
    )
    return response.choices[0].message.content.strip()

