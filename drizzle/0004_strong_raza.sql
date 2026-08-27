CREATE TABLE IF NOT EXISTS `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipient_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`recipe_id` integer NOT NULL,
	`comment_id` integer NOT NULL,
	`type` text DEFAULT 'recipe_comment' NOT NULL,
	`read_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`comment_id`) REFERENCES `recipe_comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `notifications_recipient_created_at_idx` ON `notifications` (`recipient_id`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `notifications_recipient_read_at_idx` ON `notifications` (`recipient_id`,`read_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `notifications_comment_id_idx` ON `notifications` (`comment_id`);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `recipe_comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer NOT NULL,
	`author_id` text NOT NULL,
	`body` text,
	`reaction` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `recipe_comments_recipe_id_created_at_idx` ON `recipe_comments` (`recipe_id`,`created_at`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `recipe_comments_author_id_idx` ON `recipe_comments` (`author_id`);
