import type { Db } from "../db/repositories.js";
import * as repo from "../db/repositories.js";
import { HttpError } from "../lib/httpError.js";
import { getOrderDraftOutByRoom } from "./orderService.js";
import { nowTaipeiNaiveSql } from "../utils/time.js";

const DEFAULT_VISIBLE_ORDER_FIELDS = [
  "id",
  "customer_name",
  "customer_phone",
  "receiver_name",
  "receiver_phone",
  "order_date",
  "pay_way",
  "total_amount",
  "item",
  "quantity",
  "note",
  "card_message",
  "shipment_method",
  "weekday",
  "send_datetime",
  "receipt_address",
  "delivery_address",
];

function normalizeVisible(fields: string[] | null | undefined): string[] {
  if (!fields?.length) return [...DEFAULT_VISIBLE_ORDER_FIELDS];
  const orderedUnique: string[] = [];
  for (const f of fields) {
    if (!orderedUnique.includes(f)) orderedUnique.push(f);
  }
  return orderedUnique;
}

export async function getOrInitStoreDisplayFields(db: Db, storeKey: string) {
  let config = await repo.storeDisplayByKey(db, storeKey);
  const t = nowTaipeiNaiveSql();
  if (!config) {
    config = await repo.insertStoreDisplay(db, {
      storeKey,
      visibleFields: [...DEFAULT_VISIBLE_ORDER_FIELDS],
      updatedByStaffId: null,
      createdAt: t,
      updatedAt: t,
    });
  }
  const visible_fields = normalizeVisible(config.visibleFields ?? undefined);
  return {
    store_key: config.storeKey,
    visible_fields,
    updated_by_staff_id: config.updatedByStaffId,
    updated_at: config.updatedAt,
  };
}

export async function updateStoreDisplayFields(
  db: Db,
  storeKey: string,
  visible_fields: string[],
  updated_by_staff_id: number | null | undefined,
) {
  const normalized = normalizeVisible(visible_fields);
  let config = await repo.storeDisplayByKey(db, storeKey);
  const t = nowTaipeiNaiveSql();
  if (!config) {
    config = await repo.insertStoreDisplay(db, {
      storeKey,
      visibleFields: normalized,
      updatedByStaffId: updated_by_staff_id ?? null,
      createdAt: t,
      updatedAt: t,
    });
  } else {
    await repo.updateStoreDisplayRow(db, config.id, {
      visibleFields: normalized,
      updatedByStaffId: updated_by_staff_id ?? null,
      updatedAt: t,
    });
    config = (await repo.storeDisplayByKey(db, storeKey))!;
  }
  return {
    store_key: config.storeKey,
    visible_fields: normalized,
    updated_by_staff_id: config.updatedByStaffId,
    updated_at: config.updatedAt,
  };
}

function filterPayload(payload: Record<string, unknown>, visible: string[]) {
  const out: Record<string, unknown> = {};
  for (const k of visible) {
    if (k in payload) out[k] = payload[k];
  }
  return out;
}

export async function getVisibleOrderDraftPayload(db: Db, storeKey: string, roomId: number) {
  const display = await getOrInitStoreDisplayFields(db, storeKey);
  const draft = await getOrderDraftOutByRoom(db, roomId);
  if (!draft) throw new HttpError(404, `Order draft for room ${roomId} not found.`);
  const payload = draft as unknown as Record<string, unknown>;
  return {
    store_key: storeKey,
    visible_fields: display.visible_fields,
    payload: filterPayload(payload, display.visible_fields),
  };
}
