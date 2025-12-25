ALTER TABLE `submissions` MODIFY COLUMN `fileUrl` varchar(500);--> statement-breakpoint
ALTER TABLE `submissions` MODIFY COLUMN `fileKey` varchar(500);--> statement-breakpoint
ALTER TABLE `submissions` MODIFY COLUMN `fileName` varchar(255);--> statement-breakpoint
ALTER TABLE `submissions` MODIFY COLUMN `grade` decimal(5,2);--> statement-breakpoint
ALTER TABLE `submissions` MODIFY COLUMN `feedback` text;--> statement-breakpoint
ALTER TABLE `submissions` MODIFY COLUMN `submittedAt` timestamp;--> statement-breakpoint
ALTER TABLE `submissions` MODIFY COLUMN `gradedAt` timestamp;