CREATE TABLE `voyages` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`trade_reference` text NOT NULL,
	`vessel_name` text NOT NULL,
	`imo` text NOT NULL,
	`mmsi` text DEFAULT '' NOT NULL,
	`flag` text DEFAULT '' NOT NULL,
	`load_port` text NOT NULL,
	`discharge_port` text NOT NULL,
	`eta` integer,
	`cargo_mt` integer DEFAULT 0 NOT NULL,
	`tank_name` text DEFAULT '' NOT NULL,
	`tank_capacity_mt` integer DEFAULT 0 NOT NULL,
	`checkpoints_json` text NOT NULL,
	`status` text DEFAULT 'nominated' NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_voyages_owner_reference` ON `voyages` (`owner_id`,`trade_reference`);