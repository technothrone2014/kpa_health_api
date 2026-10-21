# Security implementation summary

**System:** KPA Health Intelligence API and web application  
**Purpose:** Summary of implemented application and deployment security controls for security-team review.  
**Scope note:** This document describes controls visible in the code and deployment configuration. It is not a penetration-test report, legal opinion, or certification of compliance.

## Implemented controls

### Transport security

- The frontend uses the HTTPS API endpoint by default and rejects an explicitly configured `http://` API URL in production builds.
- Both the frontend and API are deployed as Render web services. Production transport security relies on Render TLS/HTTPS at the service endpoints (TLS terminates at Render's edge); deployment owners must keep both public URLs on HTTPS and verify that HTTP is redirected or unavailable.
- Local development may use localhost HTTP. Do not use unencrypted HTTP for non-local environments.
- The deployed API connects to Neon PostgreSQL using its pooled connection URL and `PGSSLMODE=require`. This requires TLS encryption and disallows plaintext fallback; certificate identity is not verified in this mode. For database endpoints with publicly trusted certificates, use `PGSSLMODE=verify-full`, the application default.
- SQL Server connections are encrypted by default and validate the server certificate by default. The development-only override `DB_TRUST_SERVER_CERTIFICATE=true` disables certificate validation and must not be used in production.

### Authentication and authorization

- Protected API routes validate bearer JWTs. Missing or invalid tokens are rejected.
- `JWT_SECRET` has no code default: the API fails at startup if it is missing or shorter than 32 bytes.
- Employee, patient, analytics, and WhatsApp status endpoints require authentication.
- Administrator authorization is required for employee create/update/delete, station corrections, WhatsApp QR/reconnect/reset operations, email connection tests, and clinical configuration writes.
- CORS allows configured frontend origins and the known local development origins; CORS is not treated as an authentication or authorization control.

### API and application protections

- Analytics export dates are validated as real `YYYY-MM-DD` dates, checked for start/end order, and passed to PostgreSQL as bound parameters rather than interpolated into SQL.
- Helmet security headers are enabled on the API. Request bodies are limited to 10 MB.
- Production frontend builds reject an explicitly configured non-HTTPS API URL.

### Secrets and configuration

- Environment files are ignored by Git; `.env.example` contains variable names and placeholders only.
- Deployment configuration declares `DATABASE_URL` as an externally supplied secret and asks Render to generate `JWT_SECRET` as a random 256-bit value when it is not already configured.
- A private local `JWT_SECRET` is configured in the ignored development `.env`; it is not a production secret.
- Database and mail credential files were removed from the working tree. Their previous Git history may still contain credentials; treat those credentials as exposed until rotated.

## Deployment and operational requirements

Before production release or certification review:

1. Confirm Render has a unique, cryptographically random `JWT_SECRET` of at least 32 bytes. The Blueprint generates a 256-bit value when missing; verify it exists after syncing. Do not use the development value or commit production secrets. Rotation invalidates existing tokens.
2. Rotate database and mail credentials previously present in tracked environment files. Review Git history with repository administrators and clean it according to repository policy after rotation.
3. Confirm both Render service URLs use HTTPS, HTTP redirects to HTTPS or is unavailable, and the frontend's `VITE_API_URL` points to the HTTPS API URL.
4. Keep `PGSSLMODE=require` for the current Neon connection, or use `verify-full` only where the database endpoint's certificate chain is publicly trusted. Keep `DB_TRUST_SERVER_CERTIFICATE` unset or `false` in production; confirm database provider TLS configuration remains valid.
5. Review administrator assignments and confirm that access to health data is appropriate. Current patient and analytics route protection requires authentication but does not itself implement per-record, station, or patient-scope authorization.
6. Maintain credential rotation, access review, security monitoring, vulnerability management, backups, and tested incident-response procedures.

## Data protection considerations

The application processes personal and health data. These controls support security but do not alone demonstrate compliance with Kenya's Data Protection Act, 2019 or its regulations. The organisation remains responsible for documenting lawful purposes and retention periods, providing required privacy information, handling data-subject rights, assessing high-risk processing, governing processors and cross-border transfers, and maintaining an incident response process. The Act generally requires notifying the Data Commissioner without delay and within 72 hours of becoming aware of a qualifying personal-data breach, with data-subject notification where the applicable risk threshold is met.

The legal reference reviewed is the [Kenya Data Protection Act, 2019 (consolidated text)](https://new.kenyalaw.org/akn/ke/act/2019/24/eng@2022-12-31), including its data-protection principles. The security team and the organisation's qualified Kenyan privacy/legal adviser should validate applicable obligations and evidence before certification.
