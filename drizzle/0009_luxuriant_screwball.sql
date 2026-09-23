CREATE TABLE `retail_reconciliations` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`station_name` text NOT NULL,
	`business_date` text NOT NULL,
	`products_json` text NOT NULL,
	`operating_cost_cents` integer DEFAULT 0 NOT NULL,
	`variance_threshold_bps` integer DEFAULT 50 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_retail_reconciliations_owner_trade_date` ON `retail_reconciliations` (`owner_id`,`trade_reference`,`business_date`);