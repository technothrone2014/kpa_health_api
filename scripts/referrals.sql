BEGIN;

-- ============================================
-- 1. Lookup table for referral types
-- ============================================
CREATE TABLE "Referrals" (
  "Id" SERIAL PRIMARY KEY,
  "UserId" INTEGER,
  "Title" VARCHAR(50) NOT NULL,
  "LegacyColumn" VARCHAR(50),          -- maps to the Tallies boolean column (nullable for future custom referrals)
  "SortOrder" INTEGER NOT NULL DEFAULT 100,
  "PostedOn" TIMESTAMP NOT NULL DEFAULT NOW(),
  "UpdatedOn" TIMESTAMP NOT NULL DEFAULT NOW(),
  "Pinned" BOOLEAN NOT NULL DEFAULT false,
  "Status" BOOLEAN NOT NULL DEFAULT true,
  "Deleted" BOOLEAN NOT NULL DEFAULT false
);

ALTER TABLE "Referrals" ADD CONSTRAINT "FK_Referrals_Users"
  FOREIGN KEY ("UserId") REFERENCES "Users"("Id");

-- ============================================
-- 2. Join table — many-to-many between Tallies and Referrals
-- ============================================
CREATE TABLE "TallyReferrals" (
  "Id" SERIAL PRIMARY KEY,
  "TallyId" INTEGER NOT NULL,
  "ReferralId" INTEGER NOT NULL,
  "PostedOn" TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT "UQ_TallyReferrals" UNIQUE ("TallyId", "ReferralId")
);

ALTER TABLE "TallyReferrals" ADD CONSTRAINT "FK_TallyReferrals_Tallies"
  FOREIGN KEY ("TallyId") REFERENCES "Tallies"("Id") ON DELETE CASCADE;
ALTER TABLE "TallyReferrals" ADD CONSTRAINT "FK_TallyReferrals_Referrals"
  FOREIGN KEY ("ReferralId") REFERENCES "Referrals"("Id");

CREATE INDEX "IX_TallyReferrals_TallyId" ON "TallyReferrals"("TallyId");
CREATE INDEX "IX_TallyReferrals_ReferralId" ON "TallyReferrals"("ReferralId");

-- ============================================
-- 3. Seed with the 12 current hardcoded referrals
-- ============================================
INSERT INTO "Referrals" ("Title", "LegacyColumn", "SortOrder") VALUES
  ('BMD',           'BMD',                  1),
  ('Cancer Screen', 'CancerSCN',            2),
  ('Dental Screen', 'DentalSCN',            3),
  ('ECG',           'ECG',                  4),
  ('Eye Screen',    'EyeSCN',               5),
  ('FBS',           'FBS',                  6),
  ('HbA1c',         'HBA1C',                7),
  ('Hep B/C',       'HepatitisBC',          8),
  ('Lipid Profile', 'Lipid',                9),
  ('Microalbumin',  'Microalbumin',         10),
  ('Nutrition',     'NutritionCounselling', 11),
  ('PSA',           'PSA',                  12);

-- ============================================
-- 4. Backfill join table from historical booleans
-- ============================================
INSERT INTO "TallyReferrals" ("TallyId", "ReferralId")
SELECT t."Id", r."Id"
FROM "Tallies" t
CROSS JOIN "Referrals" r
WHERE r."LegacyColumn" IS NOT NULL
  AND (
       (r."LegacyColumn" = 'BMD'                  AND t."BMD" = true)
    OR (r."LegacyColumn" = 'CancerSCN'            AND t."CancerSCN" = true)
    OR (r."LegacyColumn" = 'DentalSCN'            AND t."DentalSCN" = true)
    OR (r."LegacyColumn" = 'ECG'                  AND t."ECG" = true)
    OR (r."LegacyColumn" = 'EyeSCN'               AND t."EyeSCN" = true)
    OR (r."LegacyColumn" = 'FBS'                  AND t."FBS" = true)
    OR (r."LegacyColumn" = 'HBA1C'                AND t."HBA1C" = true)
    OR (r."LegacyColumn" = 'HepatitisBC'          AND t."HepatitisBC" = true)
    OR (r."LegacyColumn" = 'Lipid'                AND t."Lipid" = true)
    OR (r."LegacyColumn" = 'Microalbumin'         AND t."Microalbumin" = true)
    OR (r."LegacyColumn" = 'NutritionCounselling' AND t."NutritionCounselling" = true)
    OR (r."LegacyColumn" = 'PSA'                  AND t."PSA" = true)
  );

-- ============================================
-- 5. Verify
-- ============================================
SELECT 'Referrals seeded' AS step, COUNT(*) AS count FROM "Referrals"
UNION ALL
SELECT 'Historical links', COUNT(*) FROM "TallyReferrals";

COMMIT;