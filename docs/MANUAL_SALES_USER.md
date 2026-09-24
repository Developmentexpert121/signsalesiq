# SignSalesIQ - Sales User Manual

## Role Overview

As a Sales user (or any non-admin role such as Account Manager, Designer, Production Manager, etc.), you use SignSalesIQ to create client opportunities, upload site photos and logos, generate AI-powered sign mockups, and export professional PDF proposals. You see only your own opportunities.

---

## Logging In

1. Open SignSalesIQ in your browser.
2. You will see the login page with the SignSalesIQ logo.
3. Enter your username (or email) and password provided by your Owner Admin.
4. Click "Sign In".
5. You will be taken to the Dashboard.

Alternatively, if your organization uses Google/Replit SSO, click the "Sign in with Google / Replit" button to authenticate with your linked account. Your admin must have created an account with a matching email first.

The password field includes a toggle eye icon to show or hide your password as you type.

---

## Dashboard

After logging in, you see the Dashboard.

Screen Layout:
- Top bar: Sidebar toggle button on the left, "SignSalesIQ" text, dark mode toggle on the right.
- Left sidebar: Dashboard, Opportunities, and Reference Measurements links under Navigation, your profile at the bottom.
- Main area: Four stat cards (Total, Won, Follow-up, Lost) showing only YOUR opportunities, followed by Recent Opportunities.

### Stat Cards
- Total: Count of your opportunities.
- Won: Your opportunities marked as won.
- Follow-up: Your opportunities needing follow-up.
- Lost: Your opportunities marked as lost.

### Recent Opportunities
- Shows your 5 most recent opportunities.
- Each card has a colored left border: green=Open, blue=Won, purple=Follow-up, red=Lost.
- Card shows: Business Name, Address, Sign Type, Budget Range.
- Click any card to open it.

Important: You only see YOUR own opportunities. You cannot see opportunities created by other team members.

---

## Sidebar Navigation

As a Sales user, your sidebar has these sections:

### Navigation
- Dashboard - Your home screen with personal stats.
- Opportunities - Your opportunity list.
- Reference Measurements - Standalone site measurement tool.

### Footer
- Your avatar, name, role badge, company name, and logout button.
- Click your name/avatar to go to your Profile page.

---

## Dark Mode

You can toggle between light and dark mode using the sun/moon icon button in the top-right corner of the header bar. Your preference is saved and persists across sessions.

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

## Creating an Opportunity

This is the starting point of every sales engagement.

### Step 1: Open the Form
1. Go to Sidebar > Opportunities.
2. Click "New Opportunity" (top right).

### Step 2: Fill in Client Information

Screen: A form page with client fields at the top and a "Sign Specs" section below.

- Business Name (required) - The client's company name (e.g., "Acme Corporation").
- Contact Name - Primary contact person (e.g., "John Smith").
- Address (required) - The physical location where signs will be installed. Be specific - this is used for sign code lookups (e.g., "100 Main Street, Waltham, MA 02451").
- Phone - Client phone number.
- Email - Client email address.
- Notes - Internal notes only visible to you and your admin. Not included in proposals.

### Step 3: Add Sign Specs

Each opportunity can have multiple sign specifications. For example, a client might need both exterior channel letters and an interior lobby sign.

Click "Add Sign Spec" for each sign you want to propose. For each spec:

- Location Type - Choose Interior, Exterior, or Vehicle. This affects available sign types and sign code requirements.
- Sign Type - Select from the catalog (e.g., Channel Letters Front-Lit, Monument Sign, Vehicle Wrap). Your admin may have customized the available options.
- Budget Range - Select the client's budget tier:
  - $0 - $500
  - $500 - $1,000
  - $1,000 - $2,000
  - $2,000 - $5,000
  - $5,000 - $10,000
  - $10,000+
- Target Audience - Who will see the sign (e.g., Customers, Employees, General Public).
- Sign Duration - Permanent or Temporary.
- Read Distance (optional) - How far away the sign needs to be readable.
- Prompt Box - This is your creative brief for the AI. Write a description of what the sign should look like.

### Writing Good Prompts
The prompt is one of the most important fields. The more specific you are, the better the AI mockup will be.

Good prompts:
- "Modern illuminated channel letters in brushed aluminum with blue LED halo lighting, spelling ACME CORP"
- "Dimensional PVC letters painted to match the red and black logo colors, mounted on the brick facade above the entrance"
- "A-frame sidewalk sign with chalkboard-style design promoting daily lunch specials"
- "Full vehicle wrap with bold company branding and contact info on all exterior panels"

Weak prompts:
- "Nice sign" (too vague)
- "Channel letters" (no style details)
- "Something modern" (not specific enough)

### Step 4: Save
Click "Save" to create the opportunity. You'll be taken to the Opportunities list.

---

## Opportunity Detail Page

Click into any opportunity to see the full detail page.

