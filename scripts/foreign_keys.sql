-- ============================================
-- CREATE ALL FOREIGN KEYS (Skip if exists)
-- ============================================

-- ============================================
-- 1. CLIENTS FOREIGN KEYS
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Clients_Users' 
                   AND table_name = 'Clients') THEN
        ALTER TABLE "Clients" ADD CONSTRAINT "FK_Clients_Users" 
            FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE;
        RAISE NOTICE '✅ Created FK_Clients_Users';
    ELSE
        RAISE NOTICE '⏭️ FK_Clients_Users already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Clients_Categories' 
                   AND table_name = 'Clients') THEN
        ALTER TABLE "Clients" ADD CONSTRAINT "FK_Clients_Categories" 
            FOREIGN KEY ("CategoryId") REFERENCES "Categories"("Id");
        RAISE NOTICE '✅ Created FK_Clients_Categories';
    ELSE
        RAISE NOTICE '⏭️ FK_Clients_Categories already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Clients_Genders' 
                   AND table_name = 'Clients') THEN
        ALTER TABLE "Clients" ADD CONSTRAINT "FK_Clients_Genders" 
            FOREIGN KEY ("GenderId") REFERENCES "Genders"("Id");
        RAISE NOTICE '✅ Created FK_Clients_Genders';
    ELSE
        RAISE NOTICE '⏭️ FK_Clients_Genders already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Clients_Stations' 
                   AND table_name = 'Clients') THEN
        ALTER TABLE "Clients" ADD CONSTRAINT "FK_Clients_Stations" 
            FOREIGN KEY ("StationId") REFERENCES "Stations"("Id");
        RAISE NOTICE '✅ Created FK_Clients_Stations';
    ELSE
        RAISE NOTICE '⏭️ FK_Clients_Stations already exists, skipping...';
    END IF;
END $$;

-- ============================================
-- 2. TALLIES FOREIGN KEYS
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Tallies_Users' 
                   AND table_name = 'Tallies') THEN
        ALTER TABLE "Tallies" ADD CONSTRAINT "FK_Tallies_Users" 
            FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE;
        RAISE NOTICE '✅ Created FK_Tallies_Users';
    ELSE
        RAISE NOTICE '⏭️ FK_Tallies_Users already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Tallies_Clients' 
                   AND table_name = 'Tallies') THEN
        ALTER TABLE "Tallies" ADD CONSTRAINT "FK_Tallies_Clients" 
            FOREIGN KEY ("ClientId") REFERENCES "Clients"("Id") ON DELETE CASCADE;
        RAISE NOTICE '✅ Created FK_Tallies_Clients';
    ELSE
        RAISE NOTICE '⏭️ FK_Tallies_Clients already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Tallies_Categories' 
                   AND table_name = 'Tallies') THEN
        ALTER TABLE "Tallies" ADD CONSTRAINT "FK_Tallies_Categories" 
            FOREIGN KEY ("CategoryId") REFERENCES "Categories"("Id");
        RAISE NOTICE '✅ Created FK_Tallies_Categories';
    ELSE
        RAISE NOTICE '⏭️ FK_Tallies_Categories already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Tallies_Genders' 
                   AND table_name = 'Tallies') THEN
        ALTER TABLE "Tallies" ADD CONSTRAINT "FK_Tallies_Genders" 
            FOREIGN KEY ("GenderId") REFERENCES "Genders"("Id");
        RAISE NOTICE '✅ Created FK_Tallies_Genders';
    ELSE
        RAISE NOTICE '⏭️ FK_Tallies_Genders already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Tallies_Stations' 
                   AND table_name = 'Tallies') THEN
        ALTER TABLE "Tallies" ADD CONSTRAINT "FK_Tallies_Stations" 
            FOREIGN KEY ("StationId") REFERENCES "Stations"("Id");
        RAISE NOTICE '✅ Created FK_Tallies_Stations';
    ELSE
        RAISE NOTICE '⏭️ FK_Tallies_Stations already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Tallies_BMIINTValues' 
                   AND table_name = 'Tallies') THEN
        ALTER TABLE "Tallies" ADD CONSTRAINT "FK_Tallies_BMIINTValues" 
            FOREIGN KEY ("BMIINTValueId") REFERENCES "BMIINTValues"("Id");
        RAISE NOTICE '✅ Created FK_Tallies_BMIINTValues';
    ELSE
        RAISE NOTICE '⏭️ FK_Tallies_BMIINTValues already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Tallies_BPINTValues' 
                   AND table_name = 'Tallies') THEN
        ALTER TABLE "Tallies" ADD CONSTRAINT "FK_Tallies_BPINTValues" 
            FOREIGN KEY ("BPINTValueId") REFERENCES "BPINTValues"("Id");
        RAISE NOTICE '✅ Created FK_Tallies_BPINTValues';
    ELSE
        RAISE NOTICE '⏭️ FK_Tallies_BPINTValues already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Tallies_RBSINTValues' 
                   AND table_name = 'Tallies') THEN
        ALTER TABLE "Tallies" ADD CONSTRAINT "FK_Tallies_RBSINTValues" 
            FOREIGN KEY ("RBSINTValueId") REFERENCES "RBSINTValues"("Id");
        RAISE NOTICE '✅ Created FK_Tallies_RBSINTValues';
    ELSE
        RAISE NOTICE '⏭️ FK_Tallies_RBSINTValues already exists, skipping...';
    END IF;
