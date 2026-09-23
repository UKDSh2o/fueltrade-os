CREATE TABLE `counterparties` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`country` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`risk_rating` text DEFAULT 'unrated' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_counterparties_owner_name` ON `counterparties` (`owner_id`,`name`);--> statement-breakpoint
CREATE TABLE `trade_controls` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`counterparty_id` text,
	`controls_json` text NOT NULL,
	`approval_status` text DEFAULT 'not_ready' NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_trade_controls_owner_reference` ON `trade_controls` (`owner_id`,`trade_reference`);