Screen Layout:
- Top section: Business name (large heading), full address (clickable for Google Maps), contact info (phone, email).
- Status buttons row: Open, Won, Follow-up, Lost - click to change status.
- Edit button (pencil icon) and Delete button (trash icon) at top right.
- Project Notes section: Internal notes with auto-save functionality.
- Sign Code section: Appears for exterior signs, shows local regulation lookup results.
- Sign Specs section: Numbered step indicators at the top (1, 2, 3...), with the current spec's workflow below.

---

## Working with Sign Specs

Sign specs follow a sequential workflow within each spec.

The numbered indicators at the top show:
- Current spec: highlighted/active.
- Completed specs: checkmark.
- Locked specs: grayed out with lock icon.

### Step 1: Upload Assets

For each sign spec, you can upload:

Site Photo (Canvas):
1. Click "Upload Site Photo" or drag a photo into the upload area.
2. Use a clear, well-lit photo of the building or location where the sign will go.
3. Straight-on photos work best (avoid extreme angles).
4. The photo appears in the viewer below.

Logo:
1. Click "Upload Logo" or drag the client's logo file.
2. The AI will incorporate this logo into the mockup.
3. High-resolution PNG or SVG files work best. SVG and PDF files are automatically converted to PNG.

Both are optional, but uploading them produces significantly better mockups.

### Step 2: Define the Placement Plane

If you uploaded a site photo, you can tell the AI exactly where to place the sign.

1. Click on the photo to place the first corner point.
2. Click 3 more times to define a 4-point quadrilateral (the area where the sign should go).
3. The 4 points are connected by lines showing the placement area highlighted in blue.
4. Drag any point to adjust its position.
5. Scroll to zoom in/out for precision.
6. Alt+drag to pan around the image.
7. Click "Save Plane" when satisfied.

Tips for good plane placement:
- Place points at the actual corners where you want the sign.
- Make the shape roughly match the sign's proportions.
- Zoom in to get accurate placement on building features.
- The plane can be at an angle (perspective is handled automatically).

Note: For best results, use a straight-on, level photo. Photos taken at an angle can affect dimension estimates — but they'll still work great for generating mockups! These measurements are estimates only.

### Step 3: Reference Measurement (Optional)

After placing 4 points, a "Add Reference Measurement" checkbox appears. This helps the system estimate real-world dimensions.

1. Check the "Add Reference Measurement" checkbox.
2. Click 2 points to draw a reference line over a known dimension in the photo (e.g., across a standard door which is about 80 inches tall, or a window you know is 36 inches wide).
3. Enter the real-world measurement in the input field.
4. Choose the unit: inches or feet. You can toggle between them and the value converts automatically.
5. The system calculates the estimated sign dimensions in feet, inches, and square footage.
6. A green box displays the "Estimated Sign Area" with width x height and square footage.
7. Click "Save Plane" to save the plane along with the reference measurement.

### Step 4: Sign Code Lookup (Exterior Signs Only)

For exterior sign types that have sign code lookup enabled:

1. A "Show Local Sign Code Regulations" toggle appears.
2. When enabled, the AI researches local municipal sign regulations based on the business address.
3. Results appear in the Sign Code section and typically include:
   - Whether a sign permit is required.
   - Maximum sign area allowed.
   - Height restrictions.
   - Illumination rules (what lighting is allowed).
   - Setback distances from property lines and roads.
   - Special zoning notes.
   - Contact information for the local permitting office.
4. This information helps you advise clients about what's legally possible.

### Step 5: Generate Mockups

1. Click the "Generate" button.
2. A loading indicator appears while the AI works (typically 30-90 seconds).
3. The system generates options based on product rules configured by your admin:
   - Good - Budget-friendly option.
   - Better - Mid-range option.
   - Best - Premium option.
4. Some rules may show only 1 or 2 tiers instead of all 3.

What happens behind the scenes:
- If you uploaded a site photo and defined a plane, the AI generates the sign and places it onto your actual photo in the defined area.
- If you uploaded a site photo but no plane, the AI places the sign directly on the building.
- If you didn't upload a photo, the AI generates a complete scene with a realistic building.
- The AI uses your logo, prompt, sign type description, and reference photos from the library.
- If the AI service is busy, it automatically retries up to 4 times with increasing wait times.
- If the primary AI (Gemini) fails, it switches to a backup AI service (OpenAI) automatically.

### Step 6: Review Results

After generation, you see the results for each tier:

Screen Layout per tier:
- Tier label (Good, Better, Best) as a heading.
- Products used listed below the label.
- Two images side by side: "Before" (left) and "After" (right).
- Download button to save the mockup image to your device.
- Project Notes text area below.
- "Polish with AI" button next to the notes.

Reviewing:
- Compare the Before photo with the After mockup to verify placement and appearance.
- Check that the logo is accurately represented.
- Verify the sign style matches the prompt you wrote.

Project Notes:
- Type your notes about this tier option in the text area.
- Notes auto-save as you type (with a 1.5-second delay after you stop typing). A status indicator shows "Saving..." and "Saved" confirmations.
- These notes appear in the PDF proposal.
- Click "Polish with AI" to have the AI rewrite your rough notes into professional proposal text.
- Example: Typing "basic aluminum letters, good for budget" might get polished to "This option features precision-cut aluminum letters with a brushed finish, offering an elegant yet cost-effective signage solution that enhances your storefront presence."

