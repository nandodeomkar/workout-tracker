ALTER TABLE `template_exercises` ADD `consecutive_fails` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `workouts` ADD `program_id` integer REFERENCES programs(id);--> statement-breakpoint
ALTER TABLE `workouts` ADD `program_day_position` integer;