import { TRPCError } from "@trpc/server";
import type { Submission } from "../drizzle/schema";
import { z } from "zod";
import bcrypt from "bcrypt";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure, studentProcedure, teacherProcedure } from "./_core/trpc";
import { createToken } from "./_core/jwt";
import { getUserByUsername, getUserById, getAllLaboratories, getSubmissionsByStudent, getSubmissionByStudentAndLab, getAllStudents, getAllSubmissionsForLab, createOrUpdateSubmission, updateSubmissionGrade } from "./db";
import { storagePut, storageGet } from "./storage";
import { eq, and } from "drizzle-orm";

export const appRouter = router({
  system: systemRouter,

  // Authentication routes
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    
    login: publicProcedure
      .input(z.object({
        username: z.string().min(1),
        password: z.string().min(1),
      }))
      .mutation(async ({ input }) => {
        const user = await getUserByUsername(input.username);
        
        if (!user) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid username or password",
          });
        }

        const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
        if (!passwordMatch) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid username or password",
          });
        }

        const token = await createToken({
          userId: user.id,
          username: user.username,
          role: user.role,
        });

        return {
          token,
          user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            email: user.email,
          },
        };
      }),

    logout: publicProcedure.mutation(() => {
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
      .input(z.object({
        labId: z.number(),
        fileName: z.string(),
        fileData: z.string(), // Base64 encoded
      }))
      .mutation(async ({ input, ctx }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        
        // Convert base64 to buffer
        const buffer = Buffer.from(input.fileData, "base64");
        const fileKey = `submissions/${ctx.user.id}/lab${input.labId}/${Date.now()}-${input.fileName}`;
        
        const { url } = await storagePut(fileKey, buffer, "application/octet-stream");
        
        // Save to database
        const { createOrUpdateSubmission } = await import("./db");
        const submission = await createOrUpdateSubmission(
          ctx.user.id,
          input.labId,
          url,
          fileKey,
          input.fileName
        );
        
        return {
          url,
          fileKey,
          fileName: input.fileName,
          submission,
        };
      }),
  }),

  // Teacher routes
  teacher: router({
    students: teacherProcedure.query(async () => {
      return await getAllStudents();
    }),

    submissions: teacherProcedure
      .input(z.object({ labId: z.number() }))
      .query(async ({ input }) => {
        return await getAllSubmissionsForLab(input.labId);
      }),

    gradeSubmission: teacherProcedure
      .input(z.object({
        submissionId: z.number(),
        grade: z.number().min(0).max(100),
        feedback: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const submission = await updateSubmissionGrade(
          input.submissionId,
          input.grade,
          input.feedback
        );
        return { success: true, submission };
      }),

    downloadFile: teacherProcedure
      .input(z.object({ fileKey: z.string() }))
      .mutation(async ({ input }) => {
        try {
          const { url } = await storageGet(input.fileKey);
          return { url };
        } catch (error) {
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "Failed to generate download URL",
          });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
