import crypto from 'crypto';
import { config } from '../config';

// Ensure we get a 32-byte Buffer key from the config
const getEncryptionKey = (): Buffer => {
  const key = config.ENCRYPTION_KEY;
  if (key.length === 64) {
    // Hex string representation of 32 bytes
    return Buffer.from(key, 'hex');
  }
  if (key.length === 32) {
    // Plain text 32 bytes
    return Buffer.from(key, 'utf8');
  }
  // If not matching, pad/hash to get a consistent 32-byte key
  return crypto.createHash('sha256').update(key).digest();
};

const ENCRYPTION_KEY_BUFFER = getEncryptionKey();
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

export interface EncryptedData {
  encryptedPat: string;
  iv: string;
  tag: string;
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 */
export function encrypt(text: string): EncryptedData {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY_BUFFER, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag();
  
  return {
    encryptedPat: encrypted,
    iv: iv.toString('hex'),
    tag: tag.toString('hex')
  };
}

/**
 * Decrypt an encrypted string using AES-256-GCM
 */
export function decrypt(encryptedPat: string, ivHex: string, tagHex: string): string {
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY_BUFFER, iv);
  
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encryptedPat, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
