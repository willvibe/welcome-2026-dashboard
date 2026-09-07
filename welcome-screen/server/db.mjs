import 'dotenv/config';
import mysql from 'mysql2/promise';
export const database = process.env.DB_NAME || 'welcome2026';
if (!/^[a-zA-Z0-9_]+$/.test(database)) throw new Error('Invalid database name');
export const connection = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD,
  charset: 'utf8mb4',
  timezone: 'Z',
  dateStrings: true,
};
export const pool = mysql.createPool({
  ...connection,
  database,
  connectionLimit: 10,
});
