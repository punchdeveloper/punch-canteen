-- CreateEnum
CREATE TYPE "Role" AS ENUM ('staff', 'operator', 'admin');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('invited', 'active', 'suspended', 'deactivated');

-- CreateEnum
CREATE TYPE "MenuCategory" AS ENUM ('Meals', 'Drinks');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('received', 'ready', 'collected', 'cancelled');

-- CreateEnum
CREATE TYPE "TopupStatus" AS ENUM ('pending', 'confirmed', 'rejected');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('weekly_ticket_credit', 'wallet_topup', 'order_payment', 'order_refund', 'weekly_ticket_expiry', 'balance_reset');

-- CreateEnum
CREATE TYPE "Account" AS ENUM ('weekly_ticket', 'wallet');

-- CreateEnum
CREATE TYPE "GuestPaymentStatus" AS ENUM ('pending', 'confirmed', 'rejected');

-- CreateEnum
CREATE TYPE "GuestOrderStatus" AS ENUM ('awaiting_payment', 'received', 'ready', 'collected', 'cancelled');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'staff',
    "status" "AccountStatus" NOT NULL DEFAULT 'invited',
    "is_master" BOOLEAN NOT NULL DEFAULT false,
    "weekly_ticket_kobo" INTEGER NOT NULL DEFAULT 0,
    "wallet_kobo" INTEGER NOT NULL DEFAULT 0,
    "activated_at" TIMESTAMPTZ,
    "last_sign_in_at" TIMESTAMPTZ,
    "removed_at" TIMESTAMPTZ,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "login_tokens" (
    "id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "next_path" TEXT,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "used_at" TIMESTAMPTZ,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "login_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "last_seen_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_agent" TEXT,
    "ip" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_kobo" INTEGER NOT NULL,
    "allergens" TEXT,
    "category" "MenuCategory" NOT NULL DEFAULT 'Meals',
    "image_file" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "canteen_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "todays_special_item_id" INTEGER,
    "bank_name" TEXT NOT NULL DEFAULT 'Moniepoint Bank',
    "bank_account_number" TEXT NOT NULL DEFAULT '5078623822',
    "bank_account_name" TEXT NOT NULL DEFAULT 'MJ Kitchen',
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "canteen_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "total_kobo" INTEGER NOT NULL,
    "weekly_ticket_kobo" INTEGER NOT NULL,
    "wallet_kobo" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'received',
    "ticket_number" TEXT NOT NULL,
    "ready_at" TIMESTAMPTZ,
    "collected_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "handled_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "menu_item_id" INTEGER,
    "item_name" TEXT NOT NULL,
    "unit_price_kobo" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotal_kobo" INTEGER NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_topups" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "amount_kobo" INTEGER NOT NULL,
    "reference" TEXT NOT NULL,
    "status" "TopupStatus" NOT NULL DEFAULT 'pending',
    "rejection_reason" TEXT,
    "decided_by_id" UUID,
    "decided_at" TIMESTAMPTZ,
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_topups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "account" "Account" NOT NULL,
    "amount_kobo" INTEGER NOT NULL,
    "balance_after_kobo" INTEGER NOT NULL,
    "reference" TEXT,
    "description" TEXT NOT NULL,
    "order_id" INTEGER,
    "topup_id" INTEGER,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_ticket_expiries" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "expiry_month" DATE NOT NULL,
    "amount_kobo" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "weekly_ticket_expiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "order_id" INTEGER NOT NULL,
    "menu_item_id" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience_reviews" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "environment_rating" INTEGER NOT NULL,
    "restroom_rating" INTEGER NOT NULL,
    "ambience_rating" INTEGER NOT NULL,
    "customer_service_rating" INTEGER NOT NULL,
    "speed_of_service_rating" INTEGER NOT NULL,
    "food_presentation_rating" INTEGER NOT NULL,
    "overall_rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experience_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" SERIAL NOT NULL,
    "conversation_user_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "sender_role" "Role" NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_read_receipts" (
    "viewer_id" UUID NOT NULL,
    "conversation_user_id" UUID NOT NULL,
    "last_read_message_id" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "chat_read_receipts_pkey" PRIMARY KEY ("viewer_id","conversation_user_id")
);

-- CreateTable
CREATE TABLE "guest_orders" (
    "id" SERIAL NOT NULL,
    "guest_name" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "total_kobo" INTEGER NOT NULL,
    "payment_reference" TEXT NOT NULL,
    "payment_status" "GuestPaymentStatus" NOT NULL DEFAULT 'pending',
    "order_status" "GuestOrderStatus" NOT NULL DEFAULT 'awaiting_payment',
    "ticket_number" TEXT,
    "rejection_reason" TEXT,
    "confirmed_by_id" UUID,
    "confirmed_at" TIMESTAMPTZ,
    "ready_at" TIMESTAMPTZ,
    "collected_at" TIMESTAMPTZ,
    "ip_hash" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_order_items" (
    "id" SERIAL NOT NULL,
    "guest_order_id" INTEGER NOT NULL,
    "menu_item_id" INTEGER,
    "item_name" TEXT NOT NULL,
    "unit_price_kobo" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "subtotal_kobo" INTEGER NOT NULL,

    CONSTRAINT "guest_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "ip" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_status_idx" ON "users"("role", "status");

-- CreateIndex
CREATE UNIQUE INDEX "login_tokens_token_hash_key" ON "login_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "login_tokens_user_id_created_at_idx" ON "login_tokens"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_ticket_number_key" ON "orders"("ticket_number");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_status_created_at_idx" ON "orders"("status", "created_at");

-- CreateIndex
CREATE INDEX "order_items_order_id_idx" ON "order_items"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_topups_reference_key" ON "wallet_topups"("reference");

-- CreateIndex
CREATE INDEX "wallet_topups_status_requested_at_idx" ON "wallet_topups"("status", "requested_at");

-- CreateIndex
CREATE INDEX "wallet_topups_user_id_requested_at_idx" ON "wallet_topups"("user_id", "requested_at");

-- CreateIndex
CREATE INDEX "transactions_user_id_account_created_at_idx" ON "transactions"("user_id", "account", "created_at");

-- CreateIndex
CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "weekly_ticket_expiries_user_id_expiry_month_key" ON "weekly_ticket_expiries"("user_id", "expiry_month");

-- CreateIndex
CREATE INDEX "reviews_created_at_idx" ON "reviews"("created_at");

-- CreateIndex
CREATE INDEX "experience_reviews_created_at_idx" ON "experience_reviews"("created_at");

-- CreateIndex
CREATE INDEX "chat_messages_conversation_user_id_id_idx" ON "chat_messages"("conversation_user_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "guest_orders_payment_reference_key" ON "guest_orders"("payment_reference");

-- CreateIndex
CREATE UNIQUE INDEX "guest_orders_ticket_number_key" ON "guest_orders"("ticket_number");

-- CreateIndex
CREATE INDEX "guest_orders_payment_status_created_at_idx" ON "guest_orders"("payment_status", "created_at");

-- CreateIndex
CREATE INDEX "guest_orders_ip_hash_created_at_idx" ON "guest_orders"("ip_hash", "created_at");

-- CreateIndex
CREATE INDEX "guest_order_items_guest_order_id_idx" ON "guest_order_items"("guest_order_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "login_tokens" ADD CONSTRAINT "login_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canteen_settings" ADD CONSTRAINT "canteen_settings_todays_special_item_id_fkey" FOREIGN KEY ("todays_special_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "canteen_settings" ADD CONSTRAINT "canteen_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_topups" ADD CONSTRAINT "wallet_topups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_topups" ADD CONSTRAINT "wallet_topups_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_topup_id_fkey" FOREIGN KEY ("topup_id") REFERENCES "wallet_topups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_ticket_expiries" ADD CONSTRAINT "weekly_ticket_expiries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experience_reviews" ADD CONSTRAINT "experience_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_conversation_user_id_fkey" FOREIGN KEY ("conversation_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_read_receipts" ADD CONSTRAINT "chat_read_receipts_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_read_receipts" ADD CONSTRAINT "chat_read_receipts_conversation_user_id_fkey" FOREIGN KEY ("conversation_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_orders" ADD CONSTRAINT "guest_orders_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_order_items" ADD CONSTRAINT "guest_order_items_guest_order_id_fkey" FOREIGN KEY ("guest_order_id") REFERENCES "guest_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_order_items" ADD CONSTRAINT "guest_order_items_menu_item_id_fkey" FOREIGN KEY ("menu_item_id") REFERENCES "menu_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
