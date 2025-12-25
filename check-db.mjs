import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import { users } from './drizzle/schema.ts';
import { eq } from 'drizzle-orm';

const connection = await mysql.createConnection(process.env.DATABASE_URL || '');
const db = drizzle(connection);

const user = await db.select().from(users).where(eq(users.username, 'student1')).limit(1);
console.log('User found:', JSON.stringify(user, null, 2));

await connection.end();
