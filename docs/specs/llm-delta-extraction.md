# Spec: LLM Delta Extraction (Prompt Robustness)

**Branch:** `feat/llm-delta-extraction`  
**Scope:** Backend (LLM adapter, prompts, use cases, schemas, tests). Frontend highlight UX is **out of scope** for this PR but API must expose `changed_fields`.  
**Depends on:** Existing `PATCH /organize_data/{room_id}` and `POST /orders/{order_id}/suggest-from-chat`.

---

## 1. Background

### 1.1 Current behavior

Both LLM flows share the same input pattern:

```
baseline (OrderDraft or formal Order) + unprocessed chat messages (processed=False)
```

The model is asked to output a **full JSON object** with every field present. The backend parses it and applies business rules (`_filter_update_by_required_fields`, customer name/phone lock, etc.).

### 1.2 Problems

| Issue | Impact |
|-------|--------|
| Full-object regeneration | Model may overwrite unchanged fields or clear values not mentioned in new messages |
| Double JSON encoding in draft flow | `json.dumps(draft.model_dump_json())` sends a quoted string instead of an object |
| Reversed message order | `reversed()` on ASC-sorted messages; confusing chronology |
| No empty-message guard | API called even when there is nothing new to process |
| Fragile `json.loads` | Markdown fences or prose around JSON cause 500 |
| Inconsistent errors | Draft failure returns 404 `"No data found"`; suggest returns 502 |
| No changed-field metadata | Frontend cannot highlight what AI modified (planned UX) |
| Phone fill-in blocked | Draft organize strips `customer_phone` in `_parse_order_draft_json` and prompt marks name/phone read-only; when baseline phone is empty and customer replies later, LLM output is discarded |
| Timezone mismatch | Prompt examples use UTC suffix `Z`; DB stores naive Asia/Taipei wall time (`TAIPEI_TZ`). Pickup/delivery `send_datetime` can be off by 8 hours |

### 1.3 Why Delta mode

1. **Model task fit:** Incremental updates should be *extraction*, not *copy entire state + patch*.
2. **Frontend UX (later):** Staff should see which fields AI changed. Delta + server-side diff enables `changed_fields` without guessing.

---

## 2. Goals

1. Switch both LLM flows to **delta extraction**: model outputs only fields changed by new messages.
2. **Server-side merge** is the source of truth; baseline values persist unless delta explicitly updates them.
3. Return **`changed_fields`** (catalog keys) in API responses so the frontend can highlight edits later.
4. Harden parsing (JSON extraction, JSON mode, validation) and fix known input bugs.
5. Keep existing user-facing flows: organize draft writes DB; suggest-from-chat remains preview-only.

### Non-goals (this PR)

- Frontend field highlighting UI
- Automatic LLM trigger from LINE bot
- MEM0 / memory integration
- Changing `organize_required_fields` or store field-config semantics

---

## 3. Core design: Delta + merge

### 3.1 Prompt structure (both templates)

Three explicit sections:

```
## Baseline
{pretty-printed JSON — current draft or order}

## New messages (N messages since last organize/suggest)
[timestamp] DIRECTION: text
...

## Output rules
- Output a single JSON object
- Include ONLY fields that new messages add or change
- Omit fields that stay the same as baseline
- To clear a string field, output "" or null
- Do not output customer_name (always locked; see §3.5)
- customer_phone: output ONLY when baseline phone is empty and new messages provide a number (see §3.5)
- All datetimes are Asia/Taipei (UTC+8) wall time (see §3.6)
```

### 3.2 Allowed delta fields

| Catalog key | Draft organize | Order suggest | Notes |
|-------------|----------------|---------------|-------|
| `customer_name` | **locked** | **locked** | Never from LLM; always Customer/User record |
| `customer_phone` | **fill-only** | **locked** | Draft: delta allowed only when baseline phone is empty; see §3.5 |
| `order_date` | from delta if present | **blocked** | Order: keep existing; Taipei time |
| `pay_way` | yes | yes | |
| `pay_status` | yes | yes | Enum validated |
| `total_amount` | yes | yes | Numeric |
| `item` | yes | yes | |
| `quantity` | yes | yes | Integer |
| `note` | yes | yes | |
| `shipment_method` | yes | yes | `STORE_PICKUP` \| `DELIVERY` |
| `send_datetime` | yes | yes | Asia/Taipei wall time; see §3.6 |
| `delivery_address` | yes | yes | |
| `order_status` | no | no | Not LLM-managed |

