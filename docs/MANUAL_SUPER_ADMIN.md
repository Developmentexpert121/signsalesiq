# SignSalesIQ - Super Admin Manual

## Role Overview

As a Super Admin, you have full control over the entire SignSalesIQ platform. You manage all Owner organizations, configure the global sign type catalog, maintain reference image libraries, set up product rules, manage subscription plans, configure email templates, and monitor platform-wide usage. You can also create and manage opportunities like any other user.

Default login: admin / 1waltham

---

## Logging In

1. Open SignSalesIQ in your browser.
2. You will see the login page with the SignSalesIQ logo at the top.
3. Enter your username (or email) and password.
4. Click "Sign In".
5. You will be taken to the Dashboard.

Alternatively, click "Sign in with Google / Replit" to use SSO if configured.

The password field includes a toggle eye icon to show or hide your password as you type.

---

## Dashboard

After logging in, you see the Dashboard - your home screen.

Screen Layout:
- Top bar: Sidebar toggle button on the left, "SignSalesIQ" text, dark mode toggle (sun/moon icon) on the right.
- Left sidebar: Navigation links, Platform Administration section, Manuals section, and your user profile at the bottom.
- Main area: Four stat cards across the top (Total Opportunities, Won, Follow-up, Lost), followed by a "Recent Opportunities" list.

### Stat Cards
- Total: Count of all opportunities across the platform.
- Won: Opportunities with "Won" status (blue).
- Follow-up: Opportunities needing follow-up (purple).
- Lost: Opportunities marked as lost (red).

### Recent Opportunities
- Shows the 5 most recent opportunities as cards.
- Each card has a colored left border indicating status (green=Open, blue=Won, purple=Follow-up, red=Lost).
- Card shows: Business Name, Address, Sign Type, Budget Range, and creation date.
- Click any card to open that opportunity's detail page.

---

## Sidebar Navigation

As Super Admin, your sidebar has these sections:

### Navigation
- Dashboard - Home screen with stats and recent opportunities.
- Opportunities - Full list of all opportunities across all Owners.
- Reference Measurements - Standalone site measurement tool.

### Platform Administration
- Owners - Create and manage Owner organizations.
- Users - Manage users across all Owners.
- Sign Types - Configure the global sign type catalog.
- Rules Engine - Set up global Good/Better/Best product rules.
- Reference Images - Upload example photos per sign type for AI learning.
- Usage & Activity - Platform-wide metrics and audit log.
- Subscription Plans - Create and manage subscription tiers for Owners.
- Email Templates - Manage system-wide email templates.

### Manuals
- Super Admin Manual (this document)
- Owner Admin Manual
- Sales User Manual
- Developer Guide

Each manual downloads as a PDF when clicked.

### Footer
- Your avatar, name, role badge ("Super Admin"), and logout button.
- Click your name/avatar to go to your Profile page.

---

## Dark Mode

Toggle between light and dark mode using the sun/moon icon button in the top-right corner of the header bar. Your preference is saved and persists across sessions.

---

## Your Profile

Click your name/avatar in the sidebar footer to access your Profile page.

On the Profile page, you can:
- Update your display name.
- Update your phone number.
- Change your email/login.
- Change your password (enter current password, then new password with confirmation).

All password fields include a toggle eye icon to show/hide the password.

---

## Owner Management

Navigate to: Sidebar > Owners

Screen Layout:
- Page title: "Owner Management" with a building icon.
- Subtitle: "Manage organizations and their access to the platform."
- Top right buttons: "Sample PDF Template" download link, "Add Owner" button.
- Below: List of Owner cards.

### Owner Card Details
Each Owner card shows:
- Company logo (or building icon if no logo uploaded).
- Company name and slug (URL identifier).
- Contact info: email, phone, address, website (with icons).
- Badges: Active/Inactive status, user count.
- Action buttons: Edit, Activate/Deactivate, Delete.

### Creating a New Owner
1. Click "Add Owner" button (top right).
2. A dialog appears with the title "New Owner".
3. Fill in:
   - Company Name (required) - The organization's name.
   - Slug (required) - Auto-generated from company name, used as a URL identifier.
   - Email - Organization contact email.
   - Phone - Organization phone number.
   - Address - Business address.
   - Website - Company website URL.
   - Company Logo - Upload PNG, JPG, SVG, or PDF (converted to PNG automatically).
