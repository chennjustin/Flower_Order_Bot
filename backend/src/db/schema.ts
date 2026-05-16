import {
  pgEnum,
  pgTable,
  serial,
  integer,
  varchar,
  text,
  boolean,
  timestamp,
  numeric,
  smallint,
  json,
  index,
} from "drizzle-orm/pg-core";

export const notificationReceiverTypeEnum = pgEnum("notification_receiver_type", ["USER", "STAFF"]);
export const notificationChannelEnum = pgEnum("notification_channel", ["LINE", "EMAIL", "SMS"]);
export const notificationStatusEnum = pgEnum("notification_status", ["QUEUED", "SENT", "FAILED"]);
export const staffRoleEnum = pgEnum("staff_role", ["OWNER", "CLERK", "ADMIN"]);
export const chatRoomStageEnum = pgEnum("chat_room_stage", [
  "WELCOME",
  "IDLE",
  "ORDER_CONFIRM",
  "WAITING_OWNER",
  "BOT_ACTIVE",
]);
export const chatMessageStatusEnum = pgEnum("chat_message_status", ["SENT", "PENDING", "FAILED"]);
export const chatMessageDirectionEnum = pgEnum("chat_message_direction", [
  "INCOMING",
  "OUTGOING_BY_BOT",
  "OUTGOING_BY_STAFF",
]);
export const orderStatusEnum = pgEnum("order_status", ["PENDING", "CONFIRMED", "CANCELLED", "COMPLETED"]);
export const shipmentMethodEnum = pgEnum("shipment_method", ["STORE_PICKUP", "DELIVERY"]);
export const shipmentStatusEnum = pgEnum("shipment_status", ["PENDING", "DISPATCHED", "DELIVERED", "RETURNED"]);
export const paymentStatusEnum = pgEnum("payment_status", ["PENDING", "PAID", "FAILED", "REFUNDED"]);

const ts = (name: string) => timestamp(name, { mode: "string", precision: 3 });

export const notification = pgTable("notification", {
  id: serial("id").primaryKey(),
  receiverType: notificationReceiverTypeEnum("receiver_type").notNull(),
  receiverId: integer("receiver_id").notNull(),
  channel: notificationChannelEnum("channel").notNull(),
  status: notificationStatusEnum("status").notNull(),
  sendAt: ts("send_at"),
  createdAt: ts("created_at").notNull(),
});

export const paymentMethod = pgTable("payment_method", {
  id: serial("id").primaryKey(),
  code: varchar("code").notNull().unique(),
  displayName: varchar("display_name").notNull(),
  displayImageUrl: text("display_image_url"),
  instructions: text("instructions"),
  requiresManualConfirm: boolean("requires_manual_confirm").notNull(),
  active: boolean("active").notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const staffUser = pgTable("staff_user", {
  id: serial("id").primaryKey(),
  lineUid: varchar("line_uid").notNull().unique(),
  name: varchar("name").notNull(),
  role: staffRoleEnum("role").notNull(),
  passwordHash: varchar("password_hash").notNull(),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

export const users = pgTable("user", {
  id: serial("id").primaryKey(),
  lineUid: varchar("line_uid").unique(),
  name: varchar("name").notNull(),
  phone: varchar("phone"),
  avatarUrl: varchar("avatar_url"),
  hasOrdered: boolean("has_ordered").notNull(),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id")
    .notNull()
    .references(() => staffUser.id),
  action: varchar("action").notNull(),
  targetTable: varchar("target_table").notNull(),
  targetId: integer("target_id").notNull(),
  diff: text("diff"),
  loggedAt: ts("logged_at").notNull(),
});

export const chatRoom = pgTable(
  "chat_room",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id),
    assignedStaffId: integer("assigned_staff_id").references(() => staffUser.id),
    stage: chatRoomStageEnum("stage").notNull(),
    botStep: smallint("bot_step").notNull(),
    lastMessageTs: ts("last_message_ts"),
    unreadCount: integer("unread_count").notNull(),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
  },
  (t) => [index("ix_chat_room_user_id").on(t.userId)],
);

export const chatMessage = pgTable(
  "chat_message",
  {
    id: serial("id").primaryKey(),
    roomId: integer("room_id")
      .notNull()
      .references(() => chatRoom.id),
    status: chatMessageStatusEnum("status").notNull(),
    direction: chatMessageDirectionEnum("direction").notNull(),
    text: text("text").notNull(),
    imageUrl: text("image_url"),
    lineMsgId: varchar("line_msg_id"),
    processed: boolean("processed").notNull(),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
  },
  (t) => [index("ix_chat_message_room_id_created_at").on(t.roomId, t.createdAt)],
);

export const orders = pgTable(
  "order",
  {
    id: serial("id").primaryKey(),
    roomId: integer("room_id")
      .notNull()
      .references(() => chatRoom.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    receiverUserId: integer("receiver_user_id")
      .notNull()
      .references(() => users.id),
    status: orderStatusEnum("status").notNull(),
    itemType: varchar("item_type").notNull(),
    quantity: integer("quantity").notNull(),
    totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
    notes: text("notes"),
    cardMessage: text("card_message"),
    shipmentMethod: shipmentMethodEnum("shipment_method").notNull(),
    shipmentStatus: shipmentStatusEnum("shipment_status").notNull(),
    receiptAddress: varchar("receipt_address"),
    deliveryAddress: text("delivery_address"),
    deliveryDatetime: ts("delivery_datetime"),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
  },
  (t) => [index("ix_order_room_id_status_created_at").on(t.roomId, t.status, t.createdAt)],
);

export const orderDraft = pgTable(
  "order_draft",
  {
    id: serial("id").primaryKey(),
    roomId: integer("room_id")
      .notNull()
      .references(() => chatRoom.id),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id),
    receiverUserId: integer("receiver_user_id").references(() => users.id),
    itemType: varchar("item_type"),
    quantity: integer("quantity"),
    totalAmount: numeric("total_amount", { precision: 10, scale: 2 }),
    notes: text("notes"),
    cardMessage: text("card_message"),
    shipmentMethod: shipmentMethodEnum("shipment_method"),
    shipmentStatus: shipmentStatusEnum("shipment_status"),
    receiptAddress: varchar("receipt_address"),
    deliveryAddress: text("delivery_address"),
    deliveryDatetime: ts("delivery_datetime"),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
  },
  (t) => [index("ix_order_draft_room_id").on(t.roomId)],
);

export const payment = pgTable(
  "payment",
  {
    id: serial("id").primaryKey(),
    orderId: integer("order_id")
      .notNull()
      .references(() => orders.id),
    status: paymentStatusEnum("status").notNull(),
    methodId: integer("method_id")
      .notNull()
      .references(() => paymentMethod.id),
    amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
    screenshotUrl: text("screenshot_url"),
    paidAt: ts("paid_at"),
    confirmedAt: ts("confirmed_at"),
    createdAt: ts("created_at").notNull(),
    updatedAt: ts("updated_at").notNull(),
  },
  (t) => [index("ix_payment_order_id_method_id").on(t.orderId, t.methodId)],
);

export const storeDisplayConfig = pgTable("store_display_config", {
  id: serial("id").primaryKey(),
  storeKey: varchar("store_key").notNull().unique(),
  visibleFields: json("visible_fields").$type<string[] | null>(),
  updatedByStaffId: integer("updated_by_staff_id").references(() => staffUser.id),
  createdAt: ts("created_at").notNull(),
  updatedAt: ts("updated_at").notNull(),
});
