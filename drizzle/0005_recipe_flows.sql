CREATE TABLE IF NOT EXISTS `recipe_flows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer NOT NULL,
	`fingerprint` text NOT NULL,
	`flow` text,
	`retry_after` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `recipe_flows_recipe_fingerprint_unique` ON `recipe_flows` (`recipe_id`,`fingerprint`);