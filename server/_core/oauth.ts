import type { Express } from "express";

export function registerOAuthRoutes(app: Express) {
  // OAuth routes disabled - using JWT authentication instead
  // All authentication is handled through the /api/trpc/auth.login endpoint
}
