"""
Regenerate backend/docs/工單模板.docx with docxtpl placeholders (catalog keys).

Run from backend/: PYTHONPATH=. python scripts/build_work_order_template.py
"""

from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.shared import Pt

# Label (Traditional Chinese UI) -> catalog key for docxtpl
FIELD_ROWS: list[tuple[str, str]] = [
    ("訂單編號", "id"),
    ("顧客姓名", "customer_name"),
    ("品項", "item"),
    ("數量", "quantity"),
    ("總金額", "total_amount"),
    ("備註", "note"),
    ("取貨方式", "shipment_method"),
    ("送貨地址", "delivery_address"),
    ("訂單日期", "order_date"),
    ("取貨時間", "send_datetime"),
    ("付款方式", "pay_way"),
    ("付款狀態", "pay_status"),
]

OUTPUT = Path(__file__).resolve().parents[1] / "docs" / "工單模板.docx"


def main() -> None:
    doc = Document()
    title = doc.add_paragraph("訂單工單")
    title.runs[0].font.size = Pt(16)
    title.runs[0].bold = True

    table = doc.add_table(rows=len(FIELD_ROWS), cols=2)
    table.style = "Table Grid"
    for row_idx, (label, key) in enumerate(FIELD_ROWS):
        row = table.rows[row_idx]
        row.cells[0].text = label
        row.cells[1].text = f"{{{{ {key} }}}}"

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(OUTPUT))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