4. Below a separator, fill in "Owner Admin Login":
   - Admin Full Name (required) - Name for the Owner's admin account.
   - Admin Email/Login (required) - The email they'll use to sign in.
   - Admin Password (required) - Their initial password. Use the eye icon to verify.
5. Click "Create Owner".
6. A success toast appears: "Owner created".
7. A welcome email is automatically sent to the new admin with their login credentials.

### Editing an Owner
1. Click the "Edit" button on any Owner card.
2. The edit dialog shows the same fields (except slug and admin login).
3. Modify any fields and click "Save Changes".
4. You can also upload a new logo to replace the existing one.

### Deactivating an Owner
1. Click "Deactivate" on the Owner card.
2. Confirm the action in the dialog.
3. When deactivated, all users under that Owner will be unable to log in.
4. The badge changes to "Inactive" (red).
5. Click "Activate" to re-enable.

### Deleting an Owner
1. Click the red "Delete" button.
2. Confirm in the dialog: "This will permanently remove this owner and cannot be undone."
3. Associated users will be unlinked.

---

## User Management

Navigate to: Sidebar > Users

Screen Layout:
- Page title: "User Management"
- Owner selector dropdown (top right) - Choose which Owner's users to view.
- "Add User" button.
- User list below with cards for each user.

### Viewing Users
- As Super Admin, you see a dropdown to select any Owner organization.
- The user list shows all users for the selected Owner.
- Each user card displays: Name, Email, Role badge, and action buttons (Edit, Delete).

### Creating a User
1. Click "Add User".
2. Fill in the dialog:
   - Full Name (required).
   - Email (required) - Used as login.
   - Password (required) - Use the eye icon to verify what you type.
   - Role - Select from: Super Admin, Admin, Sales, Account Manager, Project Manager, Outside Sales, Inside Sales, Sales Manager, Designer, Production Manager.
3. Click "Create User".
4. The user appears in the list immediately.

Note: Only Super Admins can assign the Super Admin role to other users. This option does not appear for other roles.

### Available Roles
- Super Admin - Full platform control across all organizations.
- Admin - Owner administrator, manages their team and settings.
- Sales - Creates and manages their own opportunities.
- Account Manager - Same access as Sales.
- Project Manager - Same access as Sales.
- Outside Sales - Same access as Sales.
- Inside Sales - Same access as Sales.
- Sales Manager - Same access as Sales.
- Designer - Same access as Sales.
- Production Manager - Same access as Sales.

### Editing/Deleting Users
- Click "Edit" to update name, email, or role. Leave password blank to keep existing, or enter a new password to reset.
- Click "Delete" to remove the user (with confirmation).

---

## Sign Type Management

Navigate to: Sidebar > Sign Types

Screen Layout:
- Page title: "Sign Types" with count badge.
- "Add Sign Type" button (top right).
- Category filter tabs: All, Interior, Exterior, Vehicle.
- Grid of sign type cards.
- Mockup Test Bench section at the bottom.

### Sign Type Card
Each card shows:
- Sign type label (display name).
- Category badge: Interior (blue), Exterior (green), or Vehicle.
- Description text (truncated, used by AI).
- Attributes/finishes list.
- Show Sign Code toggle indicator.
- Edit and Delete buttons.

### Adding a Sign Type
1. Click "Add Sign Type".
2. Fill in the dialog:
   - Name (required) - Internal key like "CHANNEL_LETTERS_FRONT_LIT".
   - Label (required) - Display name like "Channel Letters (Front-Lit)".
   - Category - Interior, Exterior, or Vehicle.
   - Description - Detailed text used by AI to understand the sign type. Include construction method, materials, mounting, illumination details. The more detailed, the better the AI mockups.
   - Sample Prompt - Default prompt text that auto-fills when users select this sign type.
   - Attributes - JSON array of finishes/options (e.g., ["Brushed Aluminum", "Painted Acrylic"]).
   - Show Sign Code - Toggle for auto sign code lookup. Defaults ON for exterior, OFF for interior.
3. Click "Create".

### Editing a Sign Type
- Click "Edit" on any card to modify all fields.
- Changes affect all future mockup generations using this sign type.

