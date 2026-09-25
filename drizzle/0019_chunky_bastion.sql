CREATE TABLE `notification_read_states` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`is_read` integer DEFAULT 1 NOT NULL,
	`read_at` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_notification_read_user_trade` ON `notification_read_states` (`user_id`,`trade_reference`);--> statement-breakpoint
CREATE INDEX `idx_notification_read_event_user` ON `notification_read_states` (`event_id`,`user_id`);