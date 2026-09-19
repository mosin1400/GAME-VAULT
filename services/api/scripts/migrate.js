#!/usr/bin/env node

/**
 * @fileoverview Database Migration Script for Game Vault
 * Migrates legacy JSON data to SQLite database
 * 
 * Usage: npm run migrate --workspace=services/api
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import Database from 'better-sqlite3';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Configuration
const DATA_DIR = join(__dirname, '../../../data');
const DB_PATH = process.env.DATABASE_PATH || join(DATA_DIR, 'game-vault.db');
const LEGACY_GAMES_PATH = join(DATA_DIR, 'games.json');
const BACKUP_DIR = join(DATA_DIR, 'backups');

// Ensure directories exist
if (!existsSync(DATA_DIR)) {
  console.log('Creating data directory...');
  mkdirSync(DATA_DIR, { recursive: true });
}

if (!existsSync(BACKUP_DIR)) {
  console.log('Creating backups directory...');
  mkdirSync(BACKUP_DIR, { recursive: true });
}

console.log('🚀 Starting database migration...\n');

// Create backup of existing database if it exists
if (existsSync(DB_PATH)) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(BACKUP_DIR, `game-vault-backup-${timestamp}.db`);
  
  console.log(`📦 Creating backup of existing database...`);
  console.log(`   Source: ${DB_PATH}`);
  console.log(`   Backup: ${backupPath}\n`);
  
  const { execSync } = await import('child_process');
  try {
    execSync(`cp "${DB_PATH}" "${backupPath}"`);
    console.log('✅ Backup created successfully\n');
  } catch (error) {
    console.error('❌ Backup failed:', error.message);
    console.log('⚠️  Continuing without backup...\n');
  }
}

// Initialize database
console.log(`📊 Initializing database at: ${DB_PATH}\n`);
const db = new Database(DB_PATH);

// Enable foreign keys and WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============================================================================
// CREATE TABLES
// ============================================================================

console.log('📋 Creating database tables...\n');

// Users table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user' CHECK(role IN ('admin', 'user', 'guest')),
    avatarUrl TEXT,
    bio TEXT,
    isActive BOOLEAN DEFAULT 1,
    lastLoginAt TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`);
console.log('✅ Created users table');

// Games table (enhanced schema to match legacy data)
db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    longDescription TEXT,
    category TEXT,
    ai TEXT,
    rating REAL DEFAULT 0,
    ratingCount INTEGER DEFAULT 0,
    plays INTEGER DEFAULT 0,
    image TEXT,
    thumbnailUrl TEXT,
    playUrl TEXT,
    downloadUrl TEXT,
    gameUrl TEXT,
    tags TEXT,
    featured BOOLEAN DEFAULT 0,
    published BOOLEAN DEFAULT 1,
    version TEXT,
    developer TEXT,
    publisher TEXT,
    releaseDate TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`);
console.log('✅ Created games table');

// Categories table
db.exec(`
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    iconUrl TEXT,
    sortOrder INTEGER DEFAULT 0,
    isActive BOOLEAN DEFAULT 1,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  )
`);
console.log('✅ Created categories table');

// Reviews table
db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    gameId TEXT NOT NULL,
    rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    title TEXT,
    content TEXT,
    isVerified BOOLEAN DEFAULT 0,
    helpfulCount INTEGER DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE
  )
`);
console.log('✅ Created reviews table');

// Play history table
db.exec(`
  CREATE TABLE IF NOT EXISTS play_history (
    id TEXT PRIMARY KEY,
    userId TEXT,
    gameId TEXT NOT NULL,
    playDuration INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT 0,
    score INTEGER,
    savedData TEXT,
    playedAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE
  )
`);
console.log('✅ Created play_history table');

// Favorites table
db.exec(`
  CREATE TABLE IF NOT EXISTS favorites (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    gameId TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE,
    UNIQUE(userId, gameId)
  )
`);
console.log('✅ Created favorites table');

// Sessions table (for persistent sessions)
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expiresAt TEXT NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
  )
`);
console.log('✅ Created sessions table');

// Create indexes for better query performance
console.log('\n📈 Creating indexes...\n');

db.exec('CREATE INDEX IF NOT EXISTS idx_games_category ON games(category)');
console.log('✅ Created index: idx_games_category');

db.exec('CREATE INDEX IF NOT EXISTS idx_games_slug ON games(slug)');
console.log('✅ Created index: idx_games_slug');

db.exec('CREATE INDEX IF NOT EXISTS idx_games_featured ON games(featured)');
console.log('✅ Created index: idx_games_featured');

db.exec('CREATE INDEX IF NOT EXISTS idx_games_published ON games(published)');
console.log('✅ Created index: idx_games_published');

db.exec('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
console.log('✅ Created index: idx_users_email');

db.exec('CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)');
console.log('✅ Created index: idx_users_username');

db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_gameId ON reviews(gameId)');
console.log('✅ Created index: idx_reviews_gameId');

db.exec('CREATE INDEX IF NOT EXISTS idx_reviews_userId ON reviews(userId)');
console.log('✅ Created index: idx_reviews_userId');

db.exec('CREATE INDEX IF NOT EXISTS idx_play_history_gameId ON play_history(gameId)');
console.log('✅ Created index: idx_play_history_gameId');

db.exec('CREATE INDEX IF NOT EXISTS idx_favorites_userId ON favorites(userId)');
console.log('✅ Created index: idx_favorites_userId');

// ============================================================================
// MIGRATE LEGACY GAMES DATA
// ============================================================================

console.log('\n🎮 Migrating games data...\n');

if (existsSync(LEGACY_GAMES_PATH)) {
  console.log(`📂 Reading legacy games from: ${LEGACY_GAMES_PATH}`);
  
  const gamesData = readFileSync(LEGACY_GAMES_PATH, 'utf8');
  const legacyGames = JSON.parse(gamesData);
  
  console.log(`📊 Found ${legacyGames.length} games to migrate\n`);
  
  // Prepare statements
  const insertGameStmt = db.prepare(`
    INSERT OR REPLACE INTO games (
      id, name, slug, description, category, ai, rating, ratingCount,
      image, playUrl, downloadUrl, gameUrl, featured, published,
      createdAt, updatedAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const now = new Date().toISOString();
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  
  // Begin transaction for faster migration
  const transaction = db.transaction((games) => {
    for (const game of games) {
      try {
        insertGameStmt.run(
          game.id || `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          game.name || 'Untitled Game',
          game.slug || `game-${Date.now()}`,
          game.description || '',
          game.category || 'Arcade',
          game.ai || null,
          game.rating || 0,
          game.ratingCount || 0,
          game.image || game.thumbnailUrl || null,
          game.playUrl || null,
          game.downloadUrl || null,
          game.gameUrl || game.playUrl || null,
          game.featured ? 1 : 0,
          game.published !== false ? 1 : 0,
          game.createdAt || now,
          game.updatedAt || now
        );
        migrated++;
        console.log(`✅ Migrated: ${game.name || game.id}`);
      } catch (error) {
        errors++;
        console.error(`❌ Error migrating game ${game.id}:`, error.message);
      }
    }
  });
  
  transaction(legacyGames);
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 Migration Summary:');
  console.log('='.repeat(60));
  console.log(`✅ Successfully migrated: ${migrated} games`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📁 Total processed: ${legacyGames.length}`);
  console.log('='.repeat(60) + '\n');
  
  // Create backup of migrated JSON with timestamp
  const jsonBackupPath = join(BACKUP_DIR, `games-legacy-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  writeFileSync(jsonBackupPath, gamesData);
  console.log(`💾 Legacy JSON backed up to: ${jsonBackupPath}\n`);
  
} else {
  console.log('⚠️  No legacy games.json found. Skipping games migration.\n');
}

// ============================================================================
// SEED DEFAULT CATEGORIES
// ============================================================================

console.log('🏷️  Seeding default categories...\n');

const categories = [
  { name: 'اکشن', slug: 'action', description: 'Action games', sortOrder: 1 },
  { name: 'مسابقه‌ای', slug: 'racing', description: 'Racing games', sortOrder: 2 },
  { name: 'ماجراجویی', slug: 'adventure', description: 'Adventure games', sortOrder: 3 },
  { name: 'استراتژی', slug: 'strategy', description: 'Strategy games', sortOrder: 4 },
  { name: 'پازل', slug: 'puzzle', description: 'Puzzle games', sortOrder: 5 },
  { name: 'شبیه‌سازی', slug: 'simulation', description: 'Simulation games', sortOrder: 6 },
  { name: 'آرکید', slug: 'arcade', description: 'Arcade games', sortOrder: 7 },
];

const insertCategoryStmt = db.prepare(`
  INSERT OR IGNORE INTO categories (name, slug, description, sortOrder, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const now = new Date().toISOString();
let categoriesInserted = 0;

for (const cat of categories) {
  insertCategoryStmt.run(cat.name, cat.slug, cat.description, cat.sortOrder, now, now);
  categoriesInserted++;
  console.log(`✅ Added category: ${cat.name}`);
}

console.log(`\n📊 Added ${categoriesInserted} categories\n`);

// ============================================================================
// CREATE DEFAULT ADMIN USER (if not exists)
// ============================================================================

console.log('👤 Checking for admin user...\n');

const bcrypt = await import('bcryptjs');
const { v4: uuidv4 } = await import('uuid');

const adminEmail = 'admin@gamevault.com';
const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);

if (!existingAdmin) {
  const adminId = uuidv4();
  const hashedPassword = await bcrypt.default.hash('Admin@123', 12);
  
  db.prepare(`
    INSERT INTO users (id, username, email, password, role, isActive, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    adminId,
    'admin',
    adminEmail,
    hashedPassword,
    'admin',
    1,
    now,
    now
  );
  
  console.log('✅ Created default admin user:');
  console.log('   Email: admin@gamevault.com');
  console.log('   Password: Admin@123');
  console.log('   ⚠️  Please change this password immediately!\n');
} else {
  console.log('ℹ️  Admin user already exists\n');
}

// ============================================================================
// VERIFY MIGRATION
// ============================================================================

console.log('🔍 Verifying migration...\n');

const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
const gameCount = db.prepare('SELECT COUNT(*) as count FROM games').get().count;
const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;

console.log('='.repeat(60));
console.log('📊 Database Verification:');
console.log('='.repeat(60));
console.log(`👥 Users: ${userCount}`);
console.log(`🎮 Games: ${gameCount}`);
console.log(`🏷️  Categories: ${categoryCount}`);
console.log('='.repeat(60));

// Show migrated games
if (gameCount > 0) {
  console.log('\n🎮 Migrated Games Preview:\n');
  const games = db.prepare('SELECT id, name, category, rating FROM games LIMIT 5').all();
  games.forEach((game, index) => {
    console.log(`   ${index + 1}. ${game.name} (${game.category}) - Rating: ${game.rating}`);
  });
}

console.log('\n' + '='.repeat(60));
console.log('✅ Migration completed successfully!');
console.log('='.repeat(60) + '\n');

// Close database connection
db.close();

console.log('🎉 All done! You can now start the API server.\n');
console.log('Next steps:');
console.log('  1. Run: npm run seed --workspace=services/api (optional)');
console.log('  2. Run: npm run dev:api --workspace=services/api');
console.log('  3. Visit: http://localhost:3001/health\n');

process.exit(0);
