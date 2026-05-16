import type { Db } from "../db/repositories.js";
import * as repo from "../db/repositories.js";

export interface PaymentMethodOut {
  id: number;
  active: boolean;
  code: string;
  display_name: string;
  display_image_url: string | null;
  instructions: string;
  requires_manual_confirm: boolean;
}

function toBase(method: NonNullable<Awaited<ReturnType<typeof repo.paymentMethodById>>>): PaymentMethodOut {
  return {
    id: method.id,
    active: method.active,
    code: method.code,
    display_name: method.displayName,
    display_image_url: method.displayImageUrl,
    instructions: method.instructions ?? "",
    requires_manual_confirm: method.requiresManualConfirm,
  };
}

export async function getAllPaymentMethods(db: Db): Promise<PaymentMethodOut[]> {
  const methods = await repo.listPaymentMethods(db);
  return methods.filter((m) => m.active).map(toBase);
}

export async function togglePaymentMethodActive(db: Db, paymentMethodId: number): Promise<PaymentMethodOut | null> {
  const pm = await repo.paymentMethodById(db, paymentMethodId);
  if (!pm) return null;
  const updated = await repo.savePaymentMethodActive(db, paymentMethodId, !pm.active);
  return updated ? toBase(updated) : null;
}

export async function getPaymentMethodById(db: Db, paymentMethodId: number): Promise<PaymentMethodOut | null> {
  const pm = await repo.paymentMethodById(db, paymentMethodId);
  return pm ? toBase(pm) : null;
}
