CREATE TABLE `agent_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`installationId` int NOT NULL,
	`userId` int NOT NULL,
	`agentSlug` varchar(128) NOT NULL,
	`action` varchar(256) NOT NULL,
	`status` enum('running','success','error') NOT NULL DEFAULT 'running',
	`inputSummary` text,
	`outputSummary` text,
	`tokensUsed` int DEFAULT 0,
	`durationMs` int DEFAULT 0,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agent_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `chat_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `chat_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `installations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`agentSlug` varchar(128) NOT NULL,
	`status` enum('active','paused','uninstalled') NOT NULL DEFAULT 'active',
	`connectionId` int,
	`customizations` json DEFAULT ('{}'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `installations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`type` enum('run_complete','run_error','new_bot','system') NOT NULL,
	`title` varchar(256) NOT NULL,
	`body` text,
	`agentSlug` varchar(128),
	`read` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oauth_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`provider` varchar(64) NOT NULL,
	`accessTokenCiphertext` text,
	`refreshTokenCiphertext` text,
	`tokenIv` varchar(64),
	`scopes` json DEFAULT ('[]'),
	`expiresAt` timestamp,
	`accountId` varchar(256),
	`accountName` varchar(256),
	`metadata` json DEFAULT ('{}'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oauth_connections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `oauth_state` (
	`id` int AUTO_INCREMENT NOT NULL,
	`state` varchar(128) NOT NULL,
	`userId` int NOT NULL,
	`providerId` varchar(64) NOT NULL,
	`returnTo` text,
	`used` boolean NOT NULL DEFAULT false,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `oauth_state_id` PRIMARY KEY(`id`),
	CONSTRAINT `oauth_state_state_unique` UNIQUE(`state`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `avatarUrl` text;