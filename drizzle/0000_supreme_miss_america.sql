CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `collections` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`image_url` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collections_slug_created_by_unique` ON `collections` (`slug`,`created_by`);--> statement-breakpoint
CREATE INDEX `collections_created_by_idx` ON `collections` (`created_by`);--> statement-breakpoint
CREATE INDEX `collections_created_by_sort_order_idx` ON `collections` (`created_by`,`sort_order`);--> statement-breakpoint
CREATE TABLE `cook_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipe_id` integer NOT NULL,
	`photo_url` text,
	`notes` text,
	`rating` integer,
	`cooked_at` integer NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cook_logs_recipe_id_idx` ON `cook_logs` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `cook_logs_created_by_idx` ON `cook_logs` (`created_by`);--> statement-breakpoint
CREATE INDEX `cook_logs_created_by_cooked_at_idx` ON `cook_logs` (`created_by`,`cooked_at`);--> statement-breakpoint
CREATE TABLE `favorites` (
	`user_id` text NOT NULL,
	`recipe_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `favorites_user_recipe_unique` ON `favorites` (`user_id`,`recipe_id`);--> statement-breakpoint
CREATE INDEX `favorites_user_created_at_idx` ON `favorites` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `recipe_collections` (
	`recipe_id` integer NOT NULL,
	`collection_id` integer NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`collection_id`) REFERENCES `collections`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_collections_recipe_collection_unique` ON `recipe_collections` (`recipe_id`,`collection_id`);--> statement-breakpoint
CREATE INDEX `recipe_collections_recipe_id_idx` ON `recipe_collections` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `recipe_collections_collection_id_idx` ON `recipe_collections` (`collection_id`);--> statement-breakpoint
CREATE TABLE `recipe_tags` (
	`recipe_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_tags_recipe_tag_unique` ON `recipe_tags` (`recipe_id`,`tag_id`);--> statement-breakpoint
CREATE INDEX `recipe_tags_recipe_id_idx` ON `recipe_tags` (`recipe_id`);--> statement-breakpoint
CREATE INDEX `recipe_tags_tag_id_idx` ON `recipe_tags` (`tag_id`);--> statement-breakpoint
CREATE TABLE `recipes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`ingredients` text NOT NULL,
	`cooking_supplies` text,
	`steps` text NOT NULL,
	`servings` integer,
	`prep_time` integer,
	`cook_time` integer,
	`difficulty` text,
	`image_url` text,
	`image_provider` text,
	`image_author_name` text,
	`image_author_url` text,
	`image_source_url` text,
	`source_url` text,
	`video_url` text,
	`notes` text,
	`is_published` integer DEFAULT true NOT NULL,
	`copied_from` integer,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`copied_from`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipes_slug_created_by_unique` ON `recipes` (`slug`,`created_by`);--> statement-breakpoint
CREATE INDEX `recipes_created_by_idx` ON `recipes` (`created_by`);--> statement-breakpoint
CREATE INDEX `recipes_is_published_idx` ON `recipes` (`is_published`);--> statement-breakpoint
CREATE INDEX `recipes_created_by_published_idx` ON `recipes` (`created_by`,`is_published`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug_unique` ON `tags` (`slug`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`image` text,
	`import_prompt` text,
	`chat_prompt` text,
	`shopping_prompt` text,
	`cooking_supplies_expanded_by_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `verifications` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
