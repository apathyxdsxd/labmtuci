import { eq, and, like, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { users, laboratories, submissions, refreshTokens, type User, type Laboratory, type Submission, type RefreshToken } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// User queries
export async function getUserByUsername(username: string): Promise<User | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserById(id: number): Promise<User | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllStudents(): Promise<User[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get students: database not available");
    return [];
  }

  return await db.select().from(users).where(eq(users.role, "student"));
}

export async function getAllUsers(): Promise<User[]> {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users);
}

export async function updateUserRole(userId: number, role: "student" | "teacher" | "admin"): Promise<User | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(users).set({ role }).where(eq(users.id, userId));
  return getUserById(userId);
}

// Laboratory queries
export async function getAllLaboratories(): Promise<Laboratory[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get laboratories: database not available");
    return [];
  }

  return await db.select().from(laboratories);
}

// Submission queries
export async function getSubmissionsByStudent(studentId: number): Promise<Submission[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get submissions: database not available");
    return [];
  }

  return await db.select().from(submissions).where(eq(submissions.studentId, studentId));
}

export async function getSubmissionByStudentAndLab(studentId: number, labId: number): Promise<Submission | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get submission: database not available");
    return undefined;
  }

  const result = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.studentId, studentId),
        eq(submissions.labId, labId)
      )
    )
    .limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export interface SubmissionFilter {
  labId: number;
  status?: "not_submitted" | "submitted" | "graded";
  minGrade?: number;
  maxGrade?: number;
  page?: number;
  pageSize?: number;
}

export async function getAllSubmissionsForLab(labId: number): Promise<Submission[]> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get submissions: database not available");
    return [];
  }
  return await db.select().from(submissions).where(eq(submissions.labId, labId));
}

export async function getFilteredSubmissions(filter: SubmissionFilter): Promise<{ items: Submission[]; total: number }> {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };

  const conditions = [eq(submissions.labId, filter.labId)];
  if (filter.status) conditions.push(eq(submissions.status, filter.status));
  if (filter.minGrade !== undefined) conditions.push(gte(submissions.grade, String(filter.minGrade)));
  if (filter.maxGrade !== undefined) conditions.push(lte(submissions.grade, String(filter.maxGrade)));

  const where = and(...conditions);
  const page = filter.page ?? 1;
  const pageSize = filter.pageSize ?? 20;
  const offset = (page - 1) * pageSize;

  const [items, countRows] = await Promise.all([
    db.select().from(submissions).where(where).limit(pageSize).offset(offset),
    db.select({ count: sql<number>`count(*)` }).from(submissions).where(where),
  ]);

  return { items, total: Number(countRows[0]?.count ?? 0) };
}


// Submission mutations
export async function createOrUpdateSubmission(
  studentId: number,
  labId: number,
  fileUrl: string,
  fileKey: string,
  fileName: string
): Promise<Submission | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update submission: database not available");
    return undefined;
  }

  try {
    // First check if submission exists
    const existing = await getSubmissionByStudentAndLab(studentId, labId);
    
    if (existing) {
      // Update existing
      const result = await db
        .update(submissions)
        .set({
          fileUrl,
          fileKey,
          fileName,
          status: "submitted",
          submittedAt: new Date(),
        })
        .where(
          and(
            eq(submissions.studentId, studentId),
            eq(submissions.labId, labId)
          )
        );
      
      return await getSubmissionByStudentAndLab(studentId, labId);
    } else {
      // Create new
      await db.insert(submissions).values({
        studentId,
        labId,
        fileUrl,
        fileKey,
        fileName,
        status: "submitted",
        submittedAt: new Date(),
      });
      
      return await getSubmissionByStudentAndLab(studentId, labId);
    }
  } catch (error) {
    console.error("[Database] Failed to update submission:", error);
    throw error;
  }
}

// Refresh token functions
export async function saveRefreshToken(userId: number, token: string, expiresAt: Date): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(refreshTokens).values({ userId, token, expiresAt, revoked: false });
}

export async function getRefreshToken(token: string): Promise<RefreshToken | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(refreshTokens).where(eq(refreshTokens.token, token)).limit(1);
  return result[0];
}

export async function revokeRefreshToken(token: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.token, token));
}

export async function revokeAllUserRefreshTokens(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(refreshTokens).set({ revoked: true }).where(eq(refreshTokens.userId, userId));
}

export async function updateSubmissionGrade(
  submissionId: number,
  grade: number,
  feedback?: string
): Promise<Submission | undefined> {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot update grade: database not available");
    return undefined;
  }

  try {
    await db
      .update(submissions)
      .set({
        grade: String(grade),
        feedback: feedback || null,
        status: "graded",
        gradedAt: new Date(),
      })
      .where(eq(submissions.id, submissionId));
    
    const result = await db.select().from(submissions).where(eq(submissions.id, submissionId)).limit(1);
    return result.length > 0 ? result[0] : undefined;
  } catch (error) {
    console.error("[Database] Failed to update grade:", error);
    throw error;
  }
}
