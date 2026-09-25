CREATE TABLE `port_handoffs` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`port_name` text NOT NULL,
	`handoff_type` text NOT NULL,
	`from_party` text NOT NULL,
	`to_party` text NOT NULL,
	`quantity_mt` integer DEFAULT 0 NOT NULL,
	`document_id` text,
	`status` text DEFAULT 'recorded' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`occurred_at` integer NOT NULL,
	`recorded_by` text NOT NULL,
	`accepted_by` text,
	`accepted_at` integer,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_port_handoffs_owner_trade_created` ON `port_handoffs` (`owner_id`,`trade_reference`,`created_at`);--> statement-breakpoint
CREATE TABLE `vessel_position_reports` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`voyage_id` text NOT NULL,
	`imo` text NOT NULL,
	`provider` text DEFAULT 'manual' NOT NULL,
	`latitude_e6` integer NOT NULL,
	`longitude_e6` integer NOT NULL,
	`speed_tenths` integer DEFAULT 0 NOT NULL,
	`course_degrees` integer DEFAULT 0 NOT NULL,
	`position_at` integer NOT NULL,
	`source_url` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`received_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_vessel_positions_owner_trade_time` ON `vessel_position_reports` (`owner_id`,`trade_reference`,`position_at`);--> statement-breakpoint
ALTER TABLE `insurance_policies` ADD `verification_status` text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
ALTER TABLE `insurance_policies` ADD `evidence_document_id` text;--> statement-breakpoint
ALTER TABLE `insurance_policies` ADD `verification_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `insurance_policies` ADD `verified_by` text;--> statement-breakpoint
ALTER TABLE `insurance_policies` ADD `verified_at` integer;