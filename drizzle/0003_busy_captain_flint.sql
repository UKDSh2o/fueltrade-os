CREATE TABLE `trade_workflows` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`current_stage` integer DEFAULT 0 NOT NULL,
	`milestones_json` text NOT NULL,
	`target_delivery` integer,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_trade_workflows_owner_reference` ON `trade_workflows` (`owner_id`,`trade_reference`);