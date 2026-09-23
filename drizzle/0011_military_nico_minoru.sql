CREATE TABLE `notification_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`event_key` text NOT NULL,
	`category` text NOT NULL,
	`severity` text DEFAULT 'medium' NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`target` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`read_at` integer,
	`last_seen_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_notification_events_owner_reference_status` ON `notification_events` (`owner_id`,`trade_reference`,`status`);--> statement-breakpoint
CREATE INDEX `idx_notification_events_owner_reference_key` ON `notification_events` (`owner_id`,`trade_reference`,`event_key`);