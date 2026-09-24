# SignSalesIQ - Developer Production Deployment Guide

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Environment Variables](#environment-variables)
3. [Database Setup](#database-setup)
4. [AI API Configuration](#ai-api-configuration)
5. [File Storage](#file-storage)
6. [Authentication & Sessions](#authentication--sessions)
7. [Multi-Tenancy & RBAC](#multi-tenancy--rbac)
8. [Subscription & Billing](#subscription--billing)
9. [Email Service](#email-service)
10. [Dark Mode & Theming](#dark-mode--theming)
11. [Build & Deploy](#build--deploy)
12. [Code Changes for Production](#code-changes-for-production)
13. [DigitalOcean Deployment](#digitalocean-deployment)
14. [Monitoring & Maintenance](#monitoring--maintenance)
15. [API Reference](#api-reference-key-endpoints)
16. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                   Client (React)                 │
│  React 18 + TypeScript + TailwindCSS + shadcn/ui│
│  Dark mode (class-based) + localStorage persist  │
│  Bundled by Vite → static files served by Express│
└─────────────────┬───────────────────────────────┘
                  │ HTTP API calls
┌─────────────────▼───────────────────────────────┐
│              Server (Express.js)                 │
│  TypeScript + Express + Multer (file uploads)    │
│  Session-based auth (connect-pg-simple)          │
├──────────────────────────────────────────────────┤
│  Services:                                       │
│  ├─ geminiMockupService.ts (AI mockup generation)│
│  ├─ compositeService.ts (sharp image compositing)│
│  ├─ pdfService.ts (pdf-lib proposal generation)  │
│  ├─ signCodeService.ts (AI regulation lookup)    │
│  ├─ llmService.ts (AI text generation/polish)    │
│  ├─ emailService.ts (SMTP email delivery)        │
│  └─ stripeService.ts (subscription billing)      │
├──────────────────────────────────────────────────┤
│  External APIs:                                  │
│  ├─ Google Gemini (primary AI image generation)  │
│  ├─ Google Gemini fallback (2nd API key)         │
│  ├─ Stripe (subscription payments)               │
│  └─ SMTP (email delivery via Nodemailer)         │
└─────────────────┬───────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────┐
│            PostgreSQL Database                   │
│  Drizzle ORM │ Session store (connect-pg-simple) │
└──────────────────────────────────────────────────┘
│            Local Filesystem / Cloud Storage       │
│  ./uploads/ (user uploads)                       │
│  ./outputs/ (generated mockups, PDFs)            │
│  Replit Object Storage (cloud sync for prod)     │
└──────────────────────────────────────────────────┘
```

### Key Files
| File | Purpose |
|------|---------|
| `server/index.ts` | Express app entry point |
| `server/routes.ts` | All API route definitions |
| `server/storage.ts` | Database CRUD operations (Drizzle ORM) |
| `server/vite.ts` | Vite dev server integration + production static serving |
| `server/geminiMockupService.ts` | Gemini AI mockup generation + sharp compositing |
| `server/replit_integrations/image/client.ts` | Legacy OpenAI client (no longer used for fallback) |
| `server/pdfService.ts` | PDF proposal generation with owner branding |
| `server/signCodeService.ts` | AI sign code regulation lookup |
| `server/compositeService.ts` | Deterministic image compositing |
| `server/llmService.ts` | AI text generation (rationale, compliance, note polishing) |
| `server/emailService.ts` | Email delivery via Nodemailer (welcome emails, notifications) |
| `server/stripeService.ts` | Stripe subscription and checkout handling |
| `server/filePaths.ts` | File path resolution (dev vs production) |
| `server/seed.ts` | Auto-seeder for sign types, reference images, product rules, users |
| `server/seedSignTypeData.ts` | Seed data: 45+ sign types with descriptions + sample prompts |
| `server/seedReferenceData.ts` | Seed data: 159 reference image records |
| `server/cloudStorage.ts` | Replit App Storage (cloud) sync for production persistence |
| `shared/schema.ts` | Drizzle schema + TypeScript types |
| `client/src/App.tsx` | React app router + dark mode toggle + auth gate + subscription gate |
| `client/src/lib/theme.tsx` | ThemeProvider context (dark mode via class toggle on `<html>`) |
| `client/src/lib/auth.ts` | Auth hook (user, role, onboarding status, subscription status) |
| `client/src/components/app-sidebar.tsx` | Navigation sidebar (role-based menu items) |
| `client/src/components/ui/password-input.tsx` | Reusable password input with show/hide toggle |

### Frontend Pages
| Page File | Route | Access |
|-----------|-------|--------|
| `dashboard.tsx` | `/` | All authenticated users |
| `opportunities-list.tsx` | `/opportunities` | All authenticated users |
| `opportunity-form.tsx` | `/opportunities/new`, `/opportunities/:id/edit` | All authenticated users |
| `opportunity-detail.tsx` | `/opportunities/:id` | All authenticated users |
| `reference-measurements.tsx` | `/measurements` | All authenticated users |
| `profile.tsx` | `/profile` | All authenticated users |
| `owner-onboarding.tsx` | (conditional render) | ADMIN (first-time only) |
| `admin-tenants.tsx` | `/admin/tenants` | SUPER_ADMIN |
| `admin-users.tsx` | `/admin/users` | ADMIN, SUPER_ADMIN |
| `admin-rules.tsx` | `/admin/rules` | SUPER_ADMIN, ADMIN |
| `admin-references.tsx` | `/admin/references` | SUPER_ADMIN |
| `admin-sign-types.tsx` | `/admin/sign-types` | SUPER_ADMIN |
| `admin-company.tsx` | `/admin/company` | ADMIN |
| `admin-usage.tsx` | `/admin/usage` | SUPER_ADMIN |
| `admin-subscriptions.tsx` | `/admin/subscriptions` | SUPER_ADMIN |
| `admin-email-templates.tsx` | `/admin/email-templates` | SUPER_ADMIN |
| `subscription-pricing.tsx` | `/subscribe` | All (subscription gate) |
| `my-subscription.tsx` | `/my-subscription` | ADMIN |
| `login.tsx` | (conditional render) | Unauthenticated |

### Reusable Components
| Component | Purpose |
|-----------|---------|
| `password-input.tsx` | Password field with eye icon toggle (show/hide), used across login, user management, tenant creation, and profile pages |
| `app-sidebar.tsx` | Role-based navigation sidebar with Navigation, Admin, and Manuals sections |

---

## Environment Variables

### Required for Production

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/signsalesiq` |
| `SESSION_SECRET` | Secret for signing session cookies (min 32 chars) | `a-long-random-string-here-min-32-chars` |
| `AI_INTEGRATIONS_GEMINI_API_KEY` | Google AI / Gemini API key | `AIza...` |
| `AI_INTEGRATIONS_GEMINI_BASE_URL` | Gemini API base URL | `https://generativelanguage.googleapis.com/v1beta` |
| `GOOGLE_API_KEY` | Google Gemini API key (fallback, separate quota) | `AIza...` |
| `NODE_ENV` | Set to `production` | `production` |
| `PORT` | Server port (defaults to 5000) | `5000` |

### Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Stripe API secret key for subscriptions | — |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | — |
| `VITE_STRIPE_PUBLIC_KEY` | Stripe publishable key (frontend) | — |
| `SMTP_FROM` | Gmail address for sending emails (defaults to fswaltham@gmail.com) | — |
| `SMTP_PASS` | Gmail app-specific password for SMTP | — |
| `REPL_ID` | Used for Replit OIDC SSO (not needed outside Replit) | — |
| `ISSUER_URL` | OIDC issuer URL (Replit-specific) | `https://replit.com/oidc` |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | Replit object storage bucket ID | — |
| `PUBLIC_OBJECT_SEARCH_PATHS` | Public object search paths (cloud storage) | — |
| `PRIVATE_OBJECT_DIR` | Private object directory (cloud storage) | — |

### Getting API Keys

#### Google Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click **Create API Key**
3. Copy the key → set as `AI_INTEGRATIONS_GEMINI_API_KEY`
4. Set `AI_INTEGRATIONS_GEMINI_BASE_URL` to `https://generativelanguage.googleapis.com/v1beta`
5. The app uses models:
   - `gemini-3-pro-image-preview` for image generation/mockups
   - `gemini-2.5-flash` for chat/text generation (sign codes, note polishing, rationale)

#### Google Gemini Fallback API Key
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create a second API key (separate from the primary, ideally on a different project for independent quota)
3. Copy the key → set as `GOOGLE_API_KEY`
4. This key is used automatically when the primary key is exhausted or fails after 4 retries
5. The fallback tries models in order: `gemini-2.0-flash-exp-image-generation`, `gemini-2.5-flash-image`, `gemini-3-pro-image-preview`

#### Stripe (Subscriptions)
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Copy Secret key → set as `STRIPE_SECRET_KEY`
3. Copy Publishable key → set as `VITE_STRIPE_PUBLIC_KEY`
4. Set up a webhook endpoint pointing to `/api/stripe/webhook` and copy the signing secret → set as `STRIPE_WEBHOOK_SECRET`

#### Gmail SMTP (Email)
1. Enable 2-Factor Authentication on your Gmail account
2. Go to Google Account > Security > App passwords
3. Generate an app-specific password → set as `SMTP_PASS`
4. Set `SMTP_FROM` to the Gmail address (defaults to `fswaltham@gmail.com` if not set)

---

## Database Setup

### PostgreSQL Requirements
- PostgreSQL 14+ recommended
- The app uses Drizzle ORM and will create tables automatically on first run via `npm run db:push`

### Initial Setup
```bash
createdb signsalesiq

export DATABASE_URL="postgresql://user:password@localhost:5432/signsalesiq"

npm run db:push

# The app auto-seeds on startup:
# - 45+ sign types with descriptions + sample prompts (Interior, Exterior, Vehicle categories)
# - 159 reference image records
# - 50+ global product rules (all sign types × budget ranges)
# - Default users (admin/1waltham, tenantadmin/1waltham, sales/1waltham)
# - Default tenants
```

### Tables Created
| Table | Purpose |
|-------|---------|
| `users` | User accounts with roles, tenant association, phone, lastLoginAt tracking |
| `tenants` | Owner organizations (name, address, phone, email, website, logo, PDF template, header/footer/banner text, colors, slug, active status, onboarding status) |
| `opportunities` | Sales opportunities with clientName, contactName, address, budget, status, signCodeText, notes, promptBox |
| `sign_specs` | Individual sign specifications per opportunity (location type, sign type, prompt, target audience, read distance, showSignCode) |
| `assets` | Uploaded files (site photos, logos) linked to sign specs with dimensions (width/height) |
| `planes` | 4-point placement coordinates + reference measurements (referenceLine, referenceLengthInches) per sign spec |
| `outputs` | Generated mockup results per tier (composite + AI mockup filenames, rationale, compliance text, accuracy scores, project notes) |
| `product_rules` | Good/Better/Best product configuration rules (global + tenant overrides, configurable enabled tiers, per-tier sign type overrides) |
| `sign_types` | Dynamic sign type catalog (45+ types with name, label, category, description, samplePrompt, attributes, showSignCode, active flag) |
| `sign_type_references` | Reference images per sign type (for AI learning) |
| `exports` | PDF export records |
| `owner_subscriptions` | Tenant subscription records (plan, status, Stripe IDs) |
| `subscription_plans` | Plan definitions (name, price, limits, features, Stripe price ID) |
| `email_templates` | Customizable email templates |
| `sessions` | Express session store (auto-created by connect-pg-simple) |

### Key Schema Notes
- **Sign types** are dynamic (stored in `sign_types` table, not an enum). Each has: `name` (unique key), `label` (display), `category` (INTERIOR/EXTERIOR/VEHICLE), `description` (for AI prompts), `samplePrompt` (auto-fills user prompt field), `attributes` (JSON array of finishes/options), `showSignCode` (boolean, controls sign code lookup), `active` (boolean)
- **Product rules** have `tenantId` (nullable) — null = global template, non-null = tenant override. Include `enabledTiers` (JSON array) and per-tier sign type overrides (`goodSignType`, `betterSignType`, `bestSignType`)
- **Output fields** `aiMockupFilename` and `accuracyScoreAI` map to DB columns `firefly_image_filename` and `accuracy_score_firefly` (column aliases kept for backward compatibility)
- **Budget ranges**: `0_500`, `500_1K`, `1K_2K`, `2K_5K`, `5K_10K`, `10K_PLUS`
- **Opportunity status**: `OPEN`, `WON`, `LOST`, `FOLLOW_UP` — displayed with color-coded indicators
- **Opportunity uses `clientName`** (not `name`) — important for any code referencing opportunity name fields
- **User roles**: `SUPER_ADMIN`, `ADMIN`, `SALES`, `ACCOUNT_MANAGER`, `PROJECT_MANAGER`, `OUTSIDE_SALES`, `INSIDE_SALES`, `SALES_MANAGER`, `DESIGNER`, `PRODUCTION_MANAGER`

### Backup Strategy
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

psql $DATABASE_URL < backup_20260226_120000.sql

tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/ outputs/
```

---

## AI API Configuration

### Primary: Google Gemini

The app uses `@google/genai` SDK to call Gemini's image generation API.

**File:** `server/geminiMockupService.ts`

**How it works:**
```
User triggers "Generate" →
  1. Build prompt (sign type description + tier specs + logo + references)
     - Includes sign type accuracy requirements (construction method, mounting, illumination, depth)
     - Includes concrete material specs per tier (Good/Better/Best)
     - ABSOLUTE RULES section enforces photo preservation and logo fidelity
  2. Call Gemini gemini-3-pro-image-preview with image inputs
  3. If site photo + plane exists:
     a. Crop plane region from site photo
     b. Send cropped region to Gemini as context
     c. Generate isolated sign face rendered onto actual wall surface
     d. Composite result back onto full site photo using sharp
  4. If site photo exists but no plane:
     a. Send full site photo to Gemini
     b. Ask Gemini to place sign on the actual building
  5. If no site photo:
     a. Generate complete scene mockup from prompt alone
  6. Save result to outputs/ directory
```

**AI Models Used:**
- `gemini-3-pro-image-preview` — Image generation (mockups)
- `gemini-2.5-flash` — Text generation (sign codes, note polishing, rationale, compliance)

**Retry logic:**
- Up to 4 attempts
- Exponential backoff: 10s, 20s, 30s, 40s delays on rate limit (429) or timeout errors
- After all retries fail → falls back to Gemini via GOOGLE_API_KEY

### Fallback: Gemini via GOOGLE_API_KEY

When the primary Gemini key (`AI_INTEGRATIONS_GEMINI_API_KEY`) is exhausted or fails, the system falls back to a second Gemini API key (`GOOGLE_API_KEY`) and tries multiple image-capable models in order:

**How it works:**
```
Primary Gemini fails after 4 retries →
  1. Try gemini-2.0-flash-exp-image-generation (with logo + reference images)
  2. If that fails → Try gemini-2.5-flash-image
  3. If that fails → Try gemini-3-pro-image-preview
  4. If all fail → Return error to user
```

**Models tried (in order):** `gemini-2.0-flash-exp-image-generation`, `gemini-2.5-flash-image`, `gemini-3-pro-image-preview`

### Text Generation Services

**File:** `server/llmService.ts`

Uses `gemini-2.5-flash` for:
- Generating sales rationale text per tier
- Generating compliance/regulatory text
- Polishing user-written project notes into professional copy

**File:** `server/signCodeService.ts`

Uses `gemini-2.5-flash` for:
- Researching local municipal sign codes based on address
- Generating formatted regulation summaries (permit requirements, size limits, illumination rules, etc.)

### Code Locations for API Configuration

```typescript
// server/geminiMockupService.ts - Gemini client initialization
const ai = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

// server/geminiMockupService.ts - Gemini fallback client (separate API key)
const fallbackAi = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});
```

### Moving Away from Replit AI Integrations

On Replit, the `AI_INTEGRATIONS_*` environment variables are set automatically by the platform. When moving to production:

1. **No code changes needed** — the code reads standard env vars
2. Just set the 4 environment variables with your own API keys and the standard API base URLs
3. The SDK calls (`@google/genai`) work identically with direct API keys

---

## File Storage

### Current Setup (Local Filesystem)
```
./uploads/     → User uploads (site photos, logos, reference images, PDF templates, owner logos)
./outputs/     → Generated files (mockups, composites, PDFs)
```

### File Path Resolution
**File:** `server/filePaths.ts`

The app has a path resolution system that checks:
1. Primary location (`./uploads/filename` or `./outputs/filename`)
2. Fallback to `./dist/uploads/filename` or `./dist/outputs/filename` (for production builds)

### Replit Cloud Storage Sync
**File:** `server/cloudStorage.ts`

On Replit, the app syncs files to Replit App Storage (cloud object storage) for production persistence. This uses the `DEFAULT_OBJECT_STORAGE_BUCKET_ID`, `PUBLIC_OBJECT_SEARCH_PATHS`, and `PRIVATE_OBJECT_DIR` environment variables. Outside of Replit, this feature is inactive and local filesystem is used exclusively.

### Production Considerations

**Option A: Keep Local Storage (Simple)**
- Ensure the `uploads/` and `outputs/` directories exist and are writable
- The build script copies these to `dist/` automatically
- Back up these directories regularly
- Works well for single-server deployments

**Option B: Move to Cloud Storage (Recommended for Scale)**
If you need to scale beyond a single server, you'll need to modify file storage:

1. Replace local `fs` operations with S3-compatible storage (AWS S3, DigitalOcean Spaces, etc.)
2. Key files to modify:
   - `server/filePaths.ts` — Change path resolution to return S3 URLs
   - `server/routes.ts` — Update multer config to upload directly to S3
   - `server/routes.ts` — Update `/api/uploads/:filename` to proxy or redirect to S3
   - `server/geminiMockupService.ts` — Update file read/write for mockup outputs
   - `server/pdfService.ts` — Update file read/write for PDF generation
   - `server/compositeService.ts` — Update composite image read/write

3. Install `@aws-sdk/client-s3` or `aws-sdk` package
4. Create a storage abstraction layer to swap local ↔ S3

---

## Authentication & Sessions

### Session Configuration
**File:** `server/routes.ts`

```typescript
app.use(session({
  store: new PGStore({
    pool: pool,              // Uses same PostgreSQL connection
    tableName: "sessions",   // Auto-created
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
    httpOnly: true,
    secure: true,             // Set to true in production
    sameSite: "lax",
  },
}));
```

### Production Cookie Settings
The app already sets `secure: true` when `NODE_ENV === "production"` or when running on Replit. For DigitalOcean:
- Ensure you're serving over HTTPS (required for secure cookies)
- The `sameSite: "lax"` setting is appropriate for most deployments

### Login Methods

#### Password Authentication
- Endpoint: `POST /api/auth/login`
- Uses `bcrypt` for password hashing
- Login is case-insensitive (email/username normalized to lowercase)
- `lastLoginAt` timestamp recorded on each login
- Password fields use the `PasswordInput` component with eye icon toggle
- Works identically everywhere — no changes needed for production

#### Google SSO (Replit-Specific)
The Replit OIDC SSO (`/api/login`, `/api/callback`) is Replit-specific and will not work outside Replit. Options:
1. **Remove it:** Delete the OIDC routes and the "Sign in with Google" button from the login page
2. **Replace it:** Implement standard Google OAuth 2.0 using `passport-google-oauth20`

To implement standard Google OAuth:
```bash
npm install passport-google-oauth20
```
Then replace the Replit OIDC strategy in `server/routes.ts` with a standard Google strategy using your Google Cloud Console OAuth credentials.

### Default Credentials
| Role | Username | Password |
|------|----------|----------|
| Super Admin | `admin` | `1waltham` |
| Owner Admin | `tenantadmin` | `1waltham` |
| Sales | `sales` | `1waltham` |

---

## Multi-Tenancy & RBAC

### Role Hierarchy

| Role | Level | Access |
|------|-------|--------|
| `SUPER_ADMIN` | Platform | All features, all tenants, Owner/Sign Type/Reference/Usage/Subscription/Email management |
| `ADMIN` | Tenant (Owner) | Own tenant's users, company settings, rules engine, subscription, all team opportunities |
| `SALES` | User | Dashboard + own opportunities within own tenant + reference measurements |
| `ACCOUNT_MANAGER` | User | Same as Sales |
| `PROJECT_MANAGER` | User | Same as Sales |
| `OUTSIDE_SALES` | User | Same as Sales |
| `INSIDE_SALES` | User | Same as Sales |
| `SALES_MANAGER` | User | Same as Sales |
| `DESIGNER` | User | Same as Sales |
| `PRODUCTION_MANAGER` | User | Same as Sales |

### Super Admin Capabilities
- Manage Owners (create, edit, delete, activate/deactivate, view user lists, reset passwords)
- Manage Sign Types (full CRUD, 45+ types with descriptions, attributes, sample prompts, active toggle)
- Manage Reference Images (upload per sign type, up to 100 files per upload)
- Manage Global Product Rules (template rules inherited by all owners)
- Manage Subscription Plans (create/edit pricing tiers, assign to tenants)
- Manage Email Templates (edit system-wide email templates, view logs)
- View Usage & Activity (per-user metrics + chronological activity log)
- Accuracy Checklist (visible to Super Admin only on opportunity detail)
- Mockup Test Bench (test AI mockups without creating an opportunity)
- Assign Super Admin role to other users
- Search owners by zip code, name, or email
- Reference Measurements tool (standalone site measurement)

### Owner Admin Capabilities
- Owner Onboarding (first-time setup: business info, logo, PDF template, header/footer/banner text, colors)
- Company Settings (update business details, branding, PDF customization)
- User Management (create/edit users within own tenant; gated behind onboarding completion)
- Tenant Rules Engine (copy global rules, customize tiers for own business)
- My Subscription (view plan, usage, manage billing)
- Create/manage opportunities for own team (sees all team opportunities)
- Profile management (name, phone, email, password)
- Reference Measurements tool

### Owner Onboarding Flow
1. First-time ADMIN login detects `onboardingComplete === false`
2. App redirects to onboarding page
3. Owner fills in: business address, phone, email, website, logo (PNG/JPG/SVG/PDF), optional PDF template, custom header/footer/banner text, primary/accent colors
4. On submit, data is saved via `PATCH /api/tenant/profile` + file uploads
5. After completion, normal app access is granted
6. User management is gated — must complete onboarding before adding users

### Product Rules Engine
- Global rules (Super Admin) serve as templates visible to all owners
- Owners can copy global rules and customize them for their business
- Tenant-specific rules take priority over global rules during mockup generation
- Each rule maps: location type + sign type + budget range → Good/Better/Best tiers
- Configurable enabled tiers: can present 1, 2, or all 3 tiers per rule
- Per-tier sign type overrides allow different sign types for each tier

---

## Subscription & Billing

### Stripe Integration
**File:** `server/stripeService.ts`

The platform uses Stripe for subscription payments:
- Super Admins create subscription plans with pricing, opportunity limits, and feature lists
- Plans are linked to Stripe Price IDs for checkout
- Owners subscribe via the Stripe checkout flow
- Webhook handler at `/api/stripe/webhook` processes checkout completions
- Billing portal access for existing subscribers

### Subscription Gate
When a tenant does not have an active subscription:
- A modal overlay blocks access to the main application
- Users are prompted to select a plan
- After successful Stripe checkout, access is restored
- Super Admins are exempt from subscription requirements

### Environment Variables for Stripe
- `STRIPE_SECRET_KEY` — Stripe API secret key
- `STRIPE_WEBHOOK_SECRET` — Stripe webhook signing secret
- `VITE_STRIPE_PUBLIC_KEY` — Stripe publishable key (available on frontend via `import.meta.env`)

---

## Email Service

### Configuration
**File:** `server/emailService.ts`

Uses Nodemailer with Gmail SMTP for automated emails:

```typescript
// Requires:
// SMTP_FROM - Gmail address (defaults to fswaltham@gmail.com)
// SMTP_PASS - Gmail app-specific password
```

### Email Types
- Welcome emails to new Owner Admins (with login credentials)
- Welcome emails to new team members
- Opportunity creation notifications (sent to the client's email if provided)
- Status update notifications

### Important Notes
- Emails use the opportunity's `clientName` field (not `name`) for addressing
- Email templates are manageable via the Super Admin > Email Templates page
- Email delivery logs are visible in the Email Templates admin page

---

## Dark Mode & Theming

### Implementation
- **ThemeProvider** (`client/src/lib/theme.tsx`): React context using `useState` + `useLayoutEffect` to toggle the `dark` class on `document.documentElement`
- **Persistence**: User preference stored in `localStorage` key `ssiq-dark-mode`
- **Toggle**: Moon/Sun icon button in the top-right header bar, visible to all logged-in users
- **CSS**: Uses Tailwind's `darkMode: ["class"]` configuration with CSS custom properties defined in `:root` and `.dark` classes in `client/src/index.css`

### For Developers
- All UI components use Tailwind's `dark:` variant prefix for dark mode styles
- Color variables are defined as HSL values in `client/src/index.css` under `:root` (light) and `.dark` (dark) selectors
- shadcn/ui components automatically adapt to the active theme through CSS custom properties

---

## Build & Deploy

### Build Process
```bash
npm install

npm run build
# Runs: vite build (frontend) + esbuild (backend)
# Output: dist/
# Also copies uploads/ and outputs/ to dist/
```

### Production Start
```bash
NODE_ENV=production node dist/index.js
```

### Process Management
For production, use a process manager:

```bash
npm install -g pm2
pm2 start dist/index.js --name signsalesiq --env production
pm2 save
pm2 startup  # Auto-start on reboot
```

---

## Code Changes for Production

### Required Changes

#### 1. Remove Replit-Specific SSO (if not using Replit Auth)
In `server/routes.ts`, the OIDC routes can be safely removed or replaced:
```typescript
// Remove or replace these routes:
// /api/login
// /api/callback
```

In `client/src/pages/login.tsx`, remove the "Sign in with Google (SSO)" button if not replacing with standard Google OAuth.

#### 2. Session Cookie Security
In `server/routes.ts`, verify the cookie secure flag logic works for your domain:
```typescript
// Current logic:
secure: process.env.NODE_ENV === "production" || !!process.env.REPL_ID
// For DigitalOcean, just NODE_ENV=production is sufficient
```

#### 3. Remove Cloud Storage Sync (if not using Replit)
The `server/cloudStorage.ts` file handles Replit App Storage sync. On non-Replit deployments, this module is inactive but can be safely removed along with references in `server/routes.ts` if desired.

#### 4. CORS Configuration (if frontend served separately)
If you serve the frontend from a different domain than the API, add CORS:
```bash
npm install cors
```
```typescript
import cors from "cors";
app.use(cors({ origin: "https://your-frontend-domain.com", credentials: true }));
```
> Note: The current setup serves frontend and backend from the same origin, so CORS is not needed if you keep that architecture.

### Recommended Changes

#### 5. Add Rate Limiting
```bash
npm install express-rate-limit
```
```typescript
import rateLimit from "express-rate-limit";
app.use("/api/auth/login", rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                     // 10 attempts
}));
app.use("/api/", rateLimit({
  windowMs: 1 * 60 * 1000,   // 1 minute
  max: 100,                    // 100 requests
}));
```

#### 6. Add Helmet for Security Headers
```bash
npm install helmet
```
```typescript
import helmet from "helmet";
app.use(helmet());
```

#### 7. Add Request Logging
```bash
npm install morgan
```
```typescript
import morgan from "morgan";
app.use(morgan("combined"));
```

#### 8. Change Default Credentials
After initial deployment, immediately change the default passwords for all seeded users through the app's user management or directly in the database:
```bash
# Generate a new bcrypt hash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('your-new-password', 10).then(h => console.log(h));"
# Update in database
psql $DATABASE_URL -c "UPDATE users SET password = '\$2b\$10\$...' WHERE email = 'admin';"
```

---

## DigitalOcean Deployment

### Option A: App Platform (Recommended)
1. Push your code to a Git repository (GitHub/GitLab)
2. Create a new App on DigitalOcean App Platform
3. Configure:
   - **Source:** Your Git repository
   - **Build Command:** `npm run build`
   - **Run Command:** `node dist/index.js`
   - **Environment Variables:** Set all variables from the table above
4. Add a **Managed PostgreSQL Database** component
5. App Platform auto-configures `DATABASE_URL`
6. Enable HTTPS (automatic with App Platform)

### Option B: Droplet (Manual)
```bash
# 1. Create a Droplet (Ubuntu 22.04, 2GB+ RAM recommended)
# 2. SSH in and install dependencies
sudo apt update
sudo apt install -y nodejs npm postgresql nginx certbot

# 3. Clone your repo
git clone https://github.com/your-org/signsalesiq.git
cd signsalesiq

# 4. Install dependencies and build
npm install
npm run build

# 5. Set up PostgreSQL
sudo -u postgres createuser signsalesiq
sudo -u postgres createdb signsalesiq -O signsalesiq
sudo -u postgres psql -c "ALTER USER signsalesiq PASSWORD 'your-db-password';"

# 6. Create .env file
cat > .env << 'EOF'
DATABASE_URL=postgresql://signsalesiq:your-db-password@localhost:5432/signsalesiq
SESSION_SECRET=generate-a-random-64-char-string-here
AI_INTEGRATIONS_GEMINI_API_KEY=your-gemini-key
AI_INTEGRATIONS_GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta
GOOGLE_API_KEY=your-gemini-fallback-key
STRIPE_SECRET_KEY=your-stripe-secret
STRIPE_WEBHOOK_SECRET=your-stripe-webhook-secret
VITE_STRIPE_PUBLIC_KEY=your-stripe-publishable-key
SMTP_FROM=your-gmail@gmail.com
SMTP_PASS=your-app-password
NODE_ENV=production
PORT=5000
EOF

# 7. Push the database schema
npm run db:push

# 8. Create upload directories
mkdir -p uploads outputs

# 9. Start with PM2
npm install -g pm2
pm2 start dist/index.js --name signsalesiq
pm2 save
pm2 startup

# 10. Set up Nginx reverse proxy
sudo cat > /etc/nginx/sites-available/signsalesiq << 'EOF'
server {
    listen 80;
    server_name your-domain.com;
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/signsalesiq /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 11. Set up SSL with Let's Encrypt
sudo certbot --nginx -d your-domain.com
```

### Important: Nginx `client_max_body_size`
The app uploads site photos, logos, and reference images (up to 100 files at once). Set `client_max_body_size` to at least `50M` in your Nginx config to avoid upload failures.

---

## Monitoring & Maintenance

### Health Check
The app serves the frontend at `/` — a simple HTTP 200 check on `/` confirms the server is running.

### Log Monitoring
```bash
pm2 logs signsalesiq

pm2 logs signsalesiq --lines 100
```

### Database Maintenance
```bash
# Regular backups (add to crontab)
0 2 * * * pg_dump $DATABASE_URL > /backups/signsalesiq_$(date +\%Y\%m\%d).sql

# Clean old sessions (connect-pg-simple handles expiry, but manual cleanup):
psql $DATABASE_URL -c "DELETE FROM sessions WHERE expire < NOW();"
```

### File Storage Maintenance
```bash
du -sh uploads/ outputs/

tar -czf /backups/files_$(date +%Y%m%d).tar.gz uploads/ outputs/
```

### Updating the Application
```bash
git pull origin main

npm install

npm run build

# Push schema changes (if any)
npm run db:push

pm2 restart signsalesiq
```

---

## API Reference (Key Endpoints)

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | Login with email/password (case-insensitive) |
| POST | `/api/auth/logout` | Logout (destroy session) |
| GET | `/api/auth/me` | Get current user + tenant onboarding status + subscription status |

### Opportunities
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/opportunities` | List opportunities (filtered by tenant/role) |
| GET | `/api/opportunities/:id` | Get opportunity detail + assets + specs + planes + outputs |
| POST | `/api/opportunities` | Create opportunity with sign specs |
| PATCH | `/api/opportunities/:id` | Update opportunity (tenant-authorized) |
| DELETE | `/api/opportunities/:id` | Delete opportunity (tenant-authorized) |
| PATCH | `/api/opportunities/:id/status` | Update opportunity status (OPEN/WON/LOST/FOLLOW_UP) |

### Sign Specs & Generation
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/sign-specs/:id/generate` | Generate mockups for a sign spec |
| POST | `/api/sign-specs/:id/plane` | Save plane coordinates + reference measurement |
| POST | `/api/sign-specs/:id/assets` | Upload assets for a sign spec |

### AI Features
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/opportunities/:id/generate` | Generate all tier mockups |
| POST | `/api/opportunities/:id/lookup-sign-code` | AI sign code regulation lookup |
| POST | `/api/outputs/:id/polish-notes` | AI polish project notes via Gemini |
| POST | `/api/admin/test-mockup` | Test mockup generation (Super Admin only) |

### PDF Export & Documents
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/opportunities/:id/export-pdf` | Generate and download proposal PDF (uses owner branding) |
| GET | `/api/templates/sample-pdf` | Download sample 8.5x11 PDF template |
| GET | `/api/docs/:docName` | Download manuals as PDF (super-admin-manual, owner-admin-manual, sales-user-manual, developer-guide) |

### Admin — Super Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/tenants` | List/create owners |
| PATCH/DELETE | `/api/tenants/:id` | Update/delete owner |
| GET | `/api/tenants/:id/users` | List users for an owner |
| POST | `/api/tenants/:id/users` | Create user for an owner |
| PATCH | `/api/users/:id` | Edit user (name, email, phone, role, password reset) |
| GET/POST/PUT/DELETE | `/api/admin/sign-types` | CRUD sign types |
| GET/POST | `/api/admin/references` | Manage reference images |
| GET/POST | `/api/admin/rules` | Global product rules (CRUD) |
| GET | `/api/admin/rules-public` | Read-only global rules (for tenant admins) |
| GET | `/api/admin/usage` | Usage metrics and activity log |
| GET/POST/PATCH/DELETE | `/api/subscription-plans` | Manage subscription plans |
| GET | `/api/admin/email-templates` | List all email templates |
| GET | `/api/admin/email-templates/:id` | Get single email template |
| PATCH | `/api/admin/email-templates/:id` | Update email template |

### Admin — Owner Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PATCH | `/api/tenant/profile` | Get/update own tenant profile (including onboarding) |
| POST | `/api/tenant/profile/logo` | Upload tenant logo |
| POST | `/api/tenant/profile/template` | Upload PDF template |
| GET/POST | `/api/tenant/rules` | Tenant-specific product rules |
| POST | `/api/tenant/rules/copy` | Copy a global rule into tenant's own rule set |

### Subscriptions & Stripe
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/stripe/create-checkout-session` | Create Stripe checkout session (authenticated, non-Super Admin) |
| POST | `/api/stripe/webhook` | Stripe webhook handler (checkout.session.completed) |
| GET | `/api/stripe/verify-session/:sessionId` | Verify payment and activate subscription |

### Sign Types
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sign-types` | List all active sign types (authenticated) |

### User Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| PATCH | `/api/users/:id` | Update own profile (name, phone, email, password) |

### File Serving
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/uploads/:filename` | Serve uploaded files |
| GET | `/api/files/:oppId/:filename` | Serve generated output files |

---

## Troubleshooting

### Common Issues

**AI mockups failing with rate limits:**
- Gemini has rate limits on the free tier. Consider upgrading to a paid Google AI plan.
- The app automatically retries 4 times with backoff, then falls back to Gemini via GOOGLE_API_KEY.
- The fallback tries multiple Gemini models in order for maximum availability.

**AI mockups not matching sign type accurately:**
- Each sign type has a `description` field used in the AI prompt. Ensure descriptions accurately describe construction methods, materials, and mounting.
- Reference images per sign type improve AI accuracy — upload real-world examples via the Reference Images admin page.
- The `samplePrompt` field auto-fills the user's prompt textarea — ensure these are meaningful and descriptive.
- Use the Mockup Test Bench on the Sign Types page to test descriptions before users encounter issues.

**Session not persisting:**
- Ensure `SESSION_SECRET` is set and consistent across restarts.
- Ensure PostgreSQL is accessible and the `sessions` table exists.
- Check that cookies are set with `secure: true` only when serving over HTTPS.

**File uploads failing:**
- Check that `uploads/` and `outputs/` directories exist and are writable.
- Check Nginx `client_max_body_size` if behind a reverse proxy.
- Default multer limit is 100MB per file (reference image uploads support up to 100 files at once).

**Owner onboarding not showing:**
- Ensure the tenant record has `onboarding_complete = false` in the database.
- Only users with role `ADMIN` see the onboarding flow.
- Check `/api/auth/me` response for `tenantOnboardingComplete` field.

**Database connection errors:**
- Verify `DATABASE_URL` format: `postgresql://user:password@host:port/database`
- Check PostgreSQL is running and accepting connections.
- For DigitalOcean Managed DB, ensure your Droplet IP is in the trusted sources list.

**Dark mode not working:**
- Ensure `darkMode: ["class"]` is set in `tailwind.config.ts`.
- Check that the `dark` class is toggled on the `<html>` element (not `<body>`).
- Clear `localStorage` key `ssiq-dark-mode` to reset preference.

**Build failures:**
- Ensure Node.js 20+ is installed.
- Run `npm install` before `npm run build`.
- Check that TypeScript compilation succeeds with no errors.

**Sign types or rules not appearing:**
- The auto-seeder runs on startup (`server/seed.ts`). Check server logs for seed errors.
- Verify sign types exist: `psql $DATABASE_URL -c "SELECT COUNT(*) FROM sign_types;"` (should be 45+).
- Verify product rules exist: `psql $DATABASE_URL -c "SELECT COUNT(*) FROM product_rules;"` (should be 50+).

**Emails not sending:**
- Verify `SMTP_FROM` and `SMTP_PASS` are set.
- Ensure 2-Factor Authentication is enabled on the Gmail account.
- Check that the app password was generated correctly (not the regular Gmail password).
- View email logs in Super Admin > Email Templates.

**Stripe subscriptions not working:**
- Verify all three Stripe variables are set: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLIC_KEY`.
- Ensure the webhook endpoint `/api/stripe/webhook` is accessible from Stripe's servers.
- Check Stripe dashboard for webhook delivery failures.

**Reference Measurements page not loading:**
- Ensure the route `/measurements` is registered in `client/src/App.tsx`.
- The page works entirely client-side (no server API needed) — just needs the route and sidebar link.

**Password fields not showing eye icon:**
- Ensure the `PasswordInput` component from `@/components/ui/password-input` is being used instead of a regular `Input` with `type="password"`.