END $$;

-- ============================================
-- 3. FINDINGS FOREIGN KEYS
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Findings_Users' 
                   AND table_name = 'Findings') THEN
        ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_Users" 
            FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE;
        RAISE NOTICE '✅ Created FK_Findings_Users';
    ELSE
        RAISE NOTICE '⏭️ FK_Findings_Users already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Findings_Clients' 
                   AND table_name = 'Findings') THEN
        ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_Clients" 
            FOREIGN KEY ("ClientId") REFERENCES "Clients"("Id") ON DELETE CASCADE;
        RAISE NOTICE '✅ Created FK_Findings_Clients';
    ELSE
        RAISE NOTICE '⏭️ FK_Findings_Clients already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Findings_Categories' 
                   AND table_name = 'Findings') THEN
        ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_Categories" 
            FOREIGN KEY ("CategoryId") REFERENCES "Categories"("Id");
        RAISE NOTICE '✅ Created FK_Findings_Categories';
    ELSE
        RAISE NOTICE '⏭️ FK_Findings_Categories already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Findings_Genders' 
                   AND table_name = 'Findings') THEN
        ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_Genders" 
            FOREIGN KEY ("GenderId") REFERENCES "Genders"("Id");
        RAISE NOTICE '✅ Created FK_Findings_Genders';
    ELSE
        RAISE NOTICE '⏭️ FK_Findings_Genders already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Findings_Stations' 
                   AND table_name = 'Findings') THEN
        ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_Stations" 
            FOREIGN KEY ("StationId") REFERENCES "Stations"("Id");
        RAISE NOTICE '✅ Created FK_Findings_Stations';
    ELSE
        RAISE NOTICE '⏭️ FK_Findings_Stations already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Findings_MicroalbuminINTValues' 
                   AND table_name = 'Findings') THEN
        ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_MicroalbuminINTValues" 
            FOREIGN KEY ("MicroalbuminINTValueId") REFERENCES "MicroalbuminINTValues"("Id");
        RAISE NOTICE '✅ Created FK_Findings_MicroalbuminINTValues';
    ELSE
        RAISE NOTICE '⏭️ FK_Findings_MicroalbuminINTValues already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Findings_FBSINTValues' 
                   AND table_name = 'Findings') THEN
        ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_FBSINTValues" 
            FOREIGN KEY ("FBSINTValueId") REFERENCES "FBSINTValues"("Id");
        RAISE NOTICE '✅ Created FK_Findings_FBSINTValues';
    ELSE
        RAISE NOTICE '⏭️ FK_Findings_FBSINTValues already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Findings_HBA1CINTValues' 
                   AND table_name = 'Findings') THEN
        ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_HBA1CINTValues" 
            FOREIGN KEY ("HBA1CINTValueId") REFERENCES "HBA1CINTValues"("Id");
        RAISE NOTICE '✅ Created FK_Findings_HBA1CINTValues';
    ELSE
        RAISE NOTICE '⏭️ FK_Findings_HBA1CINTValues already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Findings_BMDINTValues' 
                   AND table_name = 'Findings') THEN
        ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_BMDINTValues" 
            FOREIGN KEY ("BMDINTValueId") REFERENCES "BMDINTValues"("Id");
        RAISE NOTICE '✅ Created FK_Findings_BMDINTValues';
    ELSE
        RAISE NOTICE '⏭️ FK_Findings_BMDINTValues already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Findings_PSAINTValues' 
                   AND table_name = 'Findings') THEN
        ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_PSAINTValues" 
            FOREIGN KEY ("PSAINTValueId") REFERENCES "PSAINTValues"("Id");
        RAISE NOTICE '✅ Created FK_Findings_PSAINTValues';
    ELSE
        RAISE NOTICE '⏭️ FK_Findings_PSAINTValues already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Findings_Lipids' 
                   AND table_name = 'Findings') THEN
        ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_Lipids" 
            FOREIGN KEY ("LipidId") REFERENCES "Lipids"("Id");
        RAISE NOTICE '✅ Created FK_Findings_Lipids';
    ELSE
        RAISE NOTICE '⏭️ FK_Findings_Lipids already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Findings_HepatitisBValues' 
                   AND table_name = 'Findings') THEN
        ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_HepatitisBValues" 
            FOREIGN KEY ("HepatitisBValueId") REFERENCES "HepatitisBValues"("Id");
        RAISE NOTICE '✅ Created FK_Findings_HepatitisBValues';
    ELSE
        RAISE NOTICE '⏭️ FK_Findings_HepatitisBValues already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Findings_HepatitisCValues' 
                   AND table_name = 'Findings') THEN
        ALTER TABLE "Findings" ADD CONSTRAINT "FK_Findings_HepatitisCValues" 
            FOREIGN KEY ("HepatitisCValueId") REFERENCES "HepatitisCValues"("Id");
        RAISE NOTICE '✅ Created FK_Findings_HepatitisCValues';
    ELSE
        RAISE NOTICE '⏭️ FK_Findings_HepatitisCValues already exists, skipping...';
    END IF;
