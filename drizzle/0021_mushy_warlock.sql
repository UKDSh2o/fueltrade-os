CREATE TABLE `document_requirements` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`category` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`due_at` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_document_requirements_trade` ON `document_requirements` (`owner_id`,`trade_reference`);