-- ============================================
-- COMPLETE FIX SCRIPT FOR ALL KPA TABLES
-- (Preserves ALL existing columns)
-- ============================================

BEGIN;

-- ============================================
-- FIRST: FIX REFERENCE TABLES (Preserving ALL columns)
-- ============================================

-- Fix Categories - Preserve all columns: Id, UserId, Title, PostedOn, UpdatedOn, Pinned, Status, Deleted
ALTER TABLE "Categories" RENAME TO "Categories_old";
CREATE TABLE "Categories" (
    "Id" SERIAL PRIMARY KEY,
    "UserId" INTEGER NOT NULL,
    "Title" VARCHAR(30) NOT NULL,
    "PostedOn" TIMESTAMP NOT NULL,
    "UpdatedOn" TIMESTAMP NOT NULL,
    "Pinned" BOOLEAN NOT NULL,
    "Status" BOOLEAN NOT NULL,
    "Deleted" BOOLEAN NOT NULL
);
INSERT INTO "Categories" ("Id", "UserId", "Title", "PostedOn", "UpdatedOn", "Pinned", "Status", "Deleted")
SELECT "Id", "UserId", "Title", "PostedOn", "UpdatedOn", "Pinned", "Status", "Deleted" 
FROM "Categories_old" ORDER BY "Id";
SELECT setval('"Categories_Id_seq"', (SELECT MAX("Id") FROM "Categories"));
DROP TABLE "Categories_old";


-- Fix Genders - Preserve all columns: Id, UserId, Title, PostedOn, UpdatedOn, Pinned, Status, Deleted
ALTER TABLE "Genders" RENAME TO "Genders_old";
CREATE TABLE "Genders" (
    "Id" SERIAL PRIMARY KEY,
    "UserId" INTEGER NOT NULL,
    "Title" VARCHAR(30) NOT NULL,
    "PostedOn" TIMESTAMP NOT NULL,
    "UpdatedOn" TIMESTAMP NOT NULL,
    "Pinned" BOOLEAN NOT NULL,
    "Status" BOOLEAN NOT NULL,
    "Deleted" BOOLEAN NOT NULL
);
INSERT INTO "Genders" ("Id", "UserId", "Title", "PostedOn", "UpdatedOn", "Pinned", "Status", "Deleted")
SELECT "Id", "UserId", "Title", "PostedOn", "UpdatedOn", "Pinned", "Status", "Deleted" 
FROM "Genders_old" ORDER BY "Id";
SELECT setval('"Genders_Id_seq"', (SELECT MAX("Id") FROM "Genders"));
DROP TABLE "Genders_old";

-- Fix Stations - Preserve all columns: Id, UserId, Title, PostedOn, UpdatedOn, Pinned, Status, Deleted
ALTER TABLE "Stations" RENAME TO "Stations_old";
CREATE TABLE "Stations" (
    "Id" SERIAL PRIMARY KEY,
    "UserId" INTEGER NOT NULL,
    "Title" VARCHAR(30) NOT NULL,
    "PostedOn" TIMESTAMP NOT NULL,
    "UpdatedOn" TIMESTAMP NOT NULL,
    "Pinned" BOOLEAN NOT NULL,
    "Status" BOOLEAN NOT NULL,
    "Deleted" BOOLEAN NOT NULL
);
INSERT INTO "Stations" ("Id", "UserId", "Title", "PostedOn", "UpdatedOn", "Pinned", "Status", "Deleted")
SELECT "Id", "UserId", "Title", "PostedOn", "UpdatedOn", "Pinned", "Status", "Deleted" 
FROM "Stations_old" ORDER BY "Id";
SELECT setval('"Stations_Id_seq"', (SELECT MAX("Id") FROM "Stations"));
DROP TABLE "Stations_old";

-- Fix Roles - Preserve all columns: Id, Name, NormalizedName, ConcurrencyStamp
ALTER TABLE "Roles" RENAME TO "Roles_old";
CREATE TABLE "Roles" (
    "Id" SERIAL PRIMARY KEY,
    "Name" VARCHAR(256),
    "NormalizedName" VARCHAR(256),
    "ConcurrencyStamp" TEXT
);
INSERT INTO "Roles" ("Id", "Name", "NormalizedName", "ConcurrencyStamp")
SELECT "Id", "Name", "NormalizedName", "ConcurrencyStamp" 
FROM "Roles_old" ORDER BY "Id";
SELECT setval('"Roles_Id_seq"', (SELECT MAX("Id") FROM "Roles"));
DROP TABLE "Roles_old";


