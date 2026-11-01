# Security Hardening Checklist

## ✅ Completed

### 1. Removed insecure password reset flow
- ❌ Deleted `/auth/forgot-password` and `/auth/reset-password` endpoints
- ❌ Removed `ForgotPasswordPage.tsx` from frontend
- ✅ Admin can reset user passwords via `/users/:id/reset-password` (super_admin only)

### 2. Removed hardcoded secrets and weak fallbacks
- ✅ DB credentials now require environment variables (no hardcoded defaults)
- ✅ JWT_SECRET requires environment variable (no "dev-secret" fallback)
- ✅ ENCRYPTION_KEY requires environment variable (no weak placeholder)
- ✅ Production startup validation: fails if secrets missing or < 16 chars
- ✅ Created `.env.example` with documentation

### 3. Security headers and Swagger protection
- ✅ Added `@fastify/helmet` with CSP (disabled in dev for debugging)
- ✅ Swagger UI disabled in production (`NODE_ENV=production`)
- ✅ Development-only access to `/docs`

### 4. Dependency upgrades
- ✅ Upgraded `@fastify/jwt` from 9.0.1 → 10.2.6 (fixes critical vulnerability)
- ✅ Upgraded `zod` from 3.23.8 → 4.6.7 (fixes high vulnerability)
- ✅ Added `@fastify/helmet` 13.0.0
- ⚠️  Remaining: 15 moderate/high (mostly transitive deps in dev tools)

### 5. Rate limiting
- ✅ Global rate limit: 300 req/min per IP
- ✅ `/auth/login`: 5 req/min
- ✅ `/auth/customer-login`: 5 req/min
- ⚠️  TODO: Add rate limit to `/auth/me/password` and other sensitive endpoints

## ⚠️ Partially Complete

### 6. Customer password hashing
**Status:** NOT IMPLEMENTED - breaking change requires full migration

**Current state:**
- `login_password` stored as plaintext in DB
- Customer login compares plaintext: `body.password !== String(row.login_password)`
- Field returned in API responses to admin

**Why not completed:**
- Schema change impacts: DB migration, seed files, Excel import/export
- 20+ query references across `customers.routes.ts`, `auth.routes.ts`, portal routes
- Breaking change for existing deployments
- Requires downtime and password reset for all customers

**Migration plan:** See `CUSTOMER_PASSWORD_MIGRATION.md`

## 🚨 High Priority TODO

### 7. Route authorization audit
**Action required:** Manual review of ALL routes to ensure auth middleware

Currently implemented:
- `/users/*` - super_admin only ✅
- `/customers/*` - admin/super_admin ✅  
- `/packages/*` - admin/super_admin ✅
- `/routers/*` - admin/super_admin ✅
- `/acs/*` - admin/super_admin ✅

**Need verification:**
- `/invoices/*` - check role restrictions
- `/payments/*` - check role restrictions  
- `/tickets/*` - check tech access
- `/wa-gateway/*` - check role
- `/telegram/*` - check role
- `/payment-gateway/*` - check role
- `/webhook/*` - should NOT have auth (external)
- `/dashboard/*` - check role
- `/portal/*` - customer role only

### 8. Audit logging for critical actions
**Not implemented.** Need to log:
- Failed login attempts (rate limit bypass attempts)
- User role changes (super_admin promotes someone)
- User deletion
- Password resets (admin resetting user password)
- Payment gateway config changes
- Router sync config changes

### 9. Input validation improvements
- Password policy: currently only 6 chars minimum
- Should enforce: 10+ chars, no common passwords, username != password
- Email enumeration: forgot-password removed but `/auth/login` still returns different errors for "user not found" vs "wrong password"

### 10. Move JWT from localStorage to HttpOnly cookies
**Not implemented** - requires architecture change
- Current: Bearer token in `localStorage` (vulnerable to XSS)
- Recommended: HttpOnly, Secure, SameSite=Strict cookies
- Requires: CSRF protection, cookie parser, session handling changes

