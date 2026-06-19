// Simple file-based logger for debugging
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const LOG_FILE = join(process.cwd(), 'debug.log');

export function debugLog(...args) {
  const timestamp = new Date().toISOString();
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  const logLine = `[${timestamp}] ${message}\n`;
  
  try {
    appendFileSync(LOG_FILE, logLine);
  } catch (e) {
    // fallback to console if file fails
    console.log('[DEBUG]', ...args);
  }
}
