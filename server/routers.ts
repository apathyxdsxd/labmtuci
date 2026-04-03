import { TRPCError } from "@trpc/server";
import { z } from "zod";
import bcrypt from "bcrypt";
import { systemRouter } from "./_core/systemRouter";
import {
  publicProcedure,
  router,
  protectedProcedure,
  studentProcedure,
  teacherProcedure,
  adminProcedure,
} from "./_core/trpc";
import {
  createAccessToken,
  generateRefreshToken,
  refreshTokenExpiresAt,
  verifyToken,
} from "./_core/jwt";
import {
  getUserByUsername,
  getUserById,
  getAllLaboratories,
  getSubmissionsByStudent,
  getSubmissionByStudentAndLab,
  getAllStudents,
  getAllUsers,
  updateUserRole,
  getFilteredSubmissions,
  createOrUpdateSubmission,
  updateSubmissionGrade,
  saveRefreshToken,
  getRefreshToken,
  revokeRefreshToken,
  revokeAllUserRefreshTokens,
} from "./db";
import { storagePut, storageGet } from "./storage";

export const appRouter = router({
  system: systemRouter,

  // Authentication routes
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),

    login: publicProcedure
      .input(
        z.object({
          username: z.string().min(1),
          password: z.string().min(1),
        }),
      )
      .mutation(async ({ input }) => {
        const user = await getUserByUsername(input.username);

        if (!user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid username or password" });
        }

        const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
        if (!passwordMatch) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid username or password" });
        }

        const tokenPayload = { userId: user.id, username: user.username, role: user.role };
        const accessToken = await createAccessToken(tokenPayload);

        // Generate and persist refresh token
        const refreshToken = generateRefreshToken();
        const expiresAt = refreshTokenExpiresAt();
        await saveRefreshToken(user.id, refreshToken, expiresAt);

        // access token expires in 15 min; calculate timestamp for client
        const accessTokenExpiresAt = Date.now() + 15 * 60 * 1000;

        return {
          accessToken,
          refreshToken,
          accessTokenExpiresAt,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            email: user.email,
          },
        };
      }),

    /** Exchange a valid refresh token for a new access + refresh token pair (rotation). */
    refresh: publicProcedure
      .input(z.object({ refreshToken: z.string() }))
      .mutation(async ({ input }) => {
        const stored = await getRefreshToken(input.refreshToken);

        if (!stored || stored.revoked || stored.expiresAt < new Date()) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid or expired refresh token" });
        }

        const user = await getUserById(stored.userId);
        if (!user) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "User not found" });
        }

        // Revoke old token (rotation)
        await revokeRefreshToken(input.refreshToken);

        const tokenPayload = { userId: user.id, username: user.username, role: user.role };
        const accessToken = await createAccessToken(tokenPayload);
        const newRefreshToken = generateRefreshToken();
        const expiresAt = refreshTokenExpiresAt();
        await saveRefreshToken(user.id, newRefreshToken, expiresAt);

        const accessTokenExpiresAt = Date.now() + 15 * 60 * 1000;

        return { accessToken, refreshToken: newRefreshToken, accessTokenExpiresAt };
      }),

    logout: publicProcedure
      .input(z.object({ refreshToken: z.string().optional() }))
      .mutation(async ({ input }) => {
        if (input.refreshToken) {
          await revokeRefreshToken(input.refreshToken);
        }
        return { success: true };
      }),
  }),

  // Laboratory routes
  labs: router({
    list: protectedProcedure.query(async () => {
      return await getAllLaboratories();
    }),
  }),

  // Student routes
  student: router({
    submissions: studentProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return await getSubmissionsByStudent(ctx.user.id);
    }),

    getSubmission: studentProcedure
      .input(z.object({ labId: z.number() }))
      .query(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        return await getSubmissionByStudentAndLab(ctx.user.id, input.labId);
      }),

    uploadFile: studentProcedure
      .input(
        z.object({
          labId: z.number(),
          fileName: z.string().max(255),
          fileData: z.string(), // Base64 encoded
        }),
      )
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });

        const buffer = Buffer.from(input.fileData, "base64");
        const fileKey = `submissions/${ctx.user.id}/lab${input.labId}/${Date.now()}-${input.fileName}`;

        const { url } = await storagePut(fileKey, buffer, "application/octet-stream");

        const submission = await createOrUpdateSubmission(
          ctx.user.id,
          input.labId,
          url,
          fileKey,
          input.fileName,
        );

        return { url, fileKey, fileName: input.fileName, submission };
      }),
  }),

  // Teacher routes
  teacher: router({
    students: teacherProcedure.query(async () => {
      return await getAllStudents();
    }),

    /** Filtered + paginated submissions for a lab. */
    submissions: teacherProcedure
      .input(
        z.object({
          labId: z.number(),
          status: z.enum(["not_submitted", "submitted", "graded"]).optional(),
          minGrade: z.number().min(0).max(100).optional(),
          maxGrade: z.number().min(0).max(100).optional(),
          page: z.number().min(1).default(1),
          pageSize: z.number().min(1).max(100).default(20),
        }),
      )
      .query(async ({ input }) => {
        return await getFilteredSubmissions(input);
      }),

    gradeSubmission: teacherProcedure
      .input(
        z.object({
          submissionId: z.number(),
          grade: z.number().min(0).max(100),
          feedback: z.string().optional(),
        }),
      )
      .mutation(async ({ input }) => {
        const submission = await updateSubmissionGrade(input.submissionId, input.grade, input.feedback);
        return { success: true, submission };
      }),

    downloadFile: teacherProcedure
      .input(z.object({ fileKey: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const { url } = await storageGet(input.fileKey);
          return { url };
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to generate download URL" });
        }
      }),
  }),

  // Admin routes — accessible only by users with role=admin
  admin: router({
    /** List all users (for role management). */
    users: adminProcedure.query(async () => {
      const all = await getAllUsers();
      // Never expose passwordHash
      return all.map(({ passwordHash: _, ...u }) => u);
    }),

    /** Change a user's role. */
    setRole: adminProcedure
      .input(
        z.object({
          userId: z.number(),
          role: z.enum(["student", "teacher", "admin"]),
        }),
      )
      .mutation(async ({ input }) => {
        const updated = await updateUserRole(input.userId, input.role);
        if (!updated) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
        const { passwordHash: _, ...u } = updated;
        return u;
      }),

    /** Revoke all active sessions of a user. */
    revokeUserSessions: adminProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(async ({ input }) => {
        await revokeAllUserRefreshTokens(input.userId);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
