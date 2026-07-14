/**
 * @fileoverview Environment variable validator.
 * Executed synchronously during application startup before any modules are loaded.
 * Applies default values for optional variables and fails fast on missing required ones.
 */

/**
 * @typedef {Object} EnvVariableSchema
 * @property {string} name - Environment variable name
 * @property {boolean} required - Whether the variable must be present
 * @property {'string'|'number'|'boolean'} [type] - Expected type for validation
 * @property {string} [default] - Default value applied when variable is absent
 * @property {number} [minLength] - Minimum string length (security enforcement)
 */

/**
 * Full schema for all environment variables used by DevWatch.
 * @type {EnvVariableSchema[]}
 */
const ENV_SCHEMA = [
  {
    name: 'PORT',
    required: false,
    type: 'number',
    default: '5000',
  },
  {
    name: 'NODE_ENV',
    required: false,
    type: 'string',
    default: 'development',
  },
  {
    name: 'MONGO_URI',
    required: true,
    type: 'string',
  },
  {
    name: 'JWT_SECRET',
    required: true,
    type: 'string',
    minLength: 32,
  },
  {
    name: 'JWT_EXPIRE',
    required: false,
    type: 'string',
    default: '7d',
  },
  {
    name: 'CLIENT_URL',
    required: false,
    type: 'string',
    default: 'http://localhost:3000',
  },
  {
    name: 'LOG_LEVEL',
    required: false,
    type: 'string',
    default: 'info',
  },
  {
    name: 'SOCKET_PORT',
    required: false,
    type: 'number',
    default: '5000',
  },
];

/**
 * @typedef {Object} EnvValidationError
 * @property {string} variable - The environment variable name
 * @property {string} reason - Description of why validation failed
 */

/**
 * Validates all environment variables against the schema.
 *
 * - Applies default values for optional missing variables.
 * - Accumulates all errors before throwing (fail-all, not fail-fast).
 * - Provides actionable error messages for each invalid variable.
 *
 * @returns {void}
 * @throws {Error} When one or more required variables are missing or invalid
 */
export const validateEnv = () => {
  /** @type {EnvValidationError[]} */
  const errors = [];

  for (const schema of ENV_SCHEMA) {
    const raw = process.env[schema.name];

    // Apply default if absent and not required
    if (raw === undefined || raw === null || raw.trim() === '') {
      if (schema.required) {
        errors.push({
          variable: schema.name,
          reason: 'Required environment variable is not set.',
        });
        continue;
      }

      if (schema.default !== undefined) {
        process.env[schema.name] = schema.default;
      }
      continue;
    }

    // Type validation
    if (schema.type === 'number' && isNaN(Number(raw))) {
      errors.push({
        variable: schema.name,
        reason: `Expected a numeric value but received "${raw}".`,
      });
      continue;
    }

    // Minimum length enforcement
    if (schema.minLength !== undefined && raw.trim().length < schema.minLength) {
      errors.push({
        variable: schema.name,
        reason: `Value is too short. Minimum ${schema.minLength} characters required (security requirement).`,
      });
    }
  }

  if (errors.length > 0) {
    const detail = errors.map((e) => `    ✖  ${e.variable.padEnd(16)} → ${e.reason}`).join('\n');

    throw new Error(
      `\n\n  [DevWatch] Environment validation failed (${errors.length} error${errors.length > 1 ? 's' : ''}):\n\n${detail}\n\n  Please update your .env file and restart the server.\n  See .env.example for a full template.\n`
    );
  }
};
