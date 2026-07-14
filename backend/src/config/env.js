/**
 * @fileoverview Central environment configuration loader.
 *
 * Responsibilities:
 *   1. Resolves and loads the .env file from the backend root.
 *   2. Delegates to the env validator to apply defaults and catch missing vars.
 *   3. Exports a single, deeply-frozen `config` object as the sole source of
 *      runtime configuration for the entire application.
 *
 * Import order matters: this module must be the first import in server.js
 * to ensure all environment variables are available before other modules run.
 */

import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';
import { validateEnv } from '../validators/env.validator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Load .env ─────────────────────────────────────────────────────────────────
// Resolves to backend/.env (two directories up from src/config/)
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// ── Validate ──────────────────────────────────────────────────────────────────
// Throws immediately if required variables are missing or invalid.
validateEnv();

// ── Config Object ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} JwtConfig
 * @property {string} secret        - JWT access token signing secret
 * @property {string} expire        - Access token expiry duration (e.g. '15m')
 * @property {string} refreshSecret - JWT refresh token signing secret
 * @property {string} refreshExpire - Refresh token expiry duration (e.g. '30d')
 */

/**
 * @typedef {Object} AppConfig
 * @property {string}    nodeEnv       - NODE_ENV value
 * @property {number}    port          - HTTP server port
 * @property {string}    mongoUri      - Full MongoDB connection string
 * @property {JwtConfig} jwt           - JWT secret and expiry
 * @property {string|undefined} openAiApiKey - OpenAI API key (optional)
 * @property {string}    clientUrl     - Allowed CORS origin
 * @property {string}    logLevel      - Winston log level
 * @property {number}    socketPort    - Socket.IO port (typically same as HTTP)
 * @property {boolean}   isProduction  - Shorthand for NODE_ENV === 'production'
 * @property {boolean}   isDevelopment - Shorthand for NODE_ENV === 'development'
 * @property {boolean}   isTest        - Shorthand for NODE_ENV === 'test'
 */

/** @type {Readonly<AppConfig>} */
export const config = Object.freeze({
  nodeEnv: process.env.NODE_ENV,
  port: parseInt(process.env.PORT, 10),
  mongoUri: process.env.MONGO_URI,

  jwt: Object.freeze({
    secret: process.env.JWT_SECRET,
    expire: process.env.JWT_EXPIRE,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpire: process.env.JWT_REFRESH_EXPIRE,
  }),

  openAiApiKey: process.env.OPENAI_API_KEY || undefined,
  clientUrl: process.env.CLIENT_URL,
  logLevel: process.env.LOG_LEVEL,
  socketPort: parseInt(process.env.SOCKET_PORT, 10),

  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',
  isTest: process.env.NODE_ENV === 'test',
});
