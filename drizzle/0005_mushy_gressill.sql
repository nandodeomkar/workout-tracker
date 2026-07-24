CREATE TABLE `program_exercise_progress` (
	`program_id` integer NOT NULL,
	`exercise_id` integer NOT NULL,
	`working_weight_kg` real,
	`consecutive_fails` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`program_id`, `exercise_id`),
	FOREIGN KEY (`program_id`) REFERENCES `programs`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
