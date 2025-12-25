import { ForbiddenError } from "@shared/_core/errors";
import type { Request } from "express";
import type { User } from "../../drizzle/schema";
import { getUserById } from "../db";
import { getTokenFromRequest, verifyToken } from "./jwt";

class SDKServer {
  constructor() {
    console.log("[Auth] JWT-based authentication initialized");
  }

  async authenticateRequest(req: Request): Promise<User> {
    const token = getTokenFromRequest(req);

    if (!token) {
      throw ForbiddenError("No authentication token provided");
    }

    const payload = await verifyToken(token);

    if (!payload) {
      throw ForbiddenError("Invalid or expired token");
    }

    const user = await getUserById(payload.userId);

    if (!user) {
      throw ForbiddenError("User not found");
    }

    return user;
  }
}

export const sdk = new SDKServer();