### Mockup Test Bench
At the bottom of the Sign Types page, Super Admins have a test bench:
1. Upload a site photo.
2. Upload a logo.
3. Select a sign type from the dropdown.
4. Enter a custom prompt.
5. Click "Generate Test Mockup".
6. The AI generates a mockup without needing a real opportunity.
7. Useful for testing sign type descriptions and prompt quality before users encounter issues.

---

## Rules Engine (Global)

Navigate to: Sidebar > Rules Engine

Screen Layout:
- Page title: "Product Rules Engine"
- "Add Rule" button.
- List of rule cards.

### Rule Card
Each rule shows:
- Sign Type, Location Type, Budget Range.
- Enabled Tiers: badges showing which tiers are active (Good, Better, Best).
- Product selections per tier.
- Edit and Delete buttons.

### Creating a Rule
1. Click "Add Rule".
2. Fill in:
   - Sign Type - Select from the catalog.
   - Location Type - Interior, Exterior, or Vehicle.
   - Budget Range - Select from the 6 budget tiers.
   - Enabled Tiers - Check which tiers to present (Good, Better, Best). Can enable 1, 2, or all 3.
   - Good/Better/Best Products - Select products for each enabled tier.
   - Tier Sign Types (optional) - Override the sign type used for AI mockup per tier.
3. Click "Save Rule".

### How Rules Work
- Global rules serve as templates/defaults for all Owners.
- Owner Admins can copy and customize these rules for their organization.
- When a user generates mockups, the system looks for tenant-specific rules first, then falls back to global rules.
- The enabled tiers control how many mockup options are generated.

---

## Reference Image Library

Navigate to: Sidebar > Reference Images

Screen Layout:
- Page title: "Sign Type Reference Images"
- Sign type filter dropdown.
- Upload area.
- Grid of reference images.

### Uploading Reference Images
1. Select a sign type from the dropdown.
2. Click "Upload" or drag files into the upload area.
3. You can upload up to 100 files at once.
4. Supported formats: PNG, JPG, JPEG.
5. Images are stored and associated with the selected sign type.

### How Reference Images Work
- During AI mockup generation, up to 2 reference images for the relevant sign type are sent to the AI along with the prompt.
- This helps the AI understand what the sign type should look like (materials, construction, mounting style).
- More reference images = better AI accuracy.

### Managing Images
- View all reference images filtered by sign type.
- Delete individual images by clicking the X button.

---

## Usage & Activity

Navigate to: Sidebar > Usage & Activity

Screen Layout:
- Two tabs: "Usage" and "Activity Log".

### Usage Tab
- Summary stat cards: Total Users, Opportunities, Mockups, Exports.
- Below: Expandable cards for each Owner organization showing:
  - Owner name with user count, opportunities, mockups, and exports.
  - Table of individual users with columns: User, Role, Opportunities, Mockups, AI Mockups, Exports, Assets, Last Activity.

### Activity Log Tab
- Chronological list of all actions across the platform.
- Each entry shows: Timestamp, User name, Action type, Description.
- Useful for troubleshooting and auditing.

---

## Subscription Plans

Navigate to: Sidebar > Subscription Plans

This page allows you to create and manage subscription tiers that Owner organizations can purchase.

### Managing Plans
- Create subscription plans with names, descriptions, pricing, and event limits (e.g., number of opportunities allowed per month).
- Define feature lists for each tier.
- Plans integrate with Stripe for payment processing.
- Assign or override subscription plans for specific tenants.

### Subscription Gate
When a tenant's subscription expires or they don't have an active plan, their users see a subscription modal requiring plan selection. This gate blocks access to core features until a valid subscription is active.

---

## Email Templates

Navigate to: Sidebar > Email Templates

Manage system-wide email templates used for automated communications.

### Available Templates
- Welcome emails sent to new Owner Admins and users.
- Opportunity status notification emails.
- Subscription-related emails.

### Editing Templates
- View and edit HTML email templates.
- Preview how emails will appear.
- View email sending logs to track delivery.

---

## Working with Opportunities

As Super Admin, you can create and manage opportunities like any user.

