-- ============================================
-- Fix BPRemarks
-- ============================================

-- 0. Clean up any leftover half-migrated state from previous attempts
--DROP TABLE IF EXISTS "BPRemarks";
--ALTER TABLE IF EXISTS "BPRemarks_old" RENAME TO "BPRemarks";

-- 1. Rename the table to old
ALTER TABLE "BPRemarks" RENAME TO "BPRemarks_old";

-- 2. Create the new table with Id as SERIAL PRIMARY KEY
CREATE TABLE "BPRemarks" (
	"Id" SERIAL PRIMARY KEY,
	"UserId" integer NOT NULL,
	"Title" varchar(30) NOT NULL,
	"PostedOn" timestamp NOT NULL,
	"UpdatedOn" timestamp NOT NULL,
	"Pinned" boolean NOT NULL,
	"Status" boolean NOT NULL,
	"Deleted" boolean NOT NULL
);

-- 3. Insert data explicitly mapping columns and casting timestamps safely
INSERT INTO "BPRemarks" (
	"UserId",
	"Title",
	"PostedOn",
	"UpdatedOn",
	"Pinned",
	"Status",
	"Deleted"
)
SELECT 
	"UserId",
	"Title",
	"PostedOn"::timestamp,
	"UpdatedOn"::timestamp,
	"Pinned",
	"Status",
	"Deleted"
FROM "BPRemarks_old"
ORDER BY "Id";

-- 4. Sync the auto-increment sequence with the max ID
SELECT setval(pg_get_serial_sequence('"BPRemarks"', 'Id'), (SELECT MAX("Id") FROM "BPRemarks"));

-- 5. Drop the old table
DROP TABLE "BPRemarks_old";


-- ============================================
-- Fix RBSRemarks (Assuming identical structure)
-- ============================================

-- DROP TABLE IF EXISTS "RBSRemarks";
-- ALTER TABLE IF EXISTS "RBSRemarks_old" RENAME TO "RBSRemarks";

ALTER TABLE "RBSRemarks" RENAME TO "RBSRemarks_old";

CREATE TABLE "RBSRemarks" (
	"Id" SERIAL PRIMARY KEY,
	"UserId" integer NOT NULL,
	"Title" varchar(30) NOT NULL,
	"PostedOn" timestamp NOT NULL,
	"UpdatedOn" timestamp NOT NULL,
	"Pinned" boolean NOT NULL,
	"Status" boolean NOT NULL,
	"Deleted" boolean NOT NULL
);

INSERT INTO "RBSRemarks" (
	"UserId",
	"Title",
	"PostedOn",
	"UpdatedOn",
	"Pinned",
	"Status",
	"Deleted"
)
SELECT 
	"UserId",
	"Title",
	"PostedOn"::timestamp,
	"UpdatedOn"::timestamp,
	"Pinned",
	"Status",
	"Deleted"
FROM "RBSRemarks_old"
ORDER BY "Id";

SELECT setval(pg_get_serial_sequence('"RBSRemarks"', 'Id'), (SELECT MAX("Id") FROM "RBSRemarks"));

DROP TABLE "RBSRemarks_old";


-- BPRemarks + RBSRemarks user FKs
ALTER TABLE "BPRemarks" ADD CONSTRAINT "FK_BPRemarks_Users"
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE;

ALTER TABLE "RBSRemarks" ADD CONSTRAINT "FK_RBSRemarks_Users"
    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE;

-- Tallies FKs to the new remark tables
ALTER TABLE "Tallies" ADD CONSTRAINT "FK_Tallies_BPRemarks"
    FOREIGN KEY ("BPRemarkId") REFERENCES "BPRemarks" ("Id");

ALTER TABLE "Tallies" ADD CONSTRAINT "FK_Tallies_RBSRemarks"
    FOREIGN KEY ("RBSRemarkId") REFERENCES "RBSRemarks" ("Id");