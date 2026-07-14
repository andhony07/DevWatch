/**
 * @fileoverview Startup banner renderer for the DevWatch backend server.
 * Outputs a colorized ASCII banner to stdout on successful server boot.
 */

import { APP_CONSTANTS } from '../constants/appConstants.js';

/**
 * ANSI escape code helpers.
 * @type {Record<string, string>}
 */
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  dim: '\x1b[2m',
};

/** Border width (characters). */
const WIDTH = 64;

/**
 * Draws a horizontal border line.
 * @param {'top'|'mid'|'bot'} [type='mid']
 * @returns {string}
 */
const border = (type = 'mid') => {
  const chars = {
    top: ['╔', '═', '╗'],
    mid: ['╠', '═', '╣'],
    bot: ['╚', '═', '╝'],
  }[type];
  return `${C.cyan}${chars[0]}${chars[1].repeat(WIDTH - 2)}${chars[2]}${C.reset}`;
};

/**
 * Wraps content in a bordered row, padding to the full border width.
 * @param {string} rawText - Visible text (no ANSI codes for length calc)
 * @param {string} [styledText] - ANSI-styled version (defaults to rawText)
 * @returns {string}
 */
const row = (rawText, styledText) => {
  const content = styledText ?? rawText;
  const padding = WIDTH - 2 - rawText.length;
  const left = Math.floor(padding / 2);
  const right = padding - left;
  return `${C.cyan}║${C.reset}${' '.repeat(left)}${content}${' '.repeat(right)}${C.cyan}║${C.reset}`;
};

/**
 * Renders a key-value info row inside the banner.
 * @param {string} label - Display label (e.g. 'Version')
 * @param {string} value - Displayed value
 * @returns {string}
 */
const infoRow = (label, value) => {
  const icon = '◆';
  const labelStr = `${icon} ${label.padEnd(13)}:  `;
  const raw = `  ${labelStr}${value}`;
  const styled = `  ${C.magenta}${icon} ${label.padEnd(13)}:${C.reset}  ${C.white}${value}${C.reset}`;
  const padding = WIDTH - 2 - raw.length;
  return `${C.cyan}║${C.reset}${styled}${' '.repeat(Math.max(0, padding))}${C.cyan}║${C.reset}`;
};

/**
 * Masks credentials in a MongoDB URI for safe display.
 * @param {string} uri
 * @returns {string}
 */
const maskMongoUri = (uri) => {
  if (!uri) {
    return 'Not configured';
  }
  return uri.replace(/:\/\/([^:@]+):([^@]+)@/, '://**:**@');
};

/**
 * Displays the DevWatch startup banner in the terminal.
 *
 * @param {{ port: number; environment: string; mongoUri: string }} options
 * @returns {void}
 */
export const displayBanner = ({ port, environment, mongoUri }) => {
  const apiBase = `http://localhost:${port}/api/v1`;
  const maskedUri = maskMongoUri(mongoUri);

  const lines = [
    '',
    border('top'),
    row('', ''),
    row(
      '  ____  _____   ____  _    _   __  ____  ____  ___  _  _',
      `  ${C.bold}${C.green} ____  _____   ____  _    _   __  ____  ____  ___  _  _ ${C.reset}`
    ),
    row(
      ' |  _ \\| ____| |  _ \\| |  | | / _||  _ \\/ ___||  _|| || |',
      ` ${C.bold}${C.green}|  _ \\| ____| |  _ \\| |  | | / _||  _ \\/ ___||  _|| || |${C.reset}`
    ),
    row(
      ' | | | |  _|   | | | | |  | |/ /  | |_| | |  | |   | __ |',
      ` ${C.bold}${C.green}| | | |  _|   | | | | |  | |/ /  | |_| | |  | |   | __ |${C.reset}`
    ),
    row(
      ' | |_| | |___  | |_| | |__| |\\ \\  |  _ <| |__| |___| || |',
      ` ${C.bold}${C.green}| |_| | |___  | |_| | |__| |\\ \\  |  _ <| |__| |___| || |${C.reset}`
    ),
    row(
      ' |____/|_____| |____/|______/ \\_\\ |_| \\_\\\\____|_____|_||_|',
      ` ${C.bold}${C.green}|____/|_____| |____/|______/ \\_\\ |_| \\_\\\\____|_____|_||_|${C.reset}`
    ),
    row('', ''),
    row(
      'AI Cloud-Based DevOps Monitoring Dashboard',
      `${C.yellow}AI Cloud-Based DevOps Monitoring Dashboard${C.reset}`
    ),
    row('', ''),
    border('mid'),
    infoRow('Version', APP_CONSTANTS.APP_VERSION),
    infoRow('Environment', environment),
    infoRow('Port', String(port)),
    infoRow('API Base', apiBase),
    infoRow('Database', maskedUri.length > 40 ? `${maskedUri.slice(0, 40)}...` : maskedUri),
    border('bot'),
    '',
  ];

  process.stdout.write(`${lines.join('\n')}\n`);
};
