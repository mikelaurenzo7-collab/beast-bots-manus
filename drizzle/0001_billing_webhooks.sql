-- Billing (Stripe) + webhook dedup table.

CREATE TABLE `subscriptions` (
  `id`                    INT AUTO_INCREMENT PRIMARY KEY,
  `userId`                INT NOT NULL UNIQUE,
  `plan`                  ENUM('free', 'pro') NOT NULL DEFAULT 'free',
  `status`                ENUM('active', 'trialing', 'past_due', 'canceled', 'unpaid', 'incomplete')
                            NOT NULL DEFAULT 'active',
  `stripeCustomerId`      VARCHAR(128),
  `stripeSubscriptionId`  VARCHAR(128),
  `currentPeriodEnd`      TIMESTAMP NULL,
  `cancelAtPeriodEnd`     BOOLEAN NOT NULL DEFAULT FALSE,
  `createdAt`             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt`             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE `webhook_events` (
  `id`           INT AUTO_INCREMENT PRIMARY KEY,
  `provider`     VARCHAR(32) NOT NULL,
  `externalId`   VARCHAR(128) NOT NULL,
  `topic`        VARCHAR(128) NOT NULL,
  `userId`       INT NULL,
  `payload`      JSON,
  `processedAt`  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_webhook_provider_event` (`provider`, `externalId`),
  KEY `idx_webhook_provider_topic` (`provider`, `topic`, `processedAt`)
);
