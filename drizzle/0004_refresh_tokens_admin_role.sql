-- Лаб 1: добавляем роль admin в enum
ALTER TABLE `users` MODIFY COLUMN `role` enum('student','teacher','admin') NOT NULL;

-- Лаб 2: таблица refresh_tokens для хранения сессий
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id` int AUTO_INCREMENT NOT NULL,
  `userId` int NOT NULL,
  `token` varchar(512) NOT NULL,
  `expiresAt` timestamp NOT NULL,
  `revoked` boolean NOT NULL DEFAULT false,
  `createdAt` timestamp NOT NULL DEFAULT (now()),
  CONSTRAINT `refresh_tokens_token_unique` UNIQUE(`token`),
  CONSTRAINT `refresh_tokens_id` PRIMARY KEY(`id`)
);
