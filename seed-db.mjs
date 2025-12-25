import bcrypt from "bcrypt";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import * as fs from "fs";
const studentNames = JSON.parse(fs.readFileSync("./student_names.json", "utf-8"));
import { drizzle } from "drizzle-orm/mysql2";
import { users, laboratories, submissions } from "./drizzle/schema.ts";

const db = drizzle(process.env.DATABASE_URL || "");

async function seedDatabase() {
  console.log("🌱 Starting database seeding...");

  try {
    // Hash passwords
    const studentPassword = await bcrypt.hash("student123", 10);
    const teacherPassword = await bcrypt.hash("teacher123", 10);

    // Insert 29 students
    console.log("📚 Inserting 30 students...");
    const studentData = [];
    for (let i = 1; i <= 29; i++) {
      studentData.push({
        username: `student${i}`,
        email: `student${i}@university.edu`,
        passwordHash: studentPassword,
        name: studentNames[i - 1],
        role: "student",
      });
    }
    await db.insert(users).values(studentData);

    // Update student IDs to start from 2 (since teacher is ID 1)
    // Assuming the database is clean and students are inserted after the teacher
    // However, the original script inserts students first. Let's adjust the logic.
    // The original script inserts 30 students (ID 1-30) and then 1 teacher (ID 31).
    // The submission loop goes from 1 to 30.
    // Since the user provided 29 names, we will insert 29 students.
    // Students will be ID 1-29, Teacher will be ID 30.
    // We need to adjust the submission loop to go from 1 to 29.

    // Insert 1 teacher
    console.log("👨‍🏫 Inserting teacher...");
    await db.insert(users).values({
      username: "teacher",
      email: "teacher@university.edu",
      passwordHash: teacherPassword,
      name: "Dr. Teacher",
      role: "teacher",
    });

    // Insert 5 laboratories
    console.log("🔬 Inserting 5 laboratories...");
    const labData = [
      {
        number: 1,
        title: "Введение в программирование",
        description: "Основные концепции программирования",
        topic: "Git",
      },
      {
        number: 2,
        title: "Основы Python",
        description: "Синтаксис и базовые структуры данных",
        topic: "Python",
      },
      {
        number: 3,
        title: "Изучение Java",
        description: "ООП и работа с классами",
        topic: "Java",
      },
      {
        number: 4,
        title: "Основы DevOps",
        description: "Контейнеризация и оркестрация",
        topic: "DevOps",
      },
      {
        number: 5,
        title: "Веб-разработка",
        description: "Frontend и Backend интеграция",
        topic: "Web Development",
      },
    ];
    await db.insert(laboratories).values(labData);

    // Insert initial submissions (all students have not_submitted status)
    console.log("📝 Initializing submissions...");
    const submissionData = [];
    for (let studentId = 1; studentId <= 29; studentId++) {
      for (let labId = 1; labId <= 5; labId++) {
        submissionData.push({
          studentId,
          labId,
          status: "not_submitted",
        });
      }
    }
    await db.insert(submissions).values(submissionData);

    console.log("✅ Database seeding completed successfully!");
    console.log("\n📋 Test Credentials:");
    console.log("Students: student1 - student29 (password: student123)");
    console.log("Teacher: teacher (password: teacher123)");
  } catch (error) {
    console.error("❌ Error seeding database:", error);
    process.exit(1);
  }
}

seedDatabase();
