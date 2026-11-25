-- one-off for databases created before 2026-11-25
ALTER TABLE papers ADD COLUMN rv REAL;
ALTER TABLE papers ADD COLUMN ins TEXT;
