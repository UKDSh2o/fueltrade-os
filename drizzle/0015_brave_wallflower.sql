ALTER TABLE `trade_members` ADD `member_user_id` text;--> statement-breakpoint
ALTER TABLE `trade_members` ADD `accepted_at` integer;--> statement-breakpoint
CREATE INDEX `idx_trade_members_user_reference_status` ON `trade_members` (`member_user_id`,`trade_reference`,`status`);--> statement-breakpoint
CREATE INDEX `idx_trade_members_email_status` ON `trade_members` (`email`,`status`);