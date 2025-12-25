ALTER TABLE `submissions` MODIFY COLUMN `fileUrl` varchar(500) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `submissions` MODIFY COLUMN `fileKey` varchar(500) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `submissions` MODIFY COLUMN `fileName` varchar(255) NOT NULL DEFAULT '';--> statement-breakpoint
ALTER TABLE `submissions` MODIFY COLUMN `grade` varchar(10);--> statement-breakpoint
ALTER TABLE `submissions` MODIFY COLUMN `feedback` varchar(1000);--> statement-breakpoint
ALTER TABLE `submissions` MODIFY COLUMN `submittedAt` timestamp DEFAULT (now());--> statement-breakpoint
ALTER TABLE `submissions` MODIFY COLUMN `gradedAt` timestamp DEFAULT (now());