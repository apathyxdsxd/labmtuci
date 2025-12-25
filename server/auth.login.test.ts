import { describe, it, expect, beforeAll } from "vitest";
import bcrypt from "bcrypt";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("auth.login", () => {
  it("should return error for invalid username", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.auth.login({
        username: "nonexistent",
        password: "password123",
      });
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.code).toBe("UNAUTHORIZED");
      expect(error.message).toContain("Invalid username or password");
    }
  });

  it("should return error for invalid password", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.auth.login({
        username: "student1",
        password: "wrongpassword",
      });
      expect.fail("Should have thrown an error");
    } catch (error: any) {
      expect(error.code).toBe("UNAUTHORIZED");
      expect(error.message).toContain("Invalid username or password");
    }
  });

  it("should successfully login with correct credentials", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({
      username: "student1",
      password: "student123",
    });

    expect(result).toHaveProperty("token");
    expect(result).toHaveProperty("user");
    expect(result.user.username).toBe("student1");
    expect(result.user.role).toBe("student");
    expect(result.token).toBeTruthy();
  });

  it("should login teacher with correct credentials", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({
      username: "teacher",
      password: "teacher123",
    });

    expect(result).toHaveProperty("token");
    expect(result).toHaveProperty("user");
    expect(result.user.username).toBe("teacher");
    expect(result.user.role).toBe("teacher");
    expect(result.token).toBeTruthy();
  });

  it("should return user info on successful login", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.login({
      username: "student1",
      password: "student123",
    });

    expect(result.user).toHaveProperty("id");
    expect(result.user).toHaveProperty("username");
    expect(result.user).toHaveProperty("name");
    expect(result.user).toHaveProperty("role");
    expect(result.user).toHaveProperty("email");
  });
});
