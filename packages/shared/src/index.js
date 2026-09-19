/**
 * @fileoverview Shared utilities and constants for Game Vault
 * @module @game-vault/shared
 */

// ============================================================================
// CONSTANTS
// ============================================================================

export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  GUEST: 'guest',
};

export const GAME_CATEGORIES = {
  ACTION: 'action',
  ADVENTURE: 'adventure',
  PUZZLE: 'puzzle',
  STRATEGY: 'strategy',
  SIMULATION: 'simulation',
  ARCADE: 'arcade',
};

export const API_VERSIONS = {
  V1: 'v1',
  V2: 'v2',
};

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ============================================================================
// VALIDATION UTILITIES
// ============================================================================

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validates username format
 * @param {string} username - Username to validate
 * @returns {boolean} True if valid username
 */
export const isValidUsername = (username) => {
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  return usernameRegex.test(username);
};

/**
 * Sanitizes user input to prevent XSS
 * @param {string} input - Input string to sanitize
 * @returns {string} Sanitized string
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

/**
 * Creates a standardized success response
 * @param {any} data - Response data
 * @param {string} message - Success message
 * @returns {object} Standardized response object
 */
export const successResponse = (data, message = 'Success') => ({
  success: true,
  message,
  data,
  timestamp: new Date().toISOString(),
});

/**
 * Creates a standardized error response
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {number} statusCode - HTTP status code
 * @returns {object} Standardized error response object
 */
export const errorResponse = (message, code = 'ERROR', statusCode = 500) => ({
  success: false,
  message,
  code,
  statusCode,
  timestamp: new Date().toISOString(),
});

// ============================================================================
// PAGINATION HELPER
// ============================================================================

/**
 * Creates pagination metadata
 * @param {number} page - Current page
 * @param {number} pageSize - Items per page
 * @param {number} totalItems - Total number of items
 * @returns {object} Pagination metadata
 */
export const createPaginationMeta = (page, pageSize, totalItems) => {
  const totalPages = Math.ceil(totalItems / pageSize);
  return {
    currentPage: page,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

// ============================================================================
// DATE UTILITIES
// ============================================================================

/**
 * Formats date to ISO string
 * @param {Date|string} date - Date to format
 * @returns {string} ISO formatted date string
 */
export const formatDate = (date) => {
  return new Date(date).toISOString();
};

/**
 * Checks if date is in the past
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if date is in the past
 */
export const isPastDate = (date) => {
  return new Date(date) < new Date();
};

// ============================================================================
// EXPORT ALL
// ============================================================================

export default {
  ROLES,
  GAME_CATEGORIES,
  API_VERSIONS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  isValidEmail,
  isValidUsername,
  sanitizeInput,
  successResponse,
  errorResponse,
  createPaginationMeta,
  formatDate,
  isPastDate,
};
