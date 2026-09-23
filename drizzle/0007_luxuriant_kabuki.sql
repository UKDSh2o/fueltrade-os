CREATE TABLE `audit_events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`actor_id` text NOT NULL,
	`actor_email` text NOT NULL,
	`action` text NOT NULL,
	`subject_type` text NOT NULL,
	`subject_id` text DEFAULT '' NOT NULL,
	`detail_json` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_audit_events_owner_reference_created` ON `audit_events` (`owner_id`,`trade_reference`,`created_at`);--> statement-breakpoint
CREATE TABLE `trade_approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`approval_type` text NOT NULL,
	`assigned_role` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`decided_by` text DEFAULT '' NOT NULL,
	`decided_at` integer,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_trade_approvals_owner_reference` ON `trade_approvals` (`owner_id`,`trade_reference`);--> statement-breakpoint
CREATE TABLE `trade_members` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`email` text NOT NULL,
	`name` text DEFAULT '' NOT NULL,
	`organization` text DEFAULT '' NOT NULL,
	`role` text NOT NULL,
	`permissions_json` text NOT NULL,
	`margin_scope` text DEFAULT 'none' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_trade_members_owner_reference` ON `trade_members` (`owner_id`,`trade_reference`);