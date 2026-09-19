/**
 * @fileoverview Authentication Service for Game Vault
 * Handles JWT token generation, verification, and password hashing
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { ROLES, isValidEmail, isValidUsername } from '@game-vault/shared';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

/**
 * Hashes a password using bcrypt
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
export const hashPassword = async (password) => {
  return await bcrypt.hash(password, BCRYPT_ROUNDS);
};

/**
 * Verifies a password against a hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
export const verifyPassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

/**
 * Generates a JWT token for a user
 * @param {object} user - User object with id, username, email, role
 * @returns {string} JWT token
 */
export const generateToken = (user) => {
  const payload = {
    userId: user.id,
    username: user.username,
    email: user.email,
    role: user.role || ROLES.USER,
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};

/**
 * Verifies and decodes a JWT token
 * @param {string} token - JWT token
 * @returns {object|null} Decoded token payload or null if invalid
 */
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    console.error('Token verification failed:', error.message);
    return null;
  }
};

/**
 * Extracts token from Authorization header
 * @param {string} authHeader - Authorization header value
 * @returns {string|null} Token or null if not found
 */
export const extractTokenFromHeader = (authHeader) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
};

/**
 * Validates user registration data
 * @param {object} userData - User registration data
 * @returns {object} Validation result with isValid and errors
 */
export const validateRegistrationData = (userData) => {
  const errors = [];

  if (!userData.username || !isValidUsername(userData.username)) {
    errors.push('Invalid username. Must be 3-20 alphanumeric characters or underscores.');
  }

  if (!userData.email || !isValidEmail(userData.email)) {
    errors.push('Invalid email format.');
  }

  if (!userData.password || userData.password.length < 8) {
    errors.push('Password must be at least 8 characters long.');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Creates a new user object with hashed password
 * @param {object} userData - User registration data
 * @returns {Promise<object>} New user object
 */
export const createUser = async (userData) => {
  const validation = validateRegistrationData(userData);
  
  if (!validation.isValid) {
    throw new Error(validation.errors.join(', '));
  }

  const hashedPassword = await hashPassword(userData.password);

  return {
    id: uuidv4(),
    username: userData.username.toLowerCase(),
    email: userData.email.toLowerCase(),
    password: hashedPassword,
    role: userData.role || ROLES.USER,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

/**
 * Middleware factory for protecting routes
 * @param {string[]} allowedRoles - Array of roles allowed to access the route
 * @returns {function} Express/Fastify middleware function
 */
export const protectRoute = (allowedRoles = []) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.',
        code: 'NO_TOKEN',
      });
    }

    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token.',
        code: 'INVALID_TOKEN',
      });
    }

    // Attach user info to request
    req.user = {
      id: decoded.userId,
      username: decoded.username,
      email: decoded.email,
      role: decoded.role,
    };

    // Check if user has required role
    if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions.',
        code: 'FORBIDDEN',
      });
    }

    next();
  };
};

// Export all functions as default
export default {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  extractTokenFromHeader,
  validateRegistrationData,
  createUser,
  protectRoute,
};
