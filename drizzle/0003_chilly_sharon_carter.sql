ALTER TABLE `users` ADD `api_token_hash` text;--> statement-breakpoint
ALTER TABLE `users` ADD `api_token_preview` text;--> statement-breakpoint
ALTER TABLE `users` ADD `api_token_created_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `api_token_last_used_at` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `users_api_token_hash_unique` ON `users` (`api_token_hash`);