-- Fix Lipids - Assuming similar structure to Categories
ALTER TABLE "Lipids" RENAME TO "Lipids_old";
CREATE TABLE "Lipids" AS SELECT * FROM "Lipids_old" WHERE 1=0;
ALTER TABLE "Lipids" DROP COLUMN IF EXISTS "Id" CASCADE;
ALTER TABLE "Lipids" ADD COLUMN "Id" SERIAL PRIMARY KEY;
INSERT INTO "Lipids" SELECT * FROM "Lipids_old" ORDER BY "Id";
SELECT setval('"Lipids_Id_seq"', (SELECT MAX("Id") FROM "Lipids"));
DROP TABLE "Lipids_old";

-- Fix HepatitisBValues
ALTER TABLE "HepatitisBValues" RENAME TO "HepatitisBValues_old";
CREATE TABLE "HepatitisBValues" AS SELECT * FROM "HepatitisBValues_old" WHERE 1=0;
ALTER TABLE "HepatitisBValues" DROP COLUMN IF EXISTS "Id" CASCADE;
ALTER TABLE "HepatitisBValues" ADD COLUMN "Id" SERIAL PRIMARY KEY;
INSERT INTO "HepatitisBValues" SELECT * FROM "HepatitisBValues_old" ORDER BY "Id";
SELECT setval('"HepatitisBValues_Id_seq"', (SELECT MAX("Id") FROM "HepatitisBValues"));
DROP TABLE "HepatitisBValues_old";

-- Fix HepatitisCValues
ALTER TABLE "HepatitisCValues" RENAME TO "HepatitisCValues_old";
CREATE TABLE "HepatitisCValues" AS SELECT * FROM "HepatitisCValues_old" WHERE 1=0;
ALTER TABLE "HepatitisCValues" DROP COLUMN IF EXISTS "Id" CASCADE;
ALTER TABLE "HepatitisCValues" ADD COLUMN "Id" SERIAL PRIMARY KEY;
INSERT INTO "HepatitisCValues" SELECT * FROM "HepatitisCValues_old" ORDER BY "Id";
SELECT setval('"HepatitisCValues_Id_seq"', (SELECT MAX("Id") FROM "HepatitisCValues"));
DROP TABLE "HepatitisCValues_old";

-- Fix BreastExams
ALTER TABLE "BreastExams" RENAME TO "BreastExams_old";
CREATE TABLE "BreastExams" AS SELECT * FROM "BreastExams_old" WHERE 1=0;
ALTER TABLE "BreastExams" DROP COLUMN IF EXISTS "Id" CASCADE;
ALTER TABLE "BreastExams" ADD COLUMN "Id" SERIAL PRIMARY KEY;
INSERT INTO "BreastExams" SELECT * FROM "BreastExams_old" ORDER BY "Id";
SELECT setval('"BreastExams_Id_seq"', (SELECT MAX("Id") FROM "BreastExams"));
DROP TABLE "BreastExams_old";

-- Fix PAPSmears
ALTER TABLE "PAPSmears" RENAME TO "PAPSmears_old";
CREATE TABLE "PAPSmears" AS SELECT * FROM "PAPSmears_old" WHERE 1=0;
ALTER TABLE "PAPSmears" DROP COLUMN IF EXISTS "Id" CASCADE;
ALTER TABLE "PAPSmears" ADD COLUMN "Id" SERIAL PRIMARY KEY;
INSERT INTO "PAPSmears" SELECT * FROM "PAPSmears_old" ORDER BY "Id";
SELECT setval('"PAPSmears_Id_seq"', (SELECT MAX("Id") FROM "PAPSmears"));
DROP TABLE "PAPSmears_old";

