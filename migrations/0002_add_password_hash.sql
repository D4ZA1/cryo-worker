-- D1 Migration 0002: Add password_hash for custom auth (PBKDF2 salted)
ALTER TABLE profiles ADD COLUMN password_hash TEXT;
