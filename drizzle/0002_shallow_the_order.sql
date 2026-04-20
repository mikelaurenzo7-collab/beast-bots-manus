ALTER TABLE `installations` MODIFY COLUMN `customizations` json;--> statement-breakpoint
ALTER TABLE `oauth_connections` MODIFY COLUMN `scopes` json;--> statement-breakpoint
ALTER TABLE `oauth_connections` MODIFY COLUMN `metadata` json;