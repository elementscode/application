import * as crypto from 'crypto';
import * as base64Url from 'base64-url';

/**
 * The algorithm used for encryption.
 */
export const ALGORITHM = 'aes-256-cbc';

/**
 * Encrypt the text with the given password.
 */
export function encrypt(text: string, password: string): string {
  let cipher = crypto.createCipher(ALGORITHM, password);
  let result = cipher.update(text, 'utf8', 'hex');
  result += cipher.final('hex');
  return result;
}

/**
 * Descrypt the text with the given password.
 */
export function decrypt(text: string, password: string): string {
  let decipher = crypto.createDecipher(ALGORITHM, password);
  let result = decipher.update(text, 'hex', 'utf8');
  result += decipher.final('utf8');
  return result;
}

/**
 * Create a secure signature for the text, with the given password.
 */
export function sign(text: string, password: string): string {
  let hmac = crypto.createHmac('sha256', password);
  return base64Url.escape(hmac.update(text).digest('base64'));
}

/**
 * Verify the signature of a text string. This checks that the signature we
 * would produce for the text is the same as the signature provided. It tells us
 * whether the text was tampered with.
 */
export function verify(text: string, signature: string, password: string): boolean {
  let expected = sign(text, password);
  return expected === signature;
}