-- Fix ViaVillies
ALTER TABLE "ViaVillies" RENAME TO "ViaVillies_old";
CREATE TABLE "ViaVillies" AS SELECT * FROM "ViaVillies_old" WHERE 1=0;
ALTER TABLE "ViaVillies" DROP COLUMN IF EXISTS "Id" CASCADE;
ALTER TABLE "ViaVillies" ADD COLUMN "Id" SERIAL PRIMARY KEY;
INSERT INTO "ViaVillies" SELECT * FROM "ViaVillies_old" ORDER BY "Id";
SELECT setval('"ViaVillies_Id_seq"', (SELECT MAX("Id") FROM "ViaVillies"));
DROP TABLE "ViaVillies_old";


-- Fix INT Value tables
-- BPINTValues
ALTER TABLE "BPINTValues" RENAME TO "BPINTValues_old";
CREATE TABLE "BPINTValues" AS SELECT * FROM "BPINTValues_old" WHERE 1=0;
ALTER TABLE "BPINTValues" DROP COLUMN IF EXISTS "Id" CASCADE;
ALTER TABLE "BPINTValues" ADD COLUMN "Id" SERIAL PRIMARY KEY;
INSERT INTO "BPINTValues" SELECT * FROM "BPINTValues_old" ORDER BY "Id";
SELECT setval('"BPINTValues_Id_seq"', (SELECT MAX("Id") FROM "BPINTValues"));
DROP TABLE "BPINTValues_old";

-- BMIINTValues
ALTER TABLE "BMIINTValues" RENAME TO "BMIINTValues_old";
CREATE TABLE "BMIINTValues" AS SELECT * FROM "BMIINTValues_old" WHERE 1=0;
ALTER TABLE "BMIINTValues" DROP COLUMN IF EXISTS "Id" CASCADE;
ALTER TABLE "BMIINTValues" ADD COLUMN "Id" SERIAL PRIMARY KEY;
INSERT INTO "BMIINTValues" SELECT * FROM "BMIINTValues_old" ORDER BY "Id";
SELECT setval('"BMIINTValues_Id_seq"', (SELECT MAX("Id") FROM "BMIINTValues"));
DROP TABLE "BMIINTValues_old";

-- RBSINTValues
ALTER TABLE "RBSINTValues" RENAME TO "RBSINTValues_old";
CREATE TABLE "RBSINTValues" AS SELECT * FROM "RBSINTValues_old" WHERE 1=0;
ALTER TABLE "RBSINTValues" DROP COLUMN IF EXISTS "Id" CASCADE;
ALTER TABLE "RBSINTValues" ADD COLUMN "Id" SERIAL PRIMARY KEY;
INSERT INTO "RBSINTValues" SELECT * FROM "RBSINTValues_old" ORDER BY "Id";
SELECT setval('"RBSINTValues_Id_seq"', (SELECT MAX("Id") FROM "RBSINTValues"));
DROP TABLE "RBSINTValues_old";

-- BMDINTValues
ALTER TABLE "BMDINTValues" RENAME TO "BMDINTValues_old";
CREATE TABLE "BMDINTValues" AS SELECT * FROM "BMDINTValues_old" WHERE 1=0;
ALTER TABLE "BMDINTValues" DROP COLUMN IF EXISTS "Id" CASCADE;
ALTER TABLE "BMDINTValues" ADD COLUMN "Id" SERIAL PRIMARY KEY;
INSERT INTO "BMDINTValues" SELECT * FROM "BMDINTValues_old" ORDER BY "Id";
SELECT setval('"BMDINTValues_Id_seq"', (SELECT MAX("Id") FROM "BMDINTValues"));
DROP TABLE "BMDINTValues_old";

-- FBSINTValues
ALTER TABLE "FBSINTValues" RENAME TO "FBSINTValues_old";
CREATE TABLE "FBSINTValues" AS SELECT * FROM "FBSINTValues_old" WHERE 1=0;
ALTER TABLE "FBSINTValues" DROP COLUMN IF EXISTS "Id" CASCADE;
ALTER TABLE "FBSINTValues" ADD COLUMN "Id" SERIAL PRIMARY KEY;
INSERT INTO "FBSINTValues" SELECT * FROM "FBSINTValues_old" ORDER BY "Id";
SELECT setval('"FBSINTValues_Id_seq"', (SELECT MAX("Id") FROM "FBSINTValues"));
DROP TABLE "FBSINTValues_old";

