CREATE TABLE `due_diligence_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`counterparty_id` text,
	`check_type` text NOT NULL,
	`provider` text DEFAULT 'manual' NOT NULL,
	`subject_name` text NOT NULL,
	`subject_country` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'pending_review' NOT NULL,
	`risk_level` text DEFAULT 'unrated' NOT NULL,
	`query_json` text DEFAULT '{}' NOT NULL,
	`result_json` text DEFAULT '{}' NOT NULL,
	`evidence_url` text,
	`checked_at` integer NOT NULL,
	`expires_at` integer,
	`reviewed_by` text,
	`reviewer_email` text,
	`review_note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_due_diligence_owner_trade_checked` ON `due_diligence_checks` (`owner_id`,`trade_reference`,`checked_at`);--> statement-breakpoint
CREATE INDEX `idx_due_diligence_owner_counterparty_type` ON `due_diligence_checks` (`owner_id`,`counterparty_id`,`check_type`);--> statement-breakpoint
ALTER TABLE `documents` ADD `group_id` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `version_number` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `supersedes_id` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `sha256` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `uploaded_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `reviewed_by` text;--> statement-breakpoint
ALTER TABLE `documents` ADD `reviewed_at` integer;--> statement-breakpoint
ALTER TABLE `documents` ADD `review_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_documents_owner_trade_group_version` ON `documents` (`owner_id`,`trade_reference`,`group_id`,`version_number`);