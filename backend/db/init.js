import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
const dbPath = join(dataDir, 'copilot.db');

export function initDb() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL DEFAULT 'student',
      displayName TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS preferences (
      userId TEXT PRIMARY KEY REFERENCES users(id),
      widgets TEXT,
      notifications TEXT,
      monetizationAck INTEGER DEFAULT 0,
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      dueDate TEXT,
      completed INTEGER DEFAULT 0,
      completedAt TEXT,
      difficulty TEXT,
      comment TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      startAt TEXT NOT NULL,
      endAt TEXT NOT NULL,
      type TEXT DEFAULT 'personal',
      sourceId TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quizzes (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id),
      topic TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      numQuestions INTEGER NOT NULL,
      questions TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS quizAttempts (
      id TEXT PRIMARY KEY,
      quizId TEXT NOT NULL REFERENCES quizzes(id),
      userId TEXT NOT NULL REFERENCES users(id),
      answers TEXT NOT NULL,
      score INTEGER NOT NULL,
      weakTopics TEXT,
      suggestions TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS topicStats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL REFERENCES users(id),
      topic TEXT NOT NULL,
      weakCount INTEGER DEFAULT 0,
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      value TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      title TEXT,
      body TEXT,
      read INTEGER DEFAULT 0,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL REFERENCES users(id),
      createdAt TEXT DEFAULT (datetime('now'))
    );
  `);

  db.close();
  console.log('Database initialized at', dbPath);
}

if (process.argv[1] && process.argv[1].endsWith('init.js')) {
  initDb();
}
