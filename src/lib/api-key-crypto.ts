/**
 * API Key encryption utilities.
 *
 * Encrypts API keys with AES-256-GCM before storing in the database.
 * Uses a server-side encryption key from the AI_CONFIG_ENCRYPTION_KEY env var.
 * Format: base64(iv):base64(authTag):base64(ciphertext)
 */

import 'server-only';
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const TAG_LENGTH = 16; // 128 bits

/**
 * Get the encryption key from environment variables.
 * Generates a deterministic key if not set (for development only).
 */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.AI_CONFIG_ENCRYPTION_KEY;
  if (keyHex && keyHex.length === 64) {
    return Buffer.from(keyHex, 'hex');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'AI_CONFIG_ENCRYPTION_KEY must be set in production. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }

  // Development fallback: use a deterministic key derived from a known string
  // WARNING: This is NOT secure for production use
  return createHash('sha256').update('plantcaer-dev-encryption-key').digest();
}

/**
 * Encrypt a plaintext API key.
 * Returns a string in the format: base64(iv):base64(authTag):base64(ciphertext)
 */
export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext}`;
}

/**
 * Decrypt an encrypted API key string.
 * Input format: base64(iv):base64(authTag):base64(ciphertext)
 */
export function decryptApiKey(encrypted: string): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted key format');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const ciphertext = parts[2];

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
  plaintext += decipher.final('utf8');
  return plaintext;
}

/**
 * Mask an API key for display (show last 4 chars).
 * e.g. "sk-...****a1b2"
 */
export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) return '****';
  const prefix = apiKey.slice(0, 3);
  const suffix = apiKey.slice(-4);
  return `${prefix}...****${suffix}`;
}
