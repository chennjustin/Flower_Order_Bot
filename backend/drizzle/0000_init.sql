CREATE TYPE "public"."chat_message_direction" AS ENUM('INCOMING', 'OUTGOING_BY_BOT', 'OUTGOING_BY_STAFF');--> statement-breakpoint
CREATE TYPE "public"."chat_message_status" AS ENUM('SENT', 'PENDING', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."chat_room_stage" AS ENUM('WELCOME', 'IDLE', 'ORDER_CONFIRM', 'WAITING_OWNER', 'BOT_ACTIVE');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('LINE', 'EMAIL', 'SMS');--> statement-breakpoint
CREATE TYPE "public"."notification_receiver_type" AS ENUM('USER', 'STAFF');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('QUEUED', 'SENT', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'PAID', 'FAILED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."shipment_method" AS ENUM('STORE_PICKUP', 'DELIVERY');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('PENDING', 'DISPATCHED', 'DELIVERED', 'RETURNED');--> statement-breakpoint
CREATE TYPE "public"."staff_role" AS ENUM('OWNER', 'CLERK', 'ADMIN');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"staff_id" integer NOT NULL,
	"action" varchar NOT NULL,
	"target_table" varchar NOT NULL,
	"target_id" integer NOT NULL,
	"diff" text,
	"logged_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"status" "chat_message_status" NOT NULL,
	"direction" "chat_message_direction" NOT NULL,
	"text" text NOT NULL,
	"image_url" text,
	"line_msg_id" varchar,
	"processed" boolean NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_room" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"assigned_staff_id" integer,
	"stage" "chat_room_stage" NOT NULL,
	"bot_step" smallint NOT NULL,
	"last_message_ts" timestamp(3),
	"unread_count" integer NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" serial PRIMARY KEY NOT NULL,
	"receiver_type" "notification_receiver_type" NOT NULL,
	"receiver_id" integer NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"status" "notification_status" NOT NULL,
	"send_at" timestamp(3),
	"created_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_draft" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"receiver_user_id" integer,
	"item_type" varchar,
	"quantity" integer,
	"total_amount" numeric(10, 2),
	"notes" text,
	"card_message" text,
	"shipment_method" "shipment_method",
	"shipment_status" "shipment_status",
	"receipt_address" varchar,
	"delivery_address" text,
	"delivery_datetime" timestamp(3),
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" serial PRIMARY KEY NOT NULL,
	"room_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"receiver_user_id" integer NOT NULL,
	"status" "order_status" NOT NULL,
	"item_type" varchar NOT NULL,
	"quantity" integer NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"notes" text,
	"card_message" text,
	"shipment_method" "shipment_method" NOT NULL,
	"shipment_status" "shipment_status" NOT NULL,
	"receipt_address" varchar,
	"delivery_address" text,
	"delivery_datetime" timestamp(3),
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_id" integer NOT NULL,
	"status" "payment_status" NOT NULL,
	"method_id" integer NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"screenshot_url" text,
	"paid_at" timestamp(3),
	"confirmed_at" timestamp(3),
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_method" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"display_image_url" text,
	"instructions" text,
	"requires_manual_confirm" boolean NOT NULL,
	"active" boolean NOT NULL,
	"sort_order" integer NOT NULL,
	CONSTRAINT "payment_method_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "staff_user" (
	"id" serial PRIMARY KEY NOT NULL,
	"line_uid" varchar NOT NULL,
	"name" varchar NOT NULL,
	"role" "staff_role" NOT NULL,
	"password_hash" varchar NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "staff_user_line_uid_unique" UNIQUE("line_uid")
);
--> statement-breakpoint
CREATE TABLE "store_display_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_key" varchar NOT NULL,
	"visible_fields" json,
	"updated_by_staff_id" integer,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "store_display_config_store_key_unique" UNIQUE("store_key")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" serial PRIMARY KEY NOT NULL,
	"line_uid" varchar,
	"name" varchar NOT NULL,
	"phone" varchar,
	"avatar_url" varchar,
	"has_ordered" boolean NOT NULL,
	"created_at" timestamp(3) NOT NULL,
	"updated_at" timestamp(3) NOT NULL,
	CONSTRAINT "user_line_uid_unique" UNIQUE("line_uid")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_staff_id_staff_user_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."staff_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_room_id_chat_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."chat_room"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_room" ADD CONSTRAINT "chat_room_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_room" ADD CONSTRAINT "chat_room_assigned_staff_id_staff_user_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."staff_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_draft" ADD CONSTRAINT "order_draft_room_id_chat_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."chat_room"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_draft" ADD CONSTRAINT "order_draft_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_draft" ADD CONSTRAINT "order_draft_receiver_user_id_user_id_fk" FOREIGN KEY ("receiver_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_room_id_chat_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."chat_room"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_receiver_user_id_user_id_fk" FOREIGN KEY ("receiver_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_method_id_payment_method_id_fk" FOREIGN KEY ("method_id") REFERENCES "public"."payment_method"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store_display_config" ADD CONSTRAINT "store_display_config_updated_by_staff_id_staff_user_id_fk" FOREIGN KEY ("updated_by_staff_id") REFERENCES "public"."staff_user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_chat_message_room_id_created_at" ON "chat_message" USING btree ("room_id","created_at");--> statement-breakpoint
CREATE INDEX "ix_chat_room_user_id" ON "chat_room" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ix_order_draft_room_id" ON "order_draft" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "ix_order_room_id_status_created_at" ON "order" USING btree ("room_id","status","created_at");--> statement-breakpoint
CREATE INDEX "ix_payment_order_id_method_id" ON "payment" USING btree ("order_id","method_id");