### Downloading Mockup Images

Each generated mockup tier has a download button that saves the AI-generated image directly to your device. Useful for sharing individual mockups via email or messaging before creating a full PDF proposal.

---

## Reference Measurements Tool

Navigate to: Sidebar > Reference Measurements

This is a standalone measurement tool that works independently from opportunities. Use it for quick on-site estimation when you just need rough measurements of an area from a photo.

### How to Use

1. Click the upload area or drag a site photo onto it (JPG, PNG, or WebP).
2. The photo appears in the canvas with drawing tools.
3. Click 4 points clockwise to define the area you want to measure.
4. Drag points to adjust. Scroll to zoom. Alt+drag to pan.
5. Once 4 points are placed, check "Add Reference Measurement".
6. Click 2 points on a known feature (door, window, storefront width).
7. Enter the real-world dimension in inches or feet.
8. The estimated area dimensions and square footage appear immediately.

You can change photos or remove the current one using the buttons above the canvas.

This tool does not save data to any opportunity — it's purely for quick on-the-spot measurements.

---

## Exporting a PDF Proposal

Once you have generated mockups for your sign specs:

1. Click "Export PDF" on the opportunity detail page.
2. The system generates a professional PDF proposal that includes:
   - Company header with your company's logo, name, and contact information.
   - Client information (business name, address, phone, email).
   - "Prepared by" section with your name and contact details.
   - Permit notice (if any exterior sign types require permits).
   - Each sign spec section with tier mockups shown side by side (Before + After).
   - Project notes for each tier.
   - Company footer text.
   - AI disclaimer on every page.
3. The PDF downloads automatically to your computer.
4. You can then email it to the client or print it for an in-person presentation.

---

## Managing Your Opportunities

### Viewing All Opportunities
1. Go to Sidebar > Opportunities.
2. You see a list of all YOUR opportunities (not your teammates').
3. Each card shows the business name, address, sign type, budget, and status color.
4. Click any card to view details.

### Updating Status
On the opportunity detail page, use the status buttons at the top:
- Open (green) - Active opportunity you're working on.
- Won (blue) - Congratulations! Mark it when the deal closes.
- Follow-up (purple) - Client needs follow-up. Use this as a reminder.
- Lost (red) - Mark when the opportunity doesn't close.

Your admin can see these statuses and track overall team performance.

### Editing an Opportunity
1. On the detail page, click the pencil (Edit) icon at the top right.
2. Update any fields in the form.
3. Click "Save".

### Deleting an Opportunity
1. On the detail page, click the trash (Delete) icon at the top right.
2. Confirm the deletion.
3. This permanently removes the opportunity and all its data (mockups, photos, etc.).

---

## Quick Reference: Your Workflow

Here's the typical flow for a new sales engagement:

1. Meet with the client and gather information.
2. Take photos of the building/location with your phone.
3. Get the client's logo file (ask for PNG or SVG if possible).
4. Create a New Opportunity in SignSalesIQ with client details.
5. Add Sign Specs for each sign the client needs.
6. Upload the site photo and logo for each spec.
7. Draw the placement plane on the photo showing where the sign goes.
8. Optionally add a reference measurement for accurate sizing.
9. Write a detailed prompt describing the desired sign style.
10. Click Generate and wait for AI mockups.
11. Review the Before/After results and add project notes.
12. Use "Polish with AI" to make notes professional.
13. Export PDF to create the proposal.
14. Present the proposal to the client.
15. Update the opportunity status as the deal progresses.

---

## Tips for Better Results

1. Take good photos: Well-lit, straight-on photos of the building produce the best mockups. Avoid extreme angles or photos taken in poor lighting.

2. Upload the actual logo file: The AI does a much better job when it has the real logo file rather than trying to create text from the company name.

3. Be specific in your prompt: Instead of "modern sign", write "brushed stainless steel dimensional letters with blue LED halo illumination on the gray stone facade above the main entrance."

4. Use reference measurements: Adding a known dimension (like a door height) helps the AI create properly scaled signs.

5. Define the plane carefully: Take time to place the 4 corner points accurately. The AI will place the sign exactly in this area.

6. Review before exporting: Always check the mockups and polish the project notes before generating the PDF.

7. Add context in notes: Explain WHY each tier option works. Clients appreciate understanding the value difference between Good, Better, and Best.

8. Check sign codes for exterior signs: Use the sign code lookup to advise clients about permits and restrictions before they get surprised later.

9. Update status promptly: Your admin monitors pipeline status. Keep it current so they can help when needed.

10. Save prompts that work well: When you find a prompt that produces great results for a particular sign type, save it for reuse on similar opportunities.

11. Use the Reference Measurements tool: When you're at a site and just need quick dimensions without creating a full opportunity, use the standalone measurement tool from the sidebar.

12. Download individual mockups: Use the download button on each tier's mockup to share individual images via email or text before creating a full proposal.
