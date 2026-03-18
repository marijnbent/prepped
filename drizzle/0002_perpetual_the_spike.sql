CREATE TABLE `shopping_lists` (
	`user_id` text PRIMARY KEY NOT NULL,
	`items` text NOT NULL,
	`organized` text,
	`organized_for` text,
	`checked` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