## 📋 Deployment Instructions

### Development Setup

1. Copy environment template:
```bash
cd fasty-api
cp .env.example .env
```

2. Generate secrets:
```bash
# JWT Secret (32 bytes)
openssl rand -base64 32

# Encryption Key (32 bytes)  
openssl rand -base64 32
```

3. Edit `.env` and fill all required values:
```env
DB_USER=fasty
DB_PASSWORD=<strong_random_password_min_16_chars>
DB_NAME=fasty_bill
JWT_SECRET=<output_from_openssl_rand_above>
ENCRYPTION_KEY=<output_from_openssl_rand_above>
```

4. Start development:
```bash
npm run dev
```

### Production Deployment

**CRITICAL:** Do NOT deploy without completing these steps:

1. **Rotate ALL secrets:**
   - Generate new JWT_SECRET
   - Generate new ENCRYPTION_KEY  
   - Create new DB user with strong password
   - Rotate SumoPod API keys if already configured

2. **Update MySQL:**
```sql
-- Create new DB user with strong password
CREATE USER 'fasty_prod'@'localhost' IDENTIFIED BY '<strong_random_32+_chars>';
GRANT ALL PRIVILEGES ON fasty_bill.* TO 'fasty_prod'@'localhost';
FLUSH PRIVILEGES;
```

3. **Set production environment:**
```env
NODE_ENV=production
DB_USER=fasty_prod
DB_PASSWORD=<new_strong_password>
JWT_SECRET=<32_byte_random>
ENCRYPTION_KEY=<32_byte_random>
CORS_ORIGIN=https://yourdomain.com
```

4. **Verify startup:**
```bash
npm run build
npm start
```

Server will fail to start if secrets are missing or weak.

5. **Reverse proxy configuration:**
- Use nginx/caddy with HTTPS (Let's Encrypt)
- Set `X-Forwarded-For` for rate limiting per real IP
- Restrict `/docs` access (should be disabled anyway)

6. **Firewall:**
- MySQL port 3306: localhost only
- API port 3000: reverse proxy only
- No direct public exposure

## ⚠️ Known Limitations

1. **Customer passwords still plaintext** - requires migration (see above)
2. **PPPoE passwords stored plaintext** - operational requirement for router sync
3. **No MFA** - should add for admin/super_admin accounts
4. **No session management** - JWT tokens valid until expiry (8h), no revocation
5. **No password rotation policy**
6. **Email enumeration possible** via login error messages
7. **No account lockout** after failed login attempts (only rate limit)

## 📊 Vulnerability Summary

### Before fixes:
- 2 Critical
- 6 High  
- 11 Moderate
- Total: 19 vulnerabilities

### After fixes:
- 0 Critical ✅
- 4 High (transitive dependencies)
- 11 Moderate (transitive dependencies)
- Total: 15 vulnerabilities

### Remaining high vulnerabilities:
- `@fastify/static` path traversal (via Swagger UI dependency)
- `minimatch` ReDoS (via archiver/exceljs)
- `glob` ReDoS (transitive)

**Mitigation:**
- Swagger disabled in production ✅
- Minimize Excel export usage in production
- No user-controlled glob patterns
- Monitor for updates

## 🔐 Secret Rotation Schedule

**Recommendation:**

- JWT_SECRET: Rotate every 90 days (invalidates all sessions)
- ENCRYPTION_KEY: Never rotate without re-encrypting data
- DB_PASSWORD: Rotate every 90 days
- API Keys (SumoPod, GenieACS): Rotate when compromised or annually

## 📖 Additional Resources

- Password migration: `CUSTOMER_PASSWORD_MIGRATION.md`
- Rate limit tuning: `@fastify/rate-limit` docs
- Helmet configuration: `@fastify/helmet` docs
- JWT best practices: https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/
