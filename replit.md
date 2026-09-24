# SignSalesIQ

## Overview
SignSalesIQ is an intelligent signage sales proposal platform designed to streamline the sales process for signage companies. It enables sales representatives to create opportunities, upload site photos, define placement planes, and generate sophisticated "Good/Better/Best" deterministic composite mockups. The platform leverages AI for realistic mockups and includes features like accuracy scoring and PDF export for professional proposals. The project aims to empower sales teams with advanced tools for proposal generation, enhancing efficiency and visual communication with clients.

## User Preferences
The user wants to communicate using clear and concise language. They prefer a structured workflow for generating proposals, focusing on iterative steps for sign specifications. The user values detailed explanations for AI-generated content and expects the system to handle complex image processing and AI interactions seamlessly. They also require robust administrative controls for managing users, tenants, and product rules, along with customizable PDF outputs.

## System Architecture
The application follows a client-server architecture. The frontend is built with **React 18, TypeScript, TailwindCSS, and shadcn/ui**, providing a modern and responsive user interface with a navy/teal color scheme for a professional look. The UI/UX prioritizes clear navigation, responsive layouts for mobile and desktop, and a modern aesthetic with color-coded elements.

The backend is an **Express.js and TypeScript** application. It handles business logic, data persistence, and integration with external services. **PostgreSQL** is used as the primary database, managed by **Drizzle ORM** for type-safe data access.

Core technical implementations include:
- **Role-Based Access Control (RBAC)**: Supports `SUPER_ADMIN`, `ADMIN`, and 8 additional user roles (Sales, Account Manager, Project Manager, Outside Sales, Inside Sales, Sales Manager, Designer, Production Manager).
- **Multi-tenancy**: Super Admins manage Owners (tenants), and Owners manage their users and specific rules. An onboarding wizard guides new Owner Admins through initial setup, including business information, logo, and PDF template customization.
- **Image Processing**: **Sharp** is used for deterministic image compositing.
- **AI Mockup Generation**: Leverages **Google Gemini (gemini-3-pro-image-preview)** for generating AI mockups. This involves detailed prompt engineering using site photos, logos, reference images, and database-driven sign type descriptions. A two-step AI pipeline is implemented where Gemini processes cropped plane regions for accurate sign placement on existing surfaces, then composites the result back onto the full site photo. For full-scene mockups without a defined plane, Gemini is prompted to place the sign naturally on the building.
- **PDF Generation**: **pdf-lib** is used to create customizable PDF proposals, incorporating owner-specific branding, header/footer text, customizable banner title (default: "SIGN CONCEPT RENDERING"), primary/accent color theming, and a modern professional template design. Tenant logo auto-embeds when uploaded.
- **Authentication**: Session-based authentication with `bcrypt` for password hashing and **Google SSO via Replit Auth (OIDC)**. `connect-pg-simple` is used for persistent session storage in PostgreSQL.
- **File Storage**: Local filesystem for `uploads/` and `outputs/` directories, with Replit App Storage for production persistence.
- **Product Rules Engine**: A configurable rules engine allows Super Admins to define global product rules, which can be overridden by Tenant Admins. Rules determine the "Good/Better/Best" tier configurations for proposals based on location, sign type, and budget.
- **Sign Type Management**: Dynamic `sign_types` table allows Super Admins to manage sign types, including their names, labels, categories, descriptions for AI, sample prompts, and attributes. A reference image library aids AI learning.
- **Canvas Interaction**: Features a 4-point plane selection on a canvas with zoom, pan, and drag-to-adjust points, including a reference measurement tool for accurate real-world dimensions.
- **Workflow**: Sequential sign specification workflow ensures users complete each step before proceeding, with numbered indicators and locked states.
- **Usage & Activity**: An admin page provides per-user metrics and a chronological activity log for troubleshooting.
- **Subscription Plans Management**: Super Admin page (`/admin/subscriptions`) with 3 tabs: Manage Plans (CRUD for plans with name, price, event limit, features, default plan toggle), Owner Subs (view/change owner subscription assignments with usage tracking), and Pricing Preview (card-based visual preview). Includes a Subscription Gate toggle to enable/disable subscription requirements. DB tables: `subscription_plans`, `owner_subscriptions`, `subscription_settings`.
- **Stripe Payment Integration**: `server/stripeService.ts` handles Stripe Checkout Sessions for one-time plan purchases. Routes: `POST /api/stripe/create-checkout-session` (non-SUPER_ADMIN, creates Stripe checkout — no tenant/org check required), `POST /api/stripe/webhook` (handles checkout.session.completed with signature verification via rawBody), `GET /api/stripe/verify-session/:sessionId` (verifies payment and activates subscription). Subscription gate: when enabled, non-SUPER_ADMIN users without active subscriptions see a modal overlay (`SubscriptionPricingPage`) on top of the blurred/dimmed dashboard. After payment, users are redirected to `/my-subscription` (management page). Schema fields: `is_default` on subscription_plans, `stripe_customer_id` on tenants, `stripe_session_id`/`stripe_subscription_id`/`user_id` on owner_subscriptions. Subscriptions support both tenant-based (via `tenantId`) and user-based (via `userId`) ownership — users without a tenant get subscriptions keyed by their userId.
- **My Subscription Page**: `/my-subscription` (`client/src/pages/my-subscription.tsx`) displays active plan details (name, price, usage stats), a usage progress bar, Used/Remaining/Completed stat cards, a countdown timer showing plan expiry (30 days from subscribedAt), and an "Available Plans" section with upgrade options. Accessible via "My Subscription" sidebar link for tenant admins.
- **Email Templates Management**: Super Admin page (`/admin/email-templates`) with 2 tabs: Templates (list all 6 email templates with preview and edit capabilities, variable reference badges) and Sent Emails (searchable log of all emails sent with status, recipient, type, and timestamp). DB tables: `email_templates` (template_key, name, subject, body_html, variables, description, active), `email_logs` (template_key, recipient_email, recipient_name, subject, status, error_message, metadata, sent_at). Email service (`server/emailService.ts`) logs every email sent/failed/skipped to the `email_logs` table. Default templates seeded on startup via `seedEmailTemplates()`. Templates use `{{variable}}` syntax for dynamic content.

## Database Seeding (Fresh Deployment)

On every app startup, `server/seed.ts` automatically initializes the database. It is fully **idempotent** — safe to run multiple times without duplicating data.

### What gets seeded automatically:
1. **All 9 tenants** (idempotent by slug):
   - Default Tenant (`default`)
   - FASTSIGNS Plaistow (`fastsigns-plaistow`)
   - FASTSIGNS of Waltham (`fs-waltham`)
   - FASTSIGNS DTC (`fastsigns.com/221`)
   - FASTSIGNS Lancaster (`fastsigns.com/lancaster-pa/`)
   - FASTSIGNS of Saratoga Springs (`fastsigns-of-saratoga-springs`)
   - FASTSIGNS® of Newington (`fastsigns-of-newington`)
   - Test Owner (`test-owner`)
   - FastSigns of Waltham (`fastsigns-waltham`)
2. **SUPER_ADMIN users** (password: `SEED_ADMIN_PASSWORD`, default: `1waltham`):
   - `admin`
   - `developmentexpert121@gmail.com`
3. **All 15 tenant-linked users** (password: `SEED_USER_PASSWORD`, default: `SignSales2025!`):
   - `tenantadmin` (ADMIN → Default Tenant)
   - `sales` (SALES → Default Tenant)
   - `vj.ohol@fastsigns.com` (ADMIN → FASTSIGNS Plaistow)
   - `lorena.filian@fastsigns.com` (SALES → FASTSIGNS Plaistow)
   - `smehta@fastsigns.com` (ADMIN → FASTSIGNS of Waltham)
   - `travis.martin@fastsigns.com` (SALES → FASTSIGNS of Waltham)
   - `john.dowd@fastsigns.com` (SALES → FASTSIGNS of Waltham)
   - `vishnu` (SALES → FASTSIGNS of Waltham)
   - `brendan.donovan@fastsigns.com` (SALES → FASTSIGNS of Waltham)
   - `b.williams@fastsigns.com` (ADMIN → FASTSIGNS DTC)
   - `wes.kauffman@concordiaholdco.com` (ADMIN → FASTSIGNS Lancaster)
   - `rick.bult@fastsigns.com` (ADMIN → FASTSIGNS of Saratoga Springs)
   - `joel.miller@fastsigns.com` (ADMIN → FASTSIGNS® of Newington)
   - `vjkalwani@yahoo.com` (ADMIN → Test Owner)
   - `syncuser` (SALES → Test Owner)
4. **Sign types** (full catalog from `seedSignTypeData.ts`)
5. **Global product rules** (one per sign type)
6. **Reference images** (from `seedReferenceData.ts`)
7. **Email templates** (6 default templates via `seedEmailTemplates()`)

### To override default passwords on a new server:
Set these environment variables before starting the app:
- `SEED_ADMIN_PASSWORD` — password for `admin` and `developmentexpert121@gmail.com`
- `SEED_USER_PASSWORD` — password for `smehta@fastsigns.com` and `vjkalwani@yahoo.com`

### Build/deploy command (DigitalOcean App Platform):
```
npm install && npm run db:migrate && npm run build
```
Then start: `npm start`

> **Never run `db:push` against production.** `drizzle-kit push` diffs and applies without a migration record — it can drop columns and silently lose data. Use `npm run db:migrate` (runs `scripts/migrate.ts`) instead.
> To generate a new migration after schema changes: `npm run db:generate` → inspect the SQL → commit alongside the schema change.

## External Dependencies
- **Google Gemini (Primary)**: AI mockup generation via `VERTEX_API_KEY` or `GOOGLE_API_KEY` (whichever is set) using `gemini-3-pro-image-preview`. Both are direct Gemini API keys that work in development and production.
- **Google Gemini (Fallback)**: Fallback via `AI_INTEGRATIONS_GEMINI_API_KEY` (Replit-provided proxy at `localhost:1106`) trying models in order: `gemini-2.0-flash-exp-image-generation`, `gemini-2.5-flash-image`, `gemini-3-pro-image-preview`. Only works in development (Replit environment). Activates after primary key exhausts 4 retries, or immediately if no primary key is set.
- **Replit AI Integrations**: Provides the interface for AI model access.
- **Replit Auth (OIDC)**: Used for Google SSO integration.
- **sharp**: An image processing library for deterministic compositing.
- **pdf-lib**: Library for generating PDF documents.
- **PostgreSQL (Digital Ocean Managed)**: Primary production database hosted on Digital Ocean. Connection via `DO_DATABASE_URL` secret with SSL. Falls back to Replit's `DATABASE_URL` if `DO_DATABASE_URL` is not set.
- **Drizzle ORM**: ORM for PostgreSQL.
- **connect-pg-simple**: PostgreSQL-backed session store (uses shared pool from `server/db.ts`).