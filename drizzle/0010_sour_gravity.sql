CREATE TABLE `sourcing_comparisons` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`ranking_mode` text DEFAULT 'margin' NOT NULL,
	`selected_quote_key` text DEFAULT '' NOT NULL,
	`quotes_json` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_sourcing_comparisons_owner_reference` ON `sourcing_comparisons` (`owner_id`,`trade_reference`);