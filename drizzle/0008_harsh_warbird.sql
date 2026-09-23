CREATE TABLE `downstream_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`input_mt` integer DEFAULT 0 NOT NULL,
	`litres_per_mt` integer DEFAULT 0 NOT NULL,
	`stages_json` text NOT NULL,
	`retail_price_cents_per_litre` integer DEFAULT 0 NOT NULL,
	`taxes_cents_per_litre` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_downstream_plans_owner_reference` ON `downstream_plans` (`owner_id`,`trade_reference`);