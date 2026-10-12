-- Step 1: Create the login with a strong password
/*
CREATE LOGIN api_user
WITH PASSWORD = 'Godlovesyou2!', 
     CHECK_POLICY = ON,          -- Enforces Windows Server password policies
     CHECK_EXPIRATION = OFF;     -- Set to ON if password expiration is required
*/
-- Step 2: Grant sysadmin (SU) server role to the new login
-- ALTER SERVER ROLE sysadmin ADD MEMBER api_user;


-- ALTER LOGIN [api_user] WITH PASSWORD = 'Godlovesyou2!';


/*
USE ZoodeskDB;
CREATE USER [api_user] FOR LOGIN [api_user];
ALTER ROLE [db_datareader] ADD MEMBER [api_user];
ALTER ROLE [db_datawriter] ADD MEMBER [api_user];
*/

-- ALTER LOGIN [api_user] WITH PASSWORD = 'Godlovesyou2!';

-- ALTER LOGIN [api_user] WITH PASSWORD = 'Godlovesyou2!';

ALTER LOGIN [api_user] ENABLE;
ALTER LOGIN [api_user] WITH CHECK_POLICY = OFF;

-- Optional: temporarily simplifies complexity rules for testing