BEGIN;

-- 1. Enable trigram matching (fast partial search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Fast client search on Name, IDNumber, Phone
CREATE INDEX IF NOT EXISTS "IX_Clients_FullName_trgm"
  ON "Clients" USING gin ("FullName" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "IX_Clients_IDNumber_trgm"
  ON "Clients" USING gin ("IDNumber" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "IX_Clients_PhoneNumber_trgm"
  ON "Clients" USING gin ("PhoneNumber" gin_trgm_ops);

-- 3. Active-only partial index (most searches filter Deleted = false)
CREATE INDEX IF NOT EXISTS "IX_Clients_Active"
  ON "Clients" ("Id") WHERE "Deleted" = false;

-- 4. Tallies — for analytics + per-client history
CREATE INDEX IF NOT EXISTS "IX_Tallies_ClientId"
  ON "Tallies" ("ClientId") WHERE "Deleted" = false;

CREATE INDEX IF NOT EXISTS "IX_Tallies_StationId_PostedOn"
  ON "Tallies" ("StationId", "PostedOn" DESC) WHERE "Deleted" = false;

CREATE INDEX IF NOT EXISTS "IX_Tallies_PostedOn"
  ON "Tallies" ("PostedOn" DESC) WHERE "Deleted" = false;

-- 5. TallyReferrals — already indexed on TallyId/ReferralId, add covering
CREATE INDEX IF NOT EXISTS "IX_TallyReferrals_TallyId_ReferralId"
  ON "TallyReferrals" ("TallyId", "ReferralId");

COMMIT;

-- Verify
SELECT indexname FROM pg_indexes
WHERE tablename IN ('Clients', 'Tallies', 'TallyReferrals')
ORDER BY tablename, indexname;