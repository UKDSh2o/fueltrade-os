CREATE TABLE `insurance_policies` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`policy_type` text DEFAULT 'marine_cargo' NOT NULL,
	`insurer` text DEFAULT '' NOT NULL,
	`broker` text DEFAULT '' NOT NULL,
	`policy_number` text DEFAULT '' NOT NULL,
	`currency` text DEFAULT 'USD' NOT NULL,
	`limit_cents` integer DEFAULT 0 NOT NULL,
	`deductible_cents` integer DEFAULT 0 NOT NULL,
	`premium_cents` integer DEFAULT 0 NOT NULL,
	`inception_date` integer,
	`expiry_date` integer,
	`coverage_json` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_insurance_policies_owner_reference` ON `insurance_policies` (`owner_id`,`trade_reference`);--> statement-breakpoint
CREATE TABLE `risk_cases` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`case_type` text NOT NULL,
	`title` text NOT NULL,
	`severity` text DEFAULT 'medium' NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`amount_cents` integer DEFAULT 0 NOT NULL,
	`counterparty` text DEFAULT '' NOT NULL,
	`occurred_at` integer,
	`description` text DEFAULT '' NOT NULL,
	`resolution` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_risk_cases_owner_reference` ON `risk_cases` (`owner_id`,`trade_reference`);