Fields not in store `organize_required_fields` are still accepted from delta but cleared by existing `_filter_update_by_required_fields` before persist (unchanged behavior).

### 3.3 Merge semantics

```text
merged = baseline
for each (field, value) in validated_delta:
    if field is allowed:
        merged[field] = normalize(field, value)
```

**Normalize examples:**

- `""` or `null` on optional string → `None` (clear)
- Invalid `pay_status` / `shipment_method` → skip field, log warning
- `customer_name` in delta → always ignore (defense in depth)
- `customer_phone` in delta → apply only under fill-only rule (§3.5)

**Explicit clear:** If the customer says "取消卡片內容" and delta has `"note": ""`, merged `note` becomes `None`/empty. Delta replaces the whole field value (not append). Append semantics are out of scope.

### 3.5 Customer identity rules (draft organize)

Staff often start a draft with the LINE display name prefilled but **no phone**. The bot may ask the customer to reply with their number; today that value never lands on the draft because both the prompt and `_parse_order_draft_json` block customer fields.

**Policy:**

| Field | Baseline state | LLM may output in delta? | Merge result |
|-------|----------------|--------------------------|--------------|
| `customer_name` | any (including empty) | **No** | Always keep baseline / Customer record |
| `customer_phone` | empty (`null`, `""`, whitespace only) | **Yes** | Use normalized phone from delta |
| `customer_phone` | non-empty | **No** | Keep baseline; ignore delta |

**Empty phone detection** (treat as fillable):

```python
def is_phone_empty(value: str | None) -> bool:
    return not (value or "").strip()
```

**Phone normalization** (before merge):

- Strip spaces and common separators (`-`, ` `).
- Accept Taiwan mobile patterns such as `09xxxxxxxx` (10 digits).
- Reject values that do not look like a phone number → skip field, log warning (do not fail the whole request).

**Persist side effect:** When merge sets `customer_phone` from delta, `update_order_draft_by_room_id` must run with `allow_customer_update=True` for that field so the linked `Customer.phone` stays in sync (same as manual staff edit).

**Prompt guidance** (draft template):

```
- customer_name: do not output; fixed from customer profile.
- customer_phone: output ONLY if baseline customer_phone is empty AND new messages contain a phone number.
  Example: customer replies "0912345678" or "我的電話是 0912-345-678".
- Never change an existing non-empty phone.
```

**Order suggest flow:** Both `customer_name` and `customer_phone` remain fully locked (formal order already committed).

### 3.6 Timezone: Asia/Taipei (UTC+8)

The backend stores naive datetimes interpreted as **Asia/Taipei wall time** (`app/core/time.py`: `TAIPEI_TZ`, `to_taipei_naive`, `to_taipei_aware`). The current prompt tells the model to emit `...Z` (UTC), which causes pickup/delivery times (`send_datetime`) to drift by 8 hours.

**Prompt must state explicitly:**

```
All dates and times in this task use Asia/Taipei (UTC+8, 台北時間).
Message timestamps below are already in Taipei local time.
When the customer says "明天下午三點取貨", interpret it as 15:00 on the next calendar day in Taipei, not UTC.
```

**Output format for `send_datetime` and `order_date`:**

| Rule | Detail |
|------|--------|
| Preferred JSON format | `YYYY-MM-DDTHH:MM:SS` (no `Z` suffix) |
| Also accept | `YYYY-MM-DDTHH:MM:SS+08:00` |
| Do not use | Bare `Z` / UTC unless customer explicitly states another timezone |

**Backend parse path:**

```python
# After JSON extract, normalize every datetime field:
merged.send_datetime = to_taipei_naive(parsed_send_datetime)
```

**Message timestamps in prompt** (§4.2): format as `[YYYY-MM-DD HH:MM:SS Asia/Taipei]` so the model does not assume UTC.

**Relative phrases:** When the customer says "後天中午"、"週六早上十點", the model resolves against **today's date in Taipei** (inject `reference_now` in prompt, e.g. `2026-06-06T14:30:00 Asia/Taipei`).

### 3.7 Changed fields

After merge, compute:

```python
changed_fields = [
    key for key in ALL_DELTA_KEYS
    if effective_value(baseline, key) != effective_value(merged, key)
]
```

Use the same catalog keys as `frontend/src/config/orderDisplayFields.ts` / `backend/app/domain/order_fields.py`.

Empty delta (no new messages or model returns `{}`) → `changed_fields = []`, response equals baseline.

---

## 4. Input assembly

### 4.1 Message selection

Unchanged: all `ChatMessage` where `room_id` matches and `processed=False`, ordered by `created_at ASC`.

