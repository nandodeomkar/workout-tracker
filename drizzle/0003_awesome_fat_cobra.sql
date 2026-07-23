CREATE TABLE `metric_definitions` (
	`metric_key` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`unit_type` text NOT NULL,
	`is_custom` integer DEFAULT false NOT NULL,
	`position` integer NOT NULL
);
