/**
 * @fileoverview API Service for Game Vault
 * Main Fastify server with routes, middleware, and database integration
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { successResponse, errorResponse, ROLES } from '@game-vault/shared';
import { protectRoute, verifyToken, extractTokenFromHeader } from '@game-vault/auth';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.env.API_PORT || '3001', 10);
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:5173'];
const RATE_LIMIT_MAX = parseInt(process.env.API_RATE_LIMIT_MAX || '100', 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || '60000', 10);

// Initialize Fastify server
const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

// ============================================================================
// REGISTER PLUGINS
// ============================================================================

await app.register(cors, {
  origin: CORS_ORIGINS,
  credentials: true,
});

await app.register(helmet, {
  contentSecurityPolicy: false, // Configure based on your needs
});

await app.register(rateLimit, {
  max: RATE_LIMIT_MAX,
  timeWindow: RATE_LIMIT_WINDOW_MS,
});

await app.register(fastifyStatic, {
  root: join(__dirname, '../../public'),
  prefix: '/public/',
});

// ============================================================================
// DATABASE SETUP (SQLite with better-sqlite3)
// ============================================================================

let db;
try {
  const Database = (await import('better-sqlite3')).default;
  const dataDir = join(__dirname, '../../data');
  const dbPath = process.env.DATABASE_PATH || join(dataDir, 'game-vault.db');
  
  // Ensure data directory exists
  const fs = await import('fs');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  db = new Database(dbPath);
  console.log('Database initialized at:', dbPath);
} catch (error) {
  console.warn('Database not available, running in memory mode:', error.message);
  db = null;
}

// ============================================================================
// HEALTH CHECK ROUTE
// ============================================================================

app.get('/health', async (request, reply) => {
  return successResponse({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'api',
    version: '2.0.0',
  }, 'Service is healthy');
});

// ============================================================================
// AUTHENTICATION ROUTES
// ============================================================================

app.post('/api/v1/auth/register', async (request, reply) => {
  try {
    const { username, email, password } = request.body;
    
    // Import auth service dynamically
    const auth = await import('@game-vault/auth');
    const user = await auth.createUser({ username, email, password });
    
    // Store user in database (simplified for demo)
    if (db) {
      const stmt = db.prepare(`
        INSERT INTO users (id, username, email, password, role, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(user.id, user.username, user.email, user.password, user.role, user.createdAt, user.updatedAt);
    }
    
    // Generate token
    const token = auth.generateToken(user);
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    return reply.code(201).send(successResponse({
      user: userWithoutPassword,
      token,
    }, 'User registered successfully'));
  } catch (error) {
    app.log.error('Registration error:', error.message);
    return reply.code(400).send(errorResponse(error.message, 'REGISTRATION_FAILED', 400));
  }
});

app.post('/api/v1/auth/login', async (request, reply) => {
  try {
    const { email, password } = request.body;
    
    // Find user in database
    let user;
    if (db) {
      const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
      user = stmt.get(email.toLowerCase());
    }
    
    if (!user) {
      return reply.code(401).send(errorResponse('Invalid credentials', 'INVALID_CREDENTIALS', 401));
    }
    
    // Verify password
    const auth = await import('@game-vault/auth');
    const isValid = await auth.verifyPassword(password, user.password);
    
    if (!isValid) {
      return reply.code(401).send(errorResponse('Invalid credentials', 'INVALID_CREDENTIALS', 401));
    }
    
    // Generate token
    const token = auth.generateToken(user);
    
    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;
    
    return reply.send(successResponse({
      user: userWithoutPassword,
      token,
    }, 'Login successful'));
  } catch (error) {
    app.log.error('Login error:', error.message);
    return reply.code(500).send(errorResponse('Internal server error', 'LOGIN_FAILED', 500));
  }
});

app.get('/api/v1/auth/me', async (request, reply) => {
  try {
    const authHeader = request.headers.authorization;
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      return reply.code(401).send(errorResponse('No token provided', 'NO_TOKEN', 401));
    }
    
    const auth = await import('@game-vault/auth');
    const decoded = auth.verifyToken(token);
    
    if (!decoded) {
      return reply.code(401).send(errorResponse('Invalid token', 'INVALID_TOKEN', 401));
    }
    
    // Get user from database
    let user;
    if (db) {
      const stmt = db.prepare('SELECT id, username, email, role, createdAt FROM users WHERE id = ?');
      user = stmt.get(decoded.userId);
    }
    
    if (!user) {
      return reply.code(404).send(errorResponse('User not found', 'USER_NOT_FOUND', 404));
    }
    
    return reply.send(successResponse({ user }, 'User retrieved successfully'));
  } catch (error) {
    app.log.error('Get user error:', error.message);
    return reply.code(500).send(errorResponse('Internal server error', 'GET_USER_FAILED', 500));
  }
});

// ============================================================================
// GAMES ROUTES (Protected)
// ============================================================================

app.get('/api/v1/games', async (request, reply) => {
  try {
    // This route is public - no auth required
    let games = [];
    
    if (db) {
      const stmt = db.prepare('SELECT * FROM games ORDER BY createdAt DESC');
      games = stmt.all();
    } else {
      // Fallback to legacy data
      const fs = await import('fs');
      const path = await import('path');
      const gamesPath = path.join(__dirname, '../../data/games.json');
      
      if (fs.existsSync(gamesPath)) {
        const data = fs.readFileSync(gamesPath, 'utf8');
        games = JSON.parse(data);
      }
    }
    
    return reply.send(successResponse({ games }, 'Games retrieved successfully'));
  } catch (error) {
    app.log.error('Get games error:', error.message);
    return reply.code(500).send(errorResponse('Internal server error', 'GET_GAMES_FAILED', 500));
  }
});

app.get('/api/v1/games/:id', async (request, reply) => {
  try {
    const { id } = request.params;
    
    let game;
    if (db) {
      const stmt = db.prepare('SELECT * FROM games WHERE id = ?');
      game = stmt.get(id);
    }
    
    if (!game) {
      return reply.code(404).send(errorResponse('Game not found', 'GAME_NOT_FOUND', 404));
    }
    
    return reply.send(successResponse({ game }, 'Game retrieved successfully'));
  } catch (error) {
    app.log.error('Get game error:', error.message);
    return reply.code(500).send(errorResponse('Internal server error', 'GET_GAME_FAILED', 500));
  }
});

// Protected route example
app.get('/api/v1/admin/stats', {
  preHandler: protectRoute([ROLES.ADMIN]),
}, async (request, reply) => {
  try {
    // Only admins can access this
    const stats = {
      totalUsers: 0,
      totalGames: 0,
      activeUsers: 0,
    };
    
    if (db) {
      const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
      const gameCount = db.prepare('SELECT COUNT(*) as count FROM games').get();
      stats.totalUsers = userCount.count;
      stats.totalGames = gameCount.count;
    }
    
    return reply.send(successResponse({ stats }, 'Admin stats retrieved successfully'));
  } catch (error) {
    app.log.error('Get admin stats error:', error.message);
    return reply.code(500).send(errorResponse('Internal server error', 'GET_STATS_FAILED', 500));
  }
});

// ============================================================================
// DATABASE INITIALIZATION
// ============================================================================

const initializeDatabase = () => {
  if (!db) {
    console.log('Skipping database initialization - no database connection');
    return;
  }
  
  try {
    // Create users table
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);
    
    // Create games table
    db.exec(`
      CREATE TABLE IF NOT EXISTS games (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT,
        thumbnailUrl TEXT,
        gameUrl TEXT,
        plays INTEGER DEFAULT 0,
        rating REAL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);
    
    console.log('Database tables initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error.message);
  }
};

// ============================================================================
// SERVER STARTUP
// ============================================================================

const start = async () => {
  try {
    initializeDatabase();
    
    await app.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`🚀 API Server running at http://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
    console.log(`🔐 API v1: http://localhost:${PORT}/api/v1`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();

export default app;