### 4.2 Message formatting

```
[2026-06-06 14:25:00 Asia/Taipei] INCOMING: 預算提高到 2500
[2026-06-06 14:26:00 Asia/Taipei] OUTGOING_BY_STORE: 好的，幫您調整
[2026-06-06 14:28:00 Asia/Taipei] INCOMING: 要粉白色系
```

- **Chronological ascending** (remove `reversed()`).
- Format: `[timestamp Asia/Taipei] DIRECTION: text`
- Timestamps converted with `to_taipei_naive(m.created_at)` before formatting (DB naive values are already Taipei wall time).

### 4.3 Message sources for extraction

**Default (confirmed unless revised):** All directions (`INCOMING`, `OUTGOING_BY_STORE`, `OUTGOING_BY_BOT`) are included in the prompt as context. Extraction may use store messages when they state binding changes (e.g. staff confirms pickup → `shipment_method`).

### 4.4 Baseline serialization

```python
json.dumps(model.model_dump(mode="json"), ensure_ascii=False, indent=2)
```

Fixes the draft double-encoding bug. Order path already uses correct serialization.

### 4.5 Empty messages

When `processed=False` messages are empty:

| Flow | Behavior |
|------|----------|
| Draft organize | **200** — return current draft, `changed_fields=[]`, `source_message_ids=[]`; **do not call OpenAI** |
| Order suggest | **200** — return `suggested` equal to current order (no patch deltas), `changed_fields=[]`, `source_message_ids=[]`; **do not call OpenAI** |

---

## 5. LLM adapter

### 5.1 `complete_system_prompt` updates

| Parameter | Value |
|-----------|-------|
| `model` | `gpt-4.1` (hardcoded; env override deferred to Phase 3) |
| `temperature` | `0` |
| `response_format` | `{"type": "json_object"}` |
| `timeout` | 30s |

### 5.2 `extract_json_object(raw: str) -> dict`

Try in order:

1. `json.loads(raw.strip())`
2. Strip markdown ```json ... ``` fences, then parse
3. Regex extract first `{...}` block, then parse

Failure → treat as LLM parse error (502), not 500.

### 5.3 Retry (optional, Phase 1b)

One repair retry: send raw output back with "fix to valid JSON only". If still fails → 502.

---

## 6. API contract changes

### 6.1 `PATCH /organize_data/{room_id}`

**Response model (new):** `OrganizeOrderDraftOut`

```python
class OrganizeOrderDraftOut(BaseModel):
    draft: OrderDraftOut
    changed_fields: list[str] = []
    source_message_ids: list[int] = []
```

**Breaking change:** Response is no longer bare `OrderDraftOut`. Frontend `organizeData()` and `useOrganizeData` must read `data.draft`.

**Errors:**

| Condition | Status | detail |
|-----------|--------|--------|
| Room not found | 404 | 找不到聊天室 |
| LLM / JSON failure | 502 | LLM returned empty or invalid JSON |
| OpenAI transient error | 503 | LLM service unavailable |

Remove misleading 404 `"No data found"` for LLM failures.

**Side effects (unchanged):** Update draft, mark messages `processed=True`, LINE push if required fields missing.

### 6.2 `POST /orders/{order_id}/suggest-from-chat`

**Response model (extended):** `OrderSuggestFromChatOut`

```python
class OrderSuggestFromChatOut(BaseModel):
    suggested: OrderPatchUpdate
    changed_fields: list[str] = []
    source_message_ids: list[int] = []
```

`suggested` is the **merged preview** (same shape as today). `changed_fields` lists catalog keys differing from current order. Still **no DB write**.

---

## 7. Prompt files

| File | Role |
|------|------|
| `order_extraction_rules.txt` | Shared field definitions, types, semantics (extracted from current prompts) |
| `order_prompt.txt` | Draft: baseline + new messages + delta output rules |
| `order_update_prompt.txt` | Order: same + `order_date` read-only |

Remove "all fields must appear" rule. Replace with delta-only output rule.

---

## 8. Code layout

| Module | Responsibility |
|--------|----------------|
| `app/adapters/llm/openai_chat.py` | JSON mode, timeout |
| `app/adapters/llm/json_extract.py` | `extract_json_object` |
| `app/usecases/llm_order_delta.py` | `build_chat_text`, `serialize_baseline`, `parse_delta`, `merge_delta`, `merge_customer_phone_fill_only`, `normalize_taipei_datetime`, `compute_changed_fields` |
| `app/usecases/organize_order_draft.py` | Orchestrate draft flow; use shared delta module |
| `app/usecases/suggest_order_from_chat.py` | Orchestrate suggest flow; use shared delta module |
| `app/schemas/order.py` | `OrganizeOrderDraftOut`, extend `OrderSuggestFromChatOut` |
| `app/routes/organize_data.py` | Return new response model |

