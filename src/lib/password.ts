import bcrypt from 'bcryptjs';

// Fresh DB, so there are no legacy PBKDF2 hashes to verify — we use bcrypt
// (works cleanly in Node, unlike inside Supabase Edge Functions, which is why
// the old stack used PBKDF2-via-WebCrypto). 10 rounds is a sensible default.
const SALT_ROUNDS = 10;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
