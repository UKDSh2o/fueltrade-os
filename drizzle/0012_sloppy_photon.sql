CREATE TABLE `deal_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_deal_messages_owner_reference_created` ON `deal_messages` (`owner_id`,`trade_reference`,`created_at`);