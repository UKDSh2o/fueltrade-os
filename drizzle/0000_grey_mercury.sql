CREATE TABLE `trades` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`reference` text NOT NULL,
	`product` text NOT NULL,
	`route` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`volume_mt` integer NOT NULL,
	`buy_price_cents` integer NOT NULL,
	`sell_price_cents` integer NOT NULL,
	`trade_json` text NOT NULL,
	`net_profit_cents` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_trades_owner_updated` ON `trades` (`owner_id`,`updated_at`);