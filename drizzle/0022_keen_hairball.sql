CREATE TABLE `signature_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`document_id` text NOT NULL,
	`document_sha256` text NOT NULL,
	`signer_email` text NOT NULL,
	`signer_name` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`provider_envelope_id` text,
	`signed_object_key` text,
	`signed_sha256` text,
	`requested_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_signature_requests_trade` ON `signature_requests` (`owner_id`,`trade_reference`);