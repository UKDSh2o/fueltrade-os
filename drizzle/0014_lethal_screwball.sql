CREATE TABLE `communication_connections` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`provider` text NOT NULL,
	`display_name` text NOT NULL,
	`address` text DEFAULT '' NOT NULL,
	`endpoint` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'needs_authorization' NOT NULL,
	`capabilities_json` text NOT NULL,
	`last_sync_at` integer,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_communication_connections_owner_provider` ON `communication_connections` (`owner_id`,`provider`);--> statement-breakpoint
CREATE TABLE `communication_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`external_id` text DEFAULT '' NOT NULL,
	`direction` text NOT NULL,
	`author` text NOT NULL,
	`body` text NOT NULL,
	`ai_priority` text DEFAULT 'normal' NOT NULL,
	`ai_reason` text DEFAULT '' NOT NULL,
	`draft_reply` text DEFAULT '' NOT NULL,
	`sent_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_communication_messages_owner_thread_sent` ON `communication_messages` (`owner_id`,`thread_id`,`sent_at`);--> statement-breakpoint
CREATE TABLE `communication_threads` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text DEFAULT '' NOT NULL,
	`channel` text NOT NULL,
	`thread_kind` text DEFAULT 'group' NOT NULL,
	`external_id` text DEFAULT '' NOT NULL,
	`subject` text NOT NULL,
	`participants_json` text NOT NULL,
	`priority` text DEFAULT 'normal' NOT NULL,
	`priority_reason` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`last_message_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_communication_threads_owner_trade_updated` ON `communication_threads` (`owner_id`,`trade_reference`,`updated_at`);