END $$;

-- ============================================
-- 4. ONCOLOGIES FOREIGN KEYS
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Oncologies_Users' 
                   AND table_name = 'Oncologies') THEN
        ALTER TABLE "Oncologies" ADD CONSTRAINT "FK_Oncologies_Users" 
            FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE;
        RAISE NOTICE '✅ Created FK_Oncologies_Users';
    ELSE
        RAISE NOTICE '⏭️ FK_Oncologies_Users already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Oncologies_Clients' 
                   AND table_name = 'Oncologies') THEN
        ALTER TABLE "Oncologies" ADD CONSTRAINT "FK_Oncologies_Clients" 
            FOREIGN KEY ("ClientId") REFERENCES "Clients"("Id") ON DELETE CASCADE;
        RAISE NOTICE '✅ Created FK_Oncologies_Clients';
    ELSE
        RAISE NOTICE '⏭️ FK_Oncologies_Clients already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Oncologies_Categories' 
                   AND table_name = 'Oncologies') THEN
        ALTER TABLE "Oncologies" ADD CONSTRAINT "FK_Oncologies_Categories" 
            FOREIGN KEY ("CategoryId") REFERENCES "Categories"("Id");
        RAISE NOTICE '✅ Created FK_Oncologies_Categories';
    ELSE
        RAISE NOTICE '⏭️ FK_Oncologies_Categories already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Oncologies_Genders' 
                   AND table_name = 'Oncologies') THEN
        ALTER TABLE "Oncologies" ADD CONSTRAINT "FK_Oncologies_Genders" 
            FOREIGN KEY ("GenderId") REFERENCES "Genders"("Id");
        RAISE NOTICE '✅ Created FK_Oncologies_Genders';
    ELSE
        RAISE NOTICE '⏭️ FK_Oncologies_Genders already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Oncologies_Stations' 
                   AND table_name = 'Oncologies') THEN
        ALTER TABLE "Oncologies" ADD CONSTRAINT "FK_Oncologies_Stations" 
            FOREIGN KEY ("StationId") REFERENCES "Stations"("Id");
        RAISE NOTICE '✅ Created FK_Oncologies_Stations';
    ELSE
        RAISE NOTICE '⏭️ FK_Oncologies_Stations already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Oncologies_BreastExams' 
                   AND table_name = 'Oncologies') THEN
        ALTER TABLE "Oncologies" ADD CONSTRAINT "FK_Oncologies_BreastExams" 
            FOREIGN KEY ("BreastExamId") REFERENCES "BreastExams"("Id");
        RAISE NOTICE '✅ Created FK_Oncologies_BreastExams';
    ELSE
        RAISE NOTICE '⏭️ FK_Oncologies_BreastExams already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Oncologies_PAPSmears' 
                   AND table_name = 'Oncologies') THEN
        ALTER TABLE "Oncologies" ADD CONSTRAINT "FK_Oncologies_PAPSmears" 
            FOREIGN KEY ("PAPSmearId") REFERENCES "PAPSmears"("Id");
        RAISE NOTICE '✅ Created FK_Oncologies_PAPSmears';
    ELSE
        RAISE NOTICE '⏭️ FK_Oncologies_PAPSmears already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Oncologies_ViaVillies' 
                   AND table_name = 'Oncologies') THEN
        ALTER TABLE "Oncologies" ADD CONSTRAINT "FK_Oncologies_ViaVillies" 
            FOREIGN KEY ("ViaVilliId") REFERENCES "ViaVillies"("Id");
        RAISE NOTICE '✅ Created FK_Oncologies_ViaVillies';
    ELSE
        RAISE NOTICE '⏭️ FK_Oncologies_ViaVillies already exists, skipping...';
    END IF;
