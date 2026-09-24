CREATE TABLE `bank_detail_changes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`beneficiary_name` text NOT NULL,
	`bank_name` text NOT NULL,
	`swift_bic` text DEFAULT '' NOT NULL,
	`masked_account` text NOT NULL,
	`account_fingerprint` text NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`first_approved_by` text,
	`first_approved_at` integer,
	`second_approved_by` text,
	`second_approved_at` integer,
	`rejected_by` text,
	`rejected_at` integer,
	`created_by` text NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_bank_detail_changes_owner_trade_status` ON `bank_detail_changes` (`owner_id`,`trade_reference`,`status`);--> statement-breakpoint
CREATE TABLE `payment_instructions` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`bank_change_id` text,
	`instruction_type` text DEFAULT 'payment' NOT NULL,
	`beneficiary_name` text NOT NULL,
	`bank_name` text NOT NULL,
	`masked_account` text NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`purpose` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_by` text NOT NULL,
	`submitted_by` text,
	`submitted_at` integer,
	`approved_by` text,
	`approved_at` integer,
	`cancelled_by` text,
	`cancelled_at` integer,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_payment_instructions_owner_trade_status` ON `payment_instructions` (`owner_id`,`trade_reference`,`status`);