### Creating an Opportunity
1. Go to Sidebar > Opportunities.
2. Click "New Opportunity".
3. Fill in the intake form:
   - Business Name (required).
   - Contact Name.
   - Address (required) - Used for sign code lookups.
   - Phone, Email.
   - Notes - Internal notes.
4. Add Sign Specs - Click "Add Sign Spec" for each sign:
   - Location Type: Interior, Exterior, or Vehicle.
   - Sign Type: Select from catalog.
   - Budget Range: Select tier.
   - Target Audience, Sign Duration.
   - Read Distance (optional).
   - Prompt: Creative brief for the AI (e.g., "Modern illuminated channel letters in blue").
5. Click "Save".

### Opportunity Detail Page
After creating, click into an opportunity to see the detail page.

Screen Layout:
- Top section: Business name, address (clickable for maps), contact info, status selector buttons (Open, Won, Follow-up, Lost), Edit and Delete buttons.
- Project Notes section: Internal notes with auto-save.
- Sign Code section (for exterior signs): Sign code regulation lookup results.
- Sign Specs section: Numbered tabs for each spec.

### Working with a Sign Spec
Each spec has a workflow with these steps:

1. Upload Assets
   - Site Photo: Upload a photo of the building/location.
   - Logo: Upload the client's logo file. SVG/PDF files auto-convert to PNG.
   - Both are optional but improve results.

2. Define Placement Plane
   - Click 4 points on the site photo to define where the sign goes.
   - Drag points to adjust. Scroll to zoom. Alt+drag to pan.
   - Click "Save Plane" when positioned correctly.

3. Reference Measurement (optional)
   - After placing 4 points, check "Add Reference Measurement".
   - Draw a line over a known dimension (e.g., a door).
   - Enter the real measurement in inches or feet (toggle between units).
   - System calculates estimated sign dimensions and square footage.

4. Generate Mockups
   - Click "Generate" to create Good/Better/Best mockups.
   - The AI uses your logo, prompt, sign type description, and reference images.
   - Results show side by side: Before vs After.

5. Project Notes
   - Edit notes per tier — notes auto-save as you type.
   - Use "Polish with AI" to rewrite notes professionally.

6. Download Mockups
   - Each tier has a download button to save the mockup image to your device.

7. Accuracy Checklist (Super Admin only)
   - Score the mockup quality on various criteria (placement, perspective, scale, logo fidelity).
   - This section is hidden from all other roles.
   - Useful for quality control and AI tuning.

### Exporting PDF
- Click "Export PDF" to generate a professional proposal.
- PDF includes: Company header, client info, all sign specs with Before/After mockups, project notes, permit notices, and AI disclaimer.

### Opportunity Status
- Use the status buttons at the top of the detail page:
  - Open (green) - Active opportunity.
  - Won (blue) - Deal closed.
  - Follow-up (purple) - Needs follow-up.
  - Lost (red) - Did not close.

---

## Reference Measurements Tool

Navigate to: Sidebar > Reference Measurements

A standalone measurement tool for quick site estimation without creating an opportunity.

1. Upload a site photo (JPG, PNG, or WebP).
2. Click 4 points clockwise to define the area.
3. Check "Add Reference Measurement" and draw a reference line on a known feature.
4. Enter the real-world dimension.
5. Get instant estimated dimensions and square footage.

Use the "Change Photo" or "Remove" buttons to work with different images.

---

## Tips for Super Admins

1. Set up sign type descriptions carefully - they directly affect AI mockup quality. Include construction methods, materials, and mounting details.
2. Upload multiple reference images per sign type for better AI accuracy.
3. Create comprehensive global rules - Owner Admins will use these as templates.
4. Monitor the Usage & Activity page regularly to track platform adoption.
5. Use the Mockup Test Bench to validate sign type descriptions before users encounter issues.
6. When creating Owners, set strong initial passwords and advise admins to change them.
7. Deactivate (don't delete) Owners when they should lose access - this preserves their data.
8. Configure email templates for a professional onboarding experience.
9. Set up subscription plans with appropriate limits to manage platform usage.
10. Use the Accuracy Checklist on generated mockups to identify areas where sign type descriptions need improvement.
11. Only assign the Super Admin role to trusted platform administrators — this role has unrestricted access.
12. Use the Reference Measurements tool for quick site estimates when helping sales teams remotely.
