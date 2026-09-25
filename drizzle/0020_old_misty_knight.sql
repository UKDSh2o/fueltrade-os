CREATE TABLE `payment_execution_evidence` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`instruction_id` text NOT NULL,
	`evidence_document_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_reference` text NOT NULL,
	`reported_amount_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`status` text DEFAULT 'received' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`executed_at` integer,
	`received_by` text NOT NULL,
	`confirmed_by` text,
	`confirmed_at` integer,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_payment_execution_owner_trade` ON `payment_execution_evidence` (`owner_id`,`trade_reference`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_payment_execution_instruction` ON `payment_execution_evidence` (`instruction_id`,`status`);