-- HBA1CINTValues
ALTER TABLE "HBA1CINTValues" RENAME TO "HBA1CINTValues_old";
CREATE TABLE "HBA1CINTValues" AS SELECT * FROM "HBA1CINTValues_old" WHERE 1=0;
ALTER TABLE "HBA1CINTValues" DROP COLUMN IF EXISTS "Id" CASCADE;
ALTER TABLE "HBA1CINTValues" ADD COLUMN "Id" SERIAL PRIMARY KEY;
INSERT INTO "HBA1CINTValues" SELECT * FROM "HBA1CINTValues_old" ORDER BY "Id";
SELECT setval('"HBA1CINTValues_Id_seq"', (SELECT MAX("Id") FROM "HBA1CINTValues"));
DROP TABLE "HBA1CINTValues_old";

-- PSAINTValues
ALTER TABLE "PSAINTValues" RENAME TO "PSAINTValues_old";
CREATE TABLE "PSAINTValues" AS SELECT * FROM "PSAINTValues_old" WHERE 1=0;
ALTER TABLE "PSAINTValues" DROP COLUMN IF EXISTS "Id" CASCADE;
ALTER TABLE "PSAINTValues" ADD COLUMN "Id" SERIAL PRIMARY KEY;
INSERT INTO "PSAINTValues" SELECT * FROM "PSAINTValues_old" ORDER BY "Id";
SELECT setval('"PSAINTValues_Id_seq"', (SELECT MAX("Id") FROM "PSAINTValues"));
DROP TABLE "PSAINTValues_old";

-- MicroalbuminINTValues
ALTER TABLE "MicroalbuminINTValues" RENAME TO "MicroalbuminINTValues_old";
CREATE TABLE "MicroalbuminINTValues" AS SELECT * FROM "MicroalbuminINTValues_old" WHERE 1=0;
ALTER TABLE "MicroalbuminINTValues" DROP COLUMN IF EXISTS "Id" CASCADE;
ALTER TABLE "MicroalbuminINTValues" ADD COLUMN "Id" SERIAL PRIMARY KEY;
INSERT INTO "MicroalbuminINTValues" SELECT * FROM "MicroalbuminINTValues_old" ORDER BY "Id";
SELECT setval('"MicroalbuminINTValues_Id_seq"', (SELECT MAX("Id") FROM "MicroalbuminINTValues"));
DROP TABLE "MicroalbuminINTValues_old";


-- ============================================
-- NOW FIX THE MAIN TABLES
-- ============================================

-- Fix Clients
ALTER TABLE "Clients" RENAME TO "Clients_old";
CREATE TABLE "Clients" AS SELECT * FROM "Clients_old" WHERE 1=0;
ALTER TABLE "Clients" DROP COLUMN IF EXISTS "Id" CASCADE;
ALTER TABLE "Clients" ADD COLUMN "Id" SERIAL PRIMARY KEY;
INSERT INTO "Clients" SELECT * FROM "Clients_old" ORDER BY "Id";
SELECT setval('"Clients_Id_seq"', (SELECT MAX("Id") FROM "Clients"));
DROP TABLE "Clients_old";

-- Fix Tallies
ALTER TABLE "Tallies" RENAME TO "Tallies_old";
CREATE TABLE "Tallies" AS SELECT * FROM "Tallies_old" WHERE 1=0;
ALTER TABLE "Tallies" DROP COLUMN IF EXISTS "Id" CASCADE;
ALTER TABLE "Tallies" ADD COLUMN "Id" SERIAL PRIMARY KEY;
INSERT INTO "Tallies" SELECT * FROM "Tallies_old" ORDER BY "Id";
SELECT setval('"Tallies_Id_seq"', (SELECT MAX("Id") FROM "Tallies"));
DROP TABLE "Tallies_old";

-- Fix Findings
ALTER TABLE "Findings" RENAME TO "Findings_old";
CREATE TABLE "Findings" AS SELECT * FROM "Findings_old" WHERE 1=0;
ALTER TABLE "Findings" DROP COLUMN IF EXISTS "Id" CASCADE;
ALTER TABLE "Findings" ADD COLUMN "Id" SERIAL PRIMARY KEY;
INSERT INTO "Findings" SELECT * FROM "Findings_old" ORDER BY "Id";
SELECT setval('"Findings_Id_seq"', (SELECT MAX("Id") FROM "Findings"));
DROP TABLE "Findings_old";