END $$;

-- ============================================
-- 5. CATEGORIES FOREIGN KEYS
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Categories_Users' 
                   AND table_name = 'Categories') THEN
        ALTER TABLE "Categories" ADD CONSTRAINT "FK_Categories_Users" 
            FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE;
        RAISE NOTICE '✅ Created FK_Categories_Users';
    ELSE
        RAISE NOTICE '⏭️ FK_Categories_Users already exists, skipping...';
    END IF;
END $$;

-- ============================================
-- 6. GENDERS FOREIGN KEYS
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Genders_Users' 
                   AND table_name = 'Genders') THEN
        ALTER TABLE "Genders" ADD CONSTRAINT "FK_Genders_Users" 
            FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE;
        RAISE NOTICE '✅ Created FK_Genders_Users';
    ELSE
        RAISE NOTICE '⏭️ FK_Genders_Users already exists, skipping...';
    END IF;
END $$;

-- ============================================
-- 7. STATIONS FOREIGN KEYS
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_Stations_Users' 
                   AND table_name = 'Stations') THEN
        ALTER TABLE "Stations" ADD CONSTRAINT "FK_Stations_Users" 
            FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE;
        RAISE NOTICE '✅ Created FK_Stations_Users';
    ELSE
        RAISE NOTICE '⏭️ FK_Stations_Users already exists, skipping...';
    END IF;
END $$;

-- ============================================
-- 8. USERROLES FOREIGN KEYS
-- ============================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_UserRoles_Users_UserId' 
                   AND table_name = 'UserRoles') THEN
        ALTER TABLE "UserRoles" ADD CONSTRAINT "FK_UserRoles_Users_UserId" 
            FOREIGN KEY ("UserId") REFERENCES "Users"("Id") ON DELETE CASCADE;
        RAISE NOTICE '✅ Created FK_UserRoles_Users_UserId';
    ELSE
        RAISE NOTICE '⏭️ FK_UserRoles_Users_UserId already exists, skipping...';
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints 
                   WHERE constraint_name = 'FK_UserRoles_Roles_RoleId' 
                   AND table_name = 'UserRoles') THEN
        ALTER TABLE "UserRoles" ADD CONSTRAINT "FK_UserRoles_Roles_RoleId" 
            FOREIGN KEY ("RoleId") REFERENCES "Roles"("Id") ON DELETE CASCADE;
        RAISE NOTICE '✅ Created FK_UserRoles_Roles_RoleId';
    ELSE
        RAISE NOTICE '⏭️ FK_UserRoles_Roles_RoleId already exists, skipping...';
    END IF;
END $$;