---

## 9. Implementation phases

### Phase 1 — Infrastructure + bug fixes

- `extract_json_object`, JSON mode, timeout
- Fix double encoding, message order, empty-message early return
- Unified 502/503 errors
- New response schemas (with `changed_fields`)
- Prompt rewrite to delta mode + shared rules file
- Shared merge/diff module
- **Customer phone fill-only** on draft organize (remove hard `customer_phone=None` in parser; conditional `allow_customer_update`)
- **Asia/Taipei timezone** in prompts, message timestamps, and datetime normalization (`to_taipei_naive`)
- Unit tests (no live OpenAI)
- Update `docs/CONTRACT.md`, frontend API types for breaking organize response

### Phase 2 — Frontend highlight (separate PR)

- Use `changed_fields` in `OrderEditPanel` / draft panel to style modified rows
- Out of scope for `feat/llm-delta-extraction`

### Phase 3 — Ops (optional)

- `OPENAI_MODEL` env var
- Structured logging
- Repair retry

---

## 10. Test plan

| Test | Covers |
|------|--------|
| `test_json_extract.py` | Plain JSON, fences, surrounding text |
| `test_llm_order_delta.py` | merge, normalize, changed_fields, phone fill-only, name locked |
| `test_llm_order_delta_timezone.py` | Taipei parse, no UTC drift on `send_datetime` |
| `test_usecase_parse_order_draft.py` | Update for delta parsing (partial dict) |
| `test_suggest_order_from_chat.py` | Merge + changed_fields |
| `test_organize_order_draft.py` (new) | Mock LLM; empty messages skip API |
| `test_openapi_contract.py` | Updated response models |

---

## 11. Open decisions (confirm before coding)

| # | Question | Proposed default |
|---|----------|------------------|
| A | Organize response breaking change (`{ draft, changed_fields }`) acceptable? | Yes — required for highlight UX |
| B | Empty messages → 200 with unchanged data (no OpenAI call)? | Yes |
| C | Include `OUTGOING_BY_STORE` / `OUTGOING_BY_BOT` in extraction context? | Yes |
| D | Field clear = full replace (not append)? | Yes |
| E | Phase 1 includes minimal frontend type fix for organize response only (no highlight UI)? | Yes — avoids runtime break |
| F | Draft: allow `customer_phone` fill-only when baseline empty; `customer_name` always locked? | Yes — matches staff workflow |
| G | All LLM datetimes interpreted as Asia/Taipei; prompt injects `reference_now`? | Yes — fixes pickup time drift |

---

## 12. Example end-to-end

**Baseline draft:** `item="母親節花束"`, `total_amount=2000`, `note=""`

**New messages:** `INCOMING: 預算改 2500，要粉白色系`

**LLM delta:**

```json
{ "total_amount": 2500, "note": "粉白色系" }
```

**Merged draft:** `item` unchanged, `total_amount=2500`, `note="粉白色系"`

**API response:**

```json
{
  "draft": { "...": "..." },
  "changed_fields": ["total_amount", "note"],
  "source_message_ids": [101, 102]
}
```

Frontend (later) highlights `total_amount` and `note` rows.

### 12.2 Phone fill-in (draft organize)

**Baseline draft:** `customer_name="王小明"` (from LINE), `customer_phone=""`

**Prior bot message (context):** `OUTGOING_BY_BOT: 請提供您的聯絡電話`

**New messages:** `INCOMING: 0912345678`

**LLM delta:**

```json
{ "customer_phone": "0912345678" }
```

**Merged draft:** `customer_name` unchanged, `customer_phone="0912345678"`

**API response:** `changed_fields: ["customer_phone"]`; `Customer.phone` updated in DB.

If baseline already had `customer_phone="0911222333"`, the same incoming message must **not** change phone (delta ignored).

### 12.3 Pickup time with Taipei timezone

**Reference now (in prompt):** `2026-06-06T10:00:00 Asia/Taipei`

**New messages:** `INCOMING: 明天下午三點來店取`

**LLM delta:**

```json
{ "shipment_method": "STORE_PICKUP", "send_datetime": "2026-06-07T15:00:00" }
```

**Merged:** pickup at 15:00 Taipei on 2026-06-07 (not `07:00:00Z` UTC).