-- Fix Oncologies
ALTER TABLE "Oncologies" RENAME TO "Oncologies_old";
CREATE TABLE "Oncologies" AS SELECT * FROM "Oncologies_old" WHERE 1=0;
ALTER TABLE "Oncologies" DROP COLUMN IF EXISTS "Id" CASCADE;
ALTER TABLE "Oncologies" ADD COLUMN "Id" SERIAL PRIMARY KEY;
INSERT INTO "Oncologies" SELECT * FROM "Oncologies_old" ORDER BY "Id";
SELECT setval('"Oncologies_Id_seq"', (SELECT MAX("Id") FROM "Oncologies"));
DROP TABLE "Oncologies_old";

-- ============================================
-- ADD FOREIGN KEYS
-- ============================================

-- Categories Foreign Keys
ALTER TABLE "Categories" ADD CONSTRAINT "FK_Categories_Users" 
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE;

-- Genders Foreign Keys
ALTER TABLE "Genders" ADD CONSTRAINT "FK_Genders_Users" 
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE;

-- Stations Foreign Keys
ALTER TABLE "Stations" ADD CONSTRAINT "FK_Stations_Users" 
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE;

-- Clients Foreign Keys
ALTER TABLE "Clients" ADD CONSTRAINT "FK_Clients_Users" 
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE;
ALTER TABLE "Clients" ADD CONSTRAINT "FK_Clients_Categories" 
    FOREIGN KEY ("CategoryId") REFERENCES "Categories" ("Id");
ALTER TABLE "Clients" ADD CONSTRAINT "FK_Clients_Genders" 
    FOREIGN KEY ("GenderId") REFERENCES "Genders" ("Id");
ALTER TABLE "Clients" ADD CONSTRAINT "FK_Clients_Stations" 
    FOREIGN KEY ("StationId") REFERENCES "Stations" ("Id");

-- Tallies Foreign Keys
ALTER TABLE "Tallies" ADD CONSTRAINT "FK_Tallies_Users" 
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE;
ALTER TABLE "Tallies" ADD CONSTRAINT "FK_Tallies_Clients" 
    FOREIGN KEY ("ClientId") REFERENCES "Clients" ("Id") ON DELETE CASCADE;
ALTER TABLE "Tallies" ADD CONSTRAINT "FK_Tallies_Categories" 
    FOREIGN KEY ("CategoryId") REFERENCES "Categories" ("Id");
ALTER TABLE "Tallies" ADD CONSTRAINT "FK_Tallies_Genders" 
    FOREIGN KEY ("GenderId") REFERENCES "Genders" ("Id");
ALTER TABLE "Tallies" ADD CONSTRAINT "FK_Tallies_Stations" 
    FOREIGN KEY ("StationId") REFERENCES "Stations" ("Id");
ALTER TABLE "Tallies" ADD CONSTRAINT "FK_Tallies_BMIINTValues" 
    FOREIGN KEY ("BMIINTValueId") REFERENCES "BMIINTValues" ("Id");
ALTER TABLE "Tallies" ADD CONSTRAINT "FK_Tallies_BPINTValues" 
    FOREIGN KEY ("BPINTValueId") REFERENCES "BPINTValues" ("Id");
ALTER TABLE "Tallies" ADD CONSTRAINT "FK_Tallies_RBSINTValues" 
    FOREIGN KEY ("RBSINTValueId") REFERENCES "RBSINTValues" ("Id");

