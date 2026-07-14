/**
 * @fileoverview Auth DTOs (Data Transfer Objects).
 *
 * DTOs are immutable value objects that:
 *   1. Accept raw request bodies via a static `fromRequest(body)` factory.
 *   2. Expose only the fields each operation needs (no extra data leaks).
 *   3. Provide a `toSafeObject()` method that scrubs any sensitive fields
 *      before the DTO is passed to logging or response serialization.
 *
 * DTOs do NOT perform validation — that responsibility belongs to the
 * validator schemas in `src/validators/auth.validator.js`.
 */

// ── Register ──────────────────────────────────────────────────────────────────

/**
 * @class RegisterDTO
 * Carries registration input from the HTTP layer into the service layer.
 */
export class RegisterDTO {
  /**
   * @param {object} params
   * @param {string} params.fullName
   * @param {string} params.email
   * @param {string} params.password
   * @param {string} [params.role]
   * @param {string} [params.company]
   */
  constructor({ fullName, email, password, role, company }) {
    this.fullName = fullName?.trim();
    this.email = email?.toLowerCase().trim();
    this.password = password;
    this.role = role;
    this.company = company?.trim() ?? null;
  }

  /**
   * Factory — builds a RegisterDTO from a raw Express request body.
   *
   * @param {object} body - req.body
   * @returns {RegisterDTO}
   */
  static fromRequest(body) {
    return new RegisterDTO(body);
  }

  /**
   * Returns a representation safe for logging (no password).
   *
   * @returns {{ fullName: string; email: string; role: string|undefined; company: string|null }}
   */
  toSafeObject() {
    return {
      fullName: this.fullName,
      email: this.email,
      role: this.role,
      company: this.company,
    };
  }
}

// ── Login ─────────────────────────────────────────────────────────────────────

/**
 * @class LoginDTO
 * Carries login credentials from the HTTP layer into the service layer.
 */
export class LoginDTO {
  /**
   * @param {object} params
   * @param {string} params.email
   * @param {string} params.password
   */
  constructor({ email, password }) {
    this.email = email?.toLowerCase().trim();
    this.password = password;
  }

  /**
   * @param {object} body - req.body
   * @returns {LoginDTO}
   */
  static fromRequest(body) {
    return new LoginDTO(body);
  }

  /**
   * @returns {{ email: string }}
   */
  toSafeObject() {
    return { email: this.email };
  }
}

// ── Refresh Token ─────────────────────────────────────────────────────────────

/**
 * @class RefreshTokenDTO
 * Carries the raw refresh token from the HTTP layer into the service layer.
 */
export class RefreshTokenDTO {
  /**
   * @param {object} params
   * @param {string} params.refreshToken
   */
  constructor({ refreshToken }) {
    this.refreshToken = refreshToken?.trim();
  }

  /**
   * @param {object} body - req.body
   * @returns {RefreshTokenDTO}
   */
  static fromRequest(body) {
    return new RefreshTokenDTO(body);
  }

  /**
   * @returns {{ refreshToken: '[redacted]' }}
   */
  toSafeObject() {
    return { refreshToken: '[redacted]' };
  }
}

// ── Forgot Password ───────────────────────────────────────────────────────────

/**
 * @class ForgotPasswordDTO
 * Carries the email for a password-reset request.
 */
export class ForgotPasswordDTO {
  /**
   * @param {object} params
   * @param {string} params.email
   */
  constructor({ email }) {
    this.email = email?.toLowerCase().trim();
  }

  /**
   * @param {object} body - req.body
   * @returns {ForgotPasswordDTO}
   */
  static fromRequest(body) {
    return new ForgotPasswordDTO(body);
  }

  /**
   * @returns {{ email: string }}
   */
  toSafeObject() {
    return { email: this.email };
  }
}

// ── Reset Password ────────────────────────────────────────────────────────────

/**
 * @class ResetPasswordDTO
 * Carries the reset token and new password into the service layer.
 */
export class ResetPasswordDTO {
  /**
   * @param {object} params
   * @param {string} params.token        - The raw reset token from the URL / body
   * @param {string} params.password     - New plain-text password
   * @param {string} params.confirmPassword - Confirmation (validated before DTO is created)
   */
  constructor({ token, password, confirmPassword }) {
    this.token = token?.trim();
    this.password = password;
    this.confirmPassword = confirmPassword;
  }

  /**
   * @param {object} body - req.body
   * @returns {ResetPasswordDTO}
   */
  static fromRequest(body) {
    return new ResetPasswordDTO(body);
  }

  /**
   * @returns {{ token: string }}
   */
  toSafeObject() {
    return { token: this.token };
  }
}
