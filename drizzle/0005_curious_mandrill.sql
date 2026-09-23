CREATE TABLE `trade_finance` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`instrument_type` text DEFAULT 'documentary_lc' NOT NULL,
	`instrument_number` text DEFAULT '' NOT NULL,
	`issuing_bank` text DEFAULT '' NOT NULL,
	`advising_bank` text DEFAULT '' NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`issue_date` integer,
	`expiry_date` integer,
	`escrow_bank` text DEFAULT '' NOT NULL,
	`performance_bond_bps` integer DEFAULT 0 NOT NULL,
	`bank_fees_cents` integer DEFAULT 0 NOT NULL,
	`milestones_json` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_trade_finance_owner_reference` ON `trade_finance` (`owner_id`,`trade_reference`);