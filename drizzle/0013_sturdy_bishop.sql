CREATE TABLE `dashboard_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`role_key` text NOT NULL,
	`tiles_json` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_dashboard_preferences_owner_role` ON `dashboard_preferences` (`owner_id`,`role_key`);