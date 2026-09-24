# SignSalesIQ - User Manual

## Table of Contents
1. [Getting Started](#getting-started)
2. [Roles & Permissions](#roles--permissions)
3. [Owner Onboarding](#owner-onboarding)
4. [Dashboard](#dashboard)
5. [Creating an Opportunity](#creating-an-opportunity)
6. [Working with Sign Specs](#working-with-sign-specs)
7. [Generating AI Mockups](#generating-ai-mockups)
8. [Exporting PDF Proposals](#exporting-pdf-proposals)
9. [Administration](#administration)

---

## Getting Started

### Logging In
1. Navigate to the SignSalesIQ login page.
2. Enter your **username/email** and **password**.
3. Click **Sign In**.
4. Alternatively, use **Sign in with Google** (SSO) if your account email matches a Google account.

> Login is case-insensitive — `John@Company.com` and `john@company.com` both work.

---

## Roles & Permissions

| Role | What You Can Do |
|------|----------------|
| **Super Admin** | Full platform access. Manage all Owners, users, sign types, reference images, global rules, and usage reporting. |
| **Owner Admin (ADMIN)** | Manage your own company: users, custom rules, company branding, PDF templates. See all opportunities across your team. |
| **Sales** | Create and manage your own opportunities, generate mockups, export PDFs. |
| **Account Manager** | Same as Sales — manage your own opportunities. |
| **Project Manager** | Same as Sales — manage your own opportunities. |
| **Outside Sales** | Same as Sales — manage your own opportunities. |
| **Inside Sales** | Same as Sales — manage your own opportunities. |
| **Sales Manager** | Same as Sales — manage your own opportunities. |
| **Designer** | Same as Sales — manage your own opportunities. |
| **Production Manager** | Same as Sales — manage your own opportunities. |

**Key distinction:** Owner Admins see all opportunities for their entire company. All other roles see only their own opportunities.

---

## Owner Onboarding

When an Owner Admin logs in for the first time, they are guided through a one-time setup wizard before accessing the app.

### Onboarding Steps
1. **Business Information**
   - Business Address (required)
   - Phone Number (required)
   - Email Address (required)
   - Website (optional)

2. **Company Logo**
   - Upload a PNG, JPG, SVG, or PDF file.
   - This logo appears on your PDF proposals and can be used in AI mockup generation.

3. **PDF Proposal Settings**
   - **PDF Template** (optional): Upload a custom 8.5" x 11" PDF background template for branded proposals. A sample template is available for download.
   - **Header Text** (optional): Custom text displayed at the top of every proposal page.
   - **Footer Text** (optional): Custom text displayed at the bottom of every proposal page.

4. Click **Complete Setup** to finish onboarding.

> After onboarding, you can update these settings anytime from **Company Settings** in the sidebar.

---

## Dashboard

The Dashboard is your home screen after login. It shows:
- **Quick stats** — total opportunities, recent activity.
- **Recent opportunities** — cards with color-coded status bars:
  - 🟢 Green = Open
  - 🔵 Blue = Won
  - 🟠 Orange = Follow-up
  - 🔴 Red = Lost

Click any opportunity card to view its details.

---

## Creating an Opportunity

1. Click **Opportunities** in the sidebar.
2. Click **New Opportunity**.
3. Fill in the intake form:

| Field | Description |
|-------|-------------|
| **Business Name** | The client's company name |
| **Contact Name** | Primary contact person |
| **Address** | Site/business address (used for sign code lookups) |
| **Phone** | Client phone number |
| **Email** | Client email |
| **Notes** | Internal notes about this opportunity |

4. **Add Sign Specs** — Each opportunity can have multiple sign specifications. For each spec, define:
   - **Location Type**: Interior or Exterior
   - **Sign Type**: Choose from the catalog (e.g., Channel Letters, Monument Sign, A-Frame)
   - **Budget Range**: $0-500, $500-1K, $1K-2K, $2K-5K, $5K-10K, or $10K+
   - **Target Audience**: Who will see the sign
   - **Sign Duration**: How long the sign will be displayed
   - **Prompt**: A creative brief describing the desired look and feel (e.g., "Modern illuminated channel letters in blue, matching brand colors")

5. Click **Save** to create the opportunity.

---

## Working with Sign Specs

Sign specs follow a **sequential workflow** — you must complete each spec before moving to the next.

### For Each Sign Spec:

#### Step 1: Upload Assets
- **Site Photo (Canvas)**: Upload a photo of the building or location where the sign will go. This is optional but produces better results.
- **Logo**: Upload the client's logo file. The AI will incorporate this into the mockup.

#### Step 2: Define the Placement Plane
If you uploaded a site photo:
1. Click on the photo to place 4 corner points defining where the sign should go.
2. The points form a quadrilateral — you can drag them to adjust.
3. Use **zoom** and **pan** to position precisely.

#### Step 3: Reference Measurement (Optional)
- Draw a reference line on the photo over a known dimension (e.g., a standard 36" door).
- Enter the real-world measurement in inches.
- The system calculates estimated sign dimensions (width x height in feet/inches + square footage).
- These dimensions are passed to the AI for proper scale.

#### Step 4: Sign Code Lookup (Exterior Signs)
- For exterior sign types, a **Sign Code Lookup** toggle is available.
- When enabled, the AI researches local municipal sign regulations based on the business address.
- Results include permit requirements, size limits, height restrictions, illumination rules, and setback distances.

#### Step 5: Generate Mockups
Click **Generate** to create Good/Better/Best mockups (see next section).

#### Step 6: Review Results
- View side-by-side: **Original Photo** vs **Sign Mockup** for each tier.
- Edit **Project Notes** per tier — use the "Polish with AI" button to rewrite rough notes into professional client-facing text.
- **Accuracy Checklist** (Super Admin only): Score the mockup quality.

> The numbered step indicators show your progress. A spec must have generated results before the next spec unlocks.

---

## Generating AI Mockups

### How It Works
When you click **Generate**, the system creates up to 3 tiers of mockups based on your product rules:

| Tier | Description |
|------|-------------|
| **Good** | Budget-friendly option |
| **Better** | Mid-range option |
| **Best** | Premium option |

The number of tiers shown depends on the product rules configured for your sign type and budget range. Rules can be customized by your Owner Admin.

### AI Generation Pipeline
1. **With Site Photo + Plane**: The AI generates an isolated sign face image, then digitally composites it onto your actual building photo in the exact location you defined. This preserves the original photo exactly.
2. **Without Site Photo**: The AI generates a complete scene showing the sign on a realistic building facade.

### What the AI Uses
- Your uploaded **logo** (prioritized over company name text)
- The **creative prompt** you wrote
- **Reference images** from the sign type library
- **Sign type description** (materials, construction method, illumination)
- **Estimated dimensions** from the reference measurement
- **Tier-specific material specs** (e.g., Good=flat cut acrylic, Best=illuminated channel letters)

### If Generation Fails
- The system automatically retries with Gemini up to 4 times with increasing wait times.
- If Gemini fails entirely, it automatically falls back to OpenAI for image generation.
- If both fail, you'll see an error message explaining the reason (usually rate limits — try again in a few minutes).

---

## Exporting PDF Proposals

1. Open an opportunity with generated mockups.
2. Click **Export PDF**.
3. The system generates a professional proposal including:
   - Company header with logo, address, and contact info
   - Custom header/footer text (if configured by Owner Admin)
   - Client information
   - Each sign spec with its tier mockups (Original Photo + Sign Mockup side by side)
   - Project notes per tier
   - Permit notice (if applicable sign types require permits)
   - AI disclaimer on every page

4. The PDF downloads automatically.

### Opportunity Status
Track the progress of each opportunity using status buttons on the detail page:
- **Open** — Active opportunity
- **Won** — Deal closed successfully
- **Follow-up** — Needs follow-up
- **Lost** — Did not close

Status colors are reflected as a left border bar on dashboard and list cards.

---

## Administration

### For Owner Admins

#### Company Settings
- Update business info (address, phone, email, website)
- Upload/change company logo
- Set custom PDF header and footer text
- Upload a branded PDF template

#### User Management
- Add team members with specific roles
- Edit user details and passwords
- Remove users
- **Note:** You must complete onboarding before adding users.

#### Custom Product Rules
- View the global rules set by Super Admin as templates
- Copy global rules and customize them for your company
- Configure which tiers (Good/Better/Best) to present for each sign type and budget combination
- Set different sign types per tier (e.g., Good=Flat Cut, Better=Channel Letters, Best=Illuminated)

#### Usage & Activity
- View per-user metrics: opportunities created, mockups generated, PDFs exported
- Activity log showing recent actions by your team

---

### For Super Admins

#### Owner Management
- Create new Owner organizations with initial admin accounts
- Activate/deactivate Owners (deactivated Owners' users cannot log in)
- Edit Owner details and upload logos
- Delete Owners

#### Sign Type Management
- Add, edit, and remove sign types from the global catalog
- Configure per sign type:
  - **Name & Label**: Internal key and display name
  - **Category**: Interior or Exterior
  - **Description**: Detailed text used by the AI to understand the sign type
  - **Attributes/Finishes**: JSON array of available materials and options
  - **Show Sign Code**: Whether to auto-lookup local regulations (defaults ON for exterior, OFF for interior)
- **Mockup Test Bench**: Upload a test site photo + logo, pick a sign type, and generate test mockups without needing a real opportunity

#### Reference Image Library
- Upload example photos for each sign type (up to 100 files per upload)
- These reference images are sent to the AI during mockup generation to improve accuracy
- View and manage the library organized by sign type

#### Global Product Rules
- Define default rules that serve as templates for all Owners
- Configure Good/Better/Best product selections per sign type + budget + location combination
- Set which tiers are enabled per rule

#### Usage & Activity
- Platform-wide metrics across all Owners
- Per-user breakdown by organization
- Chronological activity log for troubleshooting

---

## Tips & Best Practices

1. **Better photos = better mockups.** Use well-lit, straight-on photos of the building facade for best results.
2. **Draw the plane carefully.** The 4-point placement directly controls where the AI places the sign.
3. **Use reference measurements.** Adding a known dimension (like a door height) dramatically improves sign scale accuracy.
4. **Write descriptive prompts.** Include colors, style, and specific visual details in the prompt box.
5. **Upload the logo file.** The AI strongly prioritizes the actual logo image over just the company name.
6. **Check sign code results.** For exterior signs, review the automated regulation lookup before presenting to clients.
7. **Polish your notes.** Use the "Polish with AI" button to turn rough notes into professional proposal text.
