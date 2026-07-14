/**
 * @fileoverview Auth request validator schemas.
 *
 * Each schema exposes a `validate(data)` method returning:
 *   { isValid: boolean, errors: Array<{ field: string; message: string }> }
 *
 * This contract is consumed by the existing `validate` middleware in
 * `src/middleware/validate.middleware.js` without any modification.
 *
 * Validation rules:
 *   - email       — valid RFC-5322-compatible format, lowercase, max 254 chars
 *   - password    — min 8 / max 128 chars, at least one uppercase, one digit,
 *                   one special character (production-grade strength)
 *   - fullName    — 2–100 chars, trimmed
 *   - role        — must be one of the defined APP_CONSTANTS.ROLES values
 *   - token       — required, non-empty string
 */

import { APP_CONSTANTS } from '../constants/appConstants.js';

const { ROLES, PASSWORD } = APP_CONSTANTS;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** @param {string} email */
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);

/** @param {string} password */
const isStrongPassword = (password) =>
  /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/.test(password);

/**
 * Adds an error to the collector array.
 *
 * @param {Array<{field:string;message:string}>} errors
 * @param {string} field
 * @param {string} message
 */
const addError = (errors, field, message) => errors.push({ field, message });

// ── Register Schema ───────────────────────────────────────────────────────────

/**
 * Validates registration request body.
 * Required: fullName, email, password
 * Optional: role (defaults to viewer in service), company
 *
 * @type {{ validate(data: object): { isValid: boolean; errors: Array<{field:string;message:string}> } }}
 */
export const registerSchema = {
  validate(data) {
    /** @type {Array<{field:string;message:string}>} */
    const errors = [];

    const { fullName, email, password, confirmPassword, role } = data;

    // fullName
    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      addError(errors, 'fullName', 'Full name must be at least 2 characters.');
    } else if (fullName.trim().length > 100) {
      addError(errors, 'fullName', 'Full name must not exceed 100 characters.');
    }

    // email
    if (!email || typeof email !== 'string' || email.trim() === '') {
      addError(errors, 'email', 'Email address is required.');
    } else if (!isValidEmail(email.trim())) {
      addError(errors, 'email', 'Please provide a valid email address.');
    } else if (email.trim().length > 254) {
      addError(errors, 'email', 'Email address must not exceed 254 characters.');
    }

    // password
    if (!password || typeof password !== 'string' || password.length === 0) {
      addError(errors, 'password', 'Password is required.');
    } else if (password.length < PASSWORD.MIN_LENGTH) {
      addError(errors, 'password', `Password must be at least ${PASSWORD.MIN_LENGTH} characters.`);
    } else if (password.length > PASSWORD.MAX_LENGTH) {
      addError(errors, 'password', `Password must not exceed ${PASSWORD.MAX_LENGTH} characters.`);
    } else if (!isStrongPassword(password)) {
      addError(
        errors,
        'password',
        'Password must contain at least one uppercase letter, one digit, and one special character.'
      );
    }

    // confirmPassword (optional — but if provided must match)
    if (confirmPassword !== undefined && confirmPassword !== password) {
      addError(errors, 'confirmPassword', 'Passwords do not match.');
    }

    // role (optional — must be valid if supplied)
    if (role !== undefined && !Object.values(ROLES).includes(role)) {
      addError(errors, 'role', `Role must be one of: ${Object.values(ROLES).join(', ')}.`);
    }

    return { isValid: errors.length === 0, errors };
  },
};

// ── Login Schema ──────────────────────────────────────────────────────────────

/**
 * Validates login request body.
 * Required: email, password
 *
 * @type {{ validate(data: object): { isValid: boolean; errors: Array<{field:string;message:string}> } }}
 */
export const loginSchema = {
  validate(data) {
    const errors = [];
    const { email, password } = data;

    if (!email || typeof email !== 'string' || email.trim() === '') {
      addError(errors, 'email', 'Email address is required.');
    } else if (!isValidEmail(email.trim())) {
      addError(errors, 'email', 'Please provide a valid email address.');
    }

    if (!password || typeof password !== 'string' || password.length === 0) {
      addError(errors, 'password', 'Password is required.');
    }

    return { isValid: errors.length === 0, errors };
  },
};

// ── Refresh Token Schema ──────────────────────────────────────────────────────

/**
 * Validates refresh token request body.
 * Required: refreshToken
 *
 * @type {{ validate(data: object): { isValid: boolean; errors: Array<{field:string;message:string}> } }}
 */
export const refreshSchema = {
  validate(data) {
    const errors = [];
    const { refreshToken } = data;

    if (!refreshToken || typeof refreshToken !== 'string' || refreshToken.trim() === '') {
      addError(errors, 'refreshToken', 'Refresh token is required.');
    }

    return { isValid: errors.length === 0, errors };
  },
};

// ── Forgot Password Schema ────────────────────────────────────────────────────

/**
 * Validates forgot-password request body.
 * Required: email
 *
 * @type {{ validate(data: object): { isValid: boolean; errors: Array<{field:string;message:string}> } }}
 */
export const forgotPasswordSchema = {
  validate(data) {
    const errors = [];
    const { email } = data;

    if (!email || typeof email !== 'string' || email.trim() === '') {
      addError(errors, 'email', 'Email address is required.');
    } else if (!isValidEmail(email.trim())) {
      addError(errors, 'email', 'Please provide a valid email address.');
    }

    return { isValid: errors.length === 0, errors };
  },
};

// ── Reset Password Schema ─────────────────────────────────────────────────────

/**
 * Validates reset-password request body.
 * Required: token, password, confirmPassword
 *
 * @type {{ validate(data: object): { isValid: boolean; errors: Array<{field:string;message:string}> } }}
 */
export const resetPasswordSchema = {
  validate(data) {
    const errors = [];
    const { token, password, confirmPassword } = data;

    if (!token || typeof token !== 'string' || token.trim() === '') {
      addError(errors, 'token', 'Reset token is required.');
    }

    if (!password || typeof password !== 'string' || password.length === 0) {
      addError(errors, 'password', 'New password is required.');
    } else if (password.length < PASSWORD.MIN_LENGTH) {
      addError(errors, 'password', `Password must be at least ${PASSWORD.MIN_LENGTH} characters.`);
    } else if (password.length > PASSWORD.MAX_LENGTH) {
      addError(errors, 'password', `Password must not exceed ${PASSWORD.MAX_LENGTH} characters.`);
    } else if (!isStrongPassword(password)) {
      addError(
        errors,
        'password',
        'Password must contain at least one uppercase letter, one digit, and one special character.'
      );
    }

    if (!confirmPassword || typeof confirmPassword !== 'string' || confirmPassword.length === 0) {
      addError(errors, 'confirmPassword', 'Password confirmation is required.');
    } else if (confirmPassword !== password) {
      addError(errors, 'confirmPassword', 'Passwords do not match.');
    }

    return { isValid: errors.length === 0, errors };
  },
};
