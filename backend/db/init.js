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
  db.pragma('foreign_keys = ON');

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

    /* Adaptive quiz sessions (1 question at a time) */
    CREATE TABLE IF NOT EXISTS quizAdaptiveSessions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id),
      topic TEXT NOT NULL,
      difficulty INTEGER NOT NULL DEFAULT 3,
      currentQuestion TEXT,
      currentOptions TEXT,
      currentAnswerIndex INTEGER,
      currentExplanation TEXT,
      currentSubtopic TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
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

    CREATE TABLE IF NOT EXISTS copilot_suggestions (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      label TEXT,
      payload TEXT,
      status TEXT DEFAULT 'pending',
      createdAt TEXT DEFAULT (datetime('now')),
      decidedAt TEXT
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      dueDate TEXT,
      source TEXT,
      createdAt TEXT DEFAULT (datetime('now')),
      completed INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      userId TEXT NOT NULL REFERENCES users(id),
      title TEXT,
      content TEXT,
      createdAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS oauth_accounts (
      userId TEXT NOT NULL,
      provider TEXT NOT NULL,
      homeAccountId TEXT,
      tenantId TEXT,
      username TEXT,
      scopes TEXT,
      accessToken TEXT,
      expiresAt INTEGER,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      PRIMARY KEY (userId, provider),
      FOREIGN KEY(userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_events_user_start ON events(userId, startAt);
    CREATE INDEX IF NOT EXISTS idx_events_user_end ON events(userId, endAt);

    CREATE INDEX IF NOT EXISTS idx_suggestions_user_status_created
      ON copilot_suggestions(userId, status, createdAt);

    CREATE INDEX IF NOT EXISTS idx_notes_user_created ON notes(userId, createdAt);

    CREATE INDEX IF NOT EXISTS idx_assignments_user_due_completed
      ON assignments(userId, dueDate, completed);
    
    CREATE UNIQUE INDEX IF NOT EXISTS idx_events_user_sourceId
      ON events(userId, sourceId)
      WHERE sourceId IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_adaptive_sessions_user_updated
      ON quizAdaptiveSessions(userId, updatedAt);
  `);

  db.close();
  console.log('Database initialized at', dbPath);
}

if (process.argv[1] && process.argv[1].endsWith('init.js')) {
  initDb();
}
