import { describe, expect, it } from "vitest";
import { parseOrderDraftJson } from "../src/usecases/organizeOrderDraft.js";

describe("parseOrderDraftJson", () => {
  it("parses minimal GPT payload", () => {
    const payload = {
      customer_name: "A",
      customer_phone: "0912",
      receiver_name: "B",
      receiver_phone: "0922",
      pay_way: "CASH",
      total_amount: 1000,
      item: "rose",
      quantity: 1,
      note: "",
      card_message: "",
      shipment_method: "DELIVERY",
      send_datetime: null,
      receipt_address: "",
      delivery_address: "addr",
    };
    const upd = parseOrderDraftJson(JSON.stringify(payload));
    expect(upd?.customer_name).toBe("A");
    expect(upd?.delivery_address).toBe("addr");
  });
});
