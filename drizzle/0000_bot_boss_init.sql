-- Bot Boss — initial schema (MySQL 8+).
--
-- This replaces the old Beast Bots v5 tables. Run against an empty DB, or
-- drop the old tables first:
--   DROP TABLE IF EXISTS chat_messages, agent_runs, notifications,
--     installations, runs, recipes, notes, device_tokens, oauth_connections,
--     oauth_state, users;

CREATE TABLE `users` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `appleSub`     VARCHAR(128) NOT NULL UNIQUE,
  `email`        VARCHAR(320),
  `name`         VARCHAR(256),
  `role`         ENUM('user', 'admin') NOT NULL DEFAULT 'user',
  `createdAt`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE `oauth_connections` (
  `id`                     INT AUTO_INCREMENT PRIMARY KEY,
  `userId`                 INT NOT NULL,
  `provider`               VARCHAR(64) NOT NULL,
  `accessTokenCiphertext`  TEXT,
  `refreshTokenCiphertext` TEXT,
  `tokenIv`                VARCHAR(64),
  `scopes`                 JSON,
  `expiresAt`              TIMESTAMP NULL,
  `accountId`              VARCHAR(256),
  `accountName`            VARCHAR(256),
  `createdAt`              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`              TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_oauth_user_provider` (`userId`, `provider`)
);

CREATE TABLE `oauth_state` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `state`        VARCHAR(128) NOT NULL UNIQUE,
  `userId`       INT NOT NULL,
  `providerId`   VARCHAR(64) NOT NULL,
  `codeVerifier` VARCHAR(256),
  `shop`         VARCHAR(256),
  `returnTo`     TEXT,
  `used`         BOOLEAN NOT NULL DEFAULT FALSE,
  `expiresAt`    TIMESTAMP NOT NULL,
  `createdAt`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_oauth_state_user` (`userId`)
);

CREATE TABLE `recipes` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `userId`       INT NOT NULL,
  `name`         VARCHAR(256) NOT NULL,
  `prompt`       TEXT NOT NULL,
  `tools`        JSON NOT NULL,
  `triggerKind`  ENUM('manual', 'schedule', 'webhook') NOT NULL DEFAULT 'manual',
  `triggerCron`  VARCHAR(128),
  `archived`     BOOLEAN NOT NULL DEFAULT FALSE,
  `createdAt`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_recipes_user` (`userId`, `archived`),
  KEY `idx_recipes_schedule` (`triggerKind`, `archived`)
);

CREATE TABLE `runs` (
  `id`             INT AUTO_INCREMENT PRIMARY KEY,
  `userId`         INT NOT NULL,
  `botSlug`        VARCHAR(64) NOT NULL DEFAULT 'boss',
  `recipeId`       INT NULL,
  `status`         ENUM('running', 'success', 'error') NOT NULL DEFAULT 'running',
  `inputSummary`   TEXT,
  `outputSummary`  TEXT,
  `tokensUsed`     INT DEFAULT 0,
  `durationMs`     INT DEFAULT 0,
  `errorMessage`   TEXT,
  `toolCalls`      JSON,
  `createdAt`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_runs_user_created` (`userId`, `createdAt`),
  KEY `idx_runs_bot`          (`botSlug`, `createdAt`)
);

CREATE TABLE `chat_messages` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `userId`     INT NOT NULL,
  `botSlug`    VARCHAR(64) NOT NULL DEFAULT 'boss',
  `role`       ENUM('user', 'assistant') NOT NULL,
  `content`    TEXT NOT NULL,
  `runId`      INT NULL,
  `createdAt`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY `idx_chat_user_bot` (`userId`, `botSlug`, `createdAt`)
);

CREATE TABLE `notes` (
  `id`         INT AUTO_INCREMENT PRIMARY KEY,
  `userId`     INT NOT NULL,
  `title`      VARCHAR(256) NOT NULL,
  `body`       TEXT NOT NULL,
  `createdAt`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_notes_user` (`userId`, `updatedAt`)
);

CREATE TABLE `device_tokens` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `userId`       INT NOT NULL,
  `deviceToken`  VARCHAR(256) NOT NULL UNIQUE,
  `bundleId`     VARCHAR(128) NOT NULL,
  `environment`  ENUM('sandbox', 'production') NOT NULL,
  `createdAt`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_device_tokens_user` (`userId`)
);
