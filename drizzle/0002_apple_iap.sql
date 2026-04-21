-- Apple StoreKit 2 / App Store Server API: dedicated column for the
-- originalTransactionId that identifies a user's Apple subscription across
-- renewals. Keeps Stripe/Apple cleanly separated.

ALTER TABLE `subscriptions`
  ADD COLUMN `appleOriginalTransactionId` VARCHAR(128) AFTER `stripeSubscriptionId`;

ALTER TABLE `subscriptions`
  ADD KEY `idx_sub_apple_tx` (`appleOriginalTransactionId`);