-- Findings Foreign Keys
ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_Users" 
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE;
ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_Clients" 
    FOREIGN KEY ("ClientId") REFERENCES "Clients" ("Id") ON DELETE CASCADE;
ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_Categories" 
    FOREIGN KEY ("CategoryId") REFERENCES "Categories" ("Id");
ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_Genders" 
    FOREIGN KEY ("GenderId") REFERENCES "Genders" ("Id");
ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_Stations" 
    FOREIGN KEY ("StationId") REFERENCES "Stations" ("Id");
ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_MicroalbuminINTValues" 
    FOREIGN KEY ("MicroalbuminINTValueId") REFERENCES "MicroalbuminINTValues" ("Id");
ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_FBSINTValues" 
    FOREIGN KEY ("FBSINTValueId") REFERENCES "FBSINTValues" ("Id");
ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_HBA1CINTValues" 
    FOREIGN KEY ("HBA1CINTValueId") REFERENCES "HBA1CINTValues" ("Id");
ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_BMDINTValues" 
    FOREIGN KEY ("BMDINTValueId") REFERENCES "BMDINTValues" ("Id");
ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_PSAINTValues" 
    FOREIGN KEY ("PSAINTValueId") REFERENCES "PSAINTValues" ("Id");
ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_Lipids" 
    FOREIGN KEY ("LipidId") REFERENCES "Lipids" ("Id");
ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_HepatitisBValues" 
    FOREIGN KEY ("HepatitisBValueId") REFERENCES "HepatitisBValues" ("Id");
ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_HepatitisCValues" 
    FOREIGN KEY ("HepatitisCValueId") REFERENCES "HepatitisCValues" ("Id");

-- Oncologies Foreign Keys
ALTER TABLE "Oncologies" ADD CONSTRAINT "FK_Oncologies_Users" 
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE;
ALTER TABLE "Oncologies" ADD CONSTRAINT "FK_Oncologies_Clients" 
    FOREIGN KEY ("ClientId") REFERENCES "Clients" ("Id") ON DELETE CASCADE;
ALTER TABLE "Oncologies" ADD CONSTRAINT "FK_Oncologies_Categories" 
    FOREIGN KEY ("CategoryId") REFERENCES "Categories" ("Id");
ALTER TABLE "Oncologies" ADD CONSTRAINT "FK_Oncologies_Genders" 
    FOREIGN KEY ("GenderId") REFERENCES "Genders" ("Id");
ALTER TABLE "Oncologies" ADD CONSTRAINT "FK_Oncologies_Stations" 
    FOREIGN KEY ("StationId") REFERENCES "Stations" ("Id");
ALTER TABLE "Oncologies" ADD CONSTRAINT "FK_Oncologies_BreastExams" 
    FOREIGN KEY ("BreastExamId") REFERENCES "BreastExams" ("Id");
ALTER TABLE "Oncologies" ADD CONSTRAINT "FK_Oncologies_PAPSmears" 
    FOREIGN KEY ("PAPSmearId") REFERENCES "PAPSmears" ("Id");
ALTER TABLE "Oncologies" ADD CONSTRAINT "FK_Oncologies_ViaVillies" 
    FOREIGN KEY ("ViaVilliId") REFERENCES "ViaVillies" ("Id");

COMMIT;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check all table counts
SELECT 
    'Categories' as TableName, COUNT(*) as Count FROM "Categories"
UNION ALL
SELECT 'Genders', COUNT(*) FROM "Genders"
UNION ALL
SELECT 'Stations', COUNT(*) FROM "Stations"
UNION ALL
SELECT 'Roles', COUNT(*) FROM "Roles"
UNION ALL
SELECT 'Clients', COUNT(*) FROM "Clients"
UNION ALL
SELECT 'Tallies', COUNT(*) FROM "Tallies"
UNION ALL
SELECT 'Findings', COUNT(*) FROM "Findings"
UNION ALL
SELECT 'Oncologies', COUNT(*) FROM "Oncologies"
UNION ALL
SELECT 'Users', COUNT(*) FROM "Users"
UNION ALL
SELECT 'UserRoles', COUNT(*) FROM "UserRoles"
ORDER BY TableName;

-- Check all foreign keys
SELECT 
    tc.table_name, 
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- Check sequences
SELECT 
    'Categories' as Table, currval('"Categories_Id_seq"') as Last_Value
UNION ALL
SELECT 'Genders', currval('"Genders_Id_seq"')
UNION ALL
SELECT 'Stations', currval('"Stations_Id_seq"')
UNION ALL
SELECT 'Roles', currval('"Roles_Id_seq"')
UNION ALL
SELECT 'Clients', currval('"Clients_Id_seq"')
UNION ALL
SELECT 'Tallies', currval('"Tallies_Id_seq"')
UNION ALL
SELECT 'Findings', currval('"Findings_Id_seq"')
UNION ALL
SELECT 'Oncologies', currval('"Oncologies_Id_seq"')
UNION ALL
SELECT 'Users', currval('"Users_Id_seq"');