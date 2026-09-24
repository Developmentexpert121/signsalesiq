import {
  DIMENSIONAL_SIGN_TYPES,
  GLASS_TREATMENT_TYPES,
  getDefaultRealWorldDims,
  getSignCategory,
} from "../signTaxonomy";
import {
  COMPOSITING_REALISM,
  CONTENT_GUARD,
  QUALITY_BOOST,
  SOURCE_OF_TRUTH,
  TIER_MATERIAL_SPECS,
} from "./constants";
import { sanitize } from "./sanitize";

export interface SignPromptContext {
  tier: string;
  clientName: string;
  signType: string;
  signTypeDescription?: string;
  signTypeAttributes?: string[];
  generationNotes?: string;
  samplePrompt?: string;
  improvementGuidance?: string;
  promptBox?: string | null;
  selectedProducts: string[];
  hasRefs: boolean;
  hasLogo: boolean;
  hasSiteContext: boolean;
  hasBuildingContext: boolean;
  planeWidth: number;
  planeHeight: number;
  estimatedDimensionsInches?: { width: number; height: number } | null;
  straightenToRect: boolean;
  // Render the sign on a flat pure-magenta field (no wall/scene) so it can be chroma-keyed
  // and composited onto the real photo. Used by the surgical-composite path.
  chromaBackground?: boolean;
}

const CHROMA_BACKGROUND_OVERRIDE = `

BACKGROUND OVERRIDE — CRITICAL (supersedes every background/scene instruction above):
Render the physical sign ONLY. Fill EVERY pixel that is not part of the sign itself with a SOLID, FLAT, UNIFORM PURE MAGENTA background — exactly RGB(255, 0, 255) / #FF00FF. This includes the area around the sign AND all open/negative space between and inside the sign elements (gaps between letters, the counters inside letters like O/A/R, spaces between standoff pieces). Do NOT render any wall, ground, sky, floor, gradient, texture, scenery, or drop shadow — the entire background is one flat magenta color with nothing cast onto it.

ABSOLUTELY DO NOT COPY BACKGROUND FROM ANY REFERENCE: the reference images you were given show signs installed at OTHER locations — their walls, brick, stucco, siding, sky, foliage, street, lights, neighboring signs, and any environmental context belong to those other locations and MUST NOT appear in your output. The pixels around the sign are pure flat magenta — never a wall, never a brick texture, never a reference-photo backdrop. The real site background will be inserted underneath later by the compositor; your job is to leave that space transparent (via this magenta key), not to invent or borrow one.

This magenta field will be removed by a chroma key, so keep the sign edges crisp and do NOT use magenta or hot-pink (#FF00FF) anywhere on the sign face itself. CRITICAL for metallic and reflective surfaces: chrome, brushed metal, stainless, and any specular hardware MUST be rendered as neutral silver/gray — do NOT let them reflect or pick up the magenta background. A chrome standoff cap should look like chrome (gray, silver), not purple or pink. Render metallic surfaces as if they are in a neutral-lit studio — their color comes from the metal itself, not from bounced magenta light.`;

// Hoists the most authoritative per-sign-type guidance to the top of the prompt
// (just after SOURCE_OF_TRUTH), so the model sees the construction notes and the
// curated "ideal spec" BEFORE the category template body. The same fields are
// also interpolated mid-body for redundancy — repetition with hierarchy is the
// point.
function buildGroundingHeader(args: {
  signTypeFormatted: string;
  samplePrompt?: string;
  generationNotes?: string;
}): string {
  const lines: string[] = [];
  if (args.generationNotes && args.generationNotes.trim().length > 0) {
    lines.push(
      `CRITICAL CONSTRUCTION NOTES for ${args.signTypeFormatted} (follow exactly — these define the physical build): ${args.generationNotes.trim()}`
    );
  }
  if (args.samplePrompt && args.samplePrompt.trim().length > 0) {
    lines.push(
      `IDEAL SPEC FOR THIS SIGN TYPE (use as the calibration target for what to produce): ${args.samplePrompt.trim()}`
    );
  }
  return lines.length > 0 ? `\n${lines.join("\n\n")}\n` : "";
}

export function buildSignPrompt(ctx: SignPromptContext): string {
  const {
    tier,
    clientName,
    signType,
    signTypeDescription,
    signTypeAttributes,
    generationNotes,
    samplePrompt,
    improvementGuidance,
    promptBox,
    selectedProducts,
    hasRefs,
    hasLogo,
    hasSiteContext,
    planeWidth,
    planeHeight,
    estimatedDimensionsInches,
    straightenToRect,
    chromaBackground,
  } = ctx;

  const safeClientName = sanitize(clientName);
  const safePromptBox = promptBox ? sanitize(promptBox) : null;
  const safeSelectedProducts = selectedProducts.map(sanitize);

  const tierSpec = TIER_MATERIAL_SPECS[tier] || TIER_MATERIAL_SPECS.GOOD;
  const productsDesc =
    safeSelectedProducts.length > 0
      ? `Products for this tier: ${safeSelectedProducts.join(", ")}.`
      : "";

  const signTypeFormatted = signType.replace(/_/g, " ").toLowerCase();
  let cleanedDescription = signTypeDescription || "";
  cleanedDescription = cleanedDescription
    .replace(/\[Logo Image\]/gi, "the client's logo")
    .replace(/\[Space Photo\]/gi, "the site/building photo")
    .replace(/\[Logo\]/gi, "the client's logo")
    .replace(/\[Image\]/gi, "the provided image")
    .replace(/^Prompt:\s*/i, "")
    .trim();
  const signDetail = cleanedDescription ? `\n${cleanedDescription}` : "";
  const attrsDesc =
    signTypeAttributes && signTypeAttributes.length > 0
      ? `\nAvailable finishes/options for this sign type: ${signTypeAttributes.join(", ")}.`
      : "";

  const aspectRatio = planeWidth / planeHeight;
  const aspectDesc =
    aspectRatio > 2
      ? "wide/horizontal banner"
      : aspectRatio > 1.2
        ? "landscape/horizontal"
        : aspectRatio > 0.8
          ? "roughly square"
          : "portrait/vertical";

  // Physical-size anchor. Use the user's measured dimensions when available; otherwise fall
  // back to a typical size for this sign type so the model still has a scale reference —
  // output quality drops noticeably when no physical size is given at all.
  const sizeDims =
    estimatedDimensionsInches ?? getDefaultRealWorldDims(signType, planeWidth, planeHeight);
  const realSizeNote = estimatedDimensionsInches
    ? `\nREAL-WORLD SIZE: The sign area is approximately ${Math.round(sizeDims.width)}" wide × ${Math.round(sizeDims.height)}" tall (${(sizeDims.width / 12).toFixed(1)}' × ${(sizeDims.height / 12).toFixed(1)}'). Scale all text, logos, and design elements appropriately for this physical size — ensure text is legible at typical viewing distance and proportions match real signage of this size.`
    : `\nREAL-WORLD SIZE (estimated): No exact measurement was provided, so assume a typical size for this sign type — roughly ${Math.round(sizeDims.width)}" wide × ${Math.round(sizeDims.height)}" tall (${(sizeDims.width / 12).toFixed(1)}' × ${(sizeDims.height / 12).toFixed(1)}'). Scale text, logos, and design elements to realistic proportions for signage of about this size.`;

  const generationGuide = generationNotes
    ? `\nCRITICAL CONSTRUCTION NOTES (follow exactly): ${generationNotes}`
    : "";
  const improvementGuide = improvementGuidance
    ? `\nKNOWN ISSUES TO CORRECT (from previous reviewer feedback — actively fix these): ${improvementGuidance}`
    : "";
  const hasUserDesignBrief = !!safePromptBox && safePromptBox.trim().length > 0;
  const signCategory = getSignCategory(signType);
  const isDimensional = DIMENSIONAL_SIGN_TYPES.has(signType);
  const isGlassTreatment = GLASS_TREATMENT_TYPES.has(signType);

  const perspectiveNote = straightenToRect
    ? "Render straight-on, front-facing with no perspective distortion — this will be composited as a flat rectangle."
    : "";

  let prompt: string;

  if (isGlassTreatment) {
    const isPrivacyFilm = signType === "PRIVACY_FILM";
    prompt = `Generate a photorealistic image of glass ${isPrivacyFilm ? "with dense frosted privacy film applied" : `with ${signTypeFormatted} applied`}. The image fills the entire frame edge-to-edge — every pixel shows the glass surface with the treatment applied.
${hasSiteContext ? "\nThe attached [SITE WALL SURFACE] shows the glass area for lighting/color reference. Match the lighting and reflections." : ""}

${isPrivacyFilm ? `The frosted film is a DENSE, clearly visible, semi-opaque frost covering the glass — it should substantially obscure what is behind the glass (around 70-80% opacity). The frost color must be NEUTRAL GRAYSCALE — white, silver, or light gray only. Never yellow, gold, warm-tinted, or colored. The frost is NOT subtle or barely visible — it is a thick, obvious frosted coating.` : ""}
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}${realSizeNote}
${hasLogo ? `The attached client logo should be ${isPrivacyFilm ? "knocked out (cut out) of the frost film as a clear glass area — the logo shape is transparent/see-through while everything around it is frosted" : "prominently displayed on the glass treatment"}.` : hasUserDesignBrief ? `Use only the text and content specified in the client design direction below — do not display the company name.` : `Display "${safeClientName}" text ${isPrivacyFilm ? "knocked out of the frost as clear glass lettering" : "on the glass"}.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Photorealistic quality — like a real photograph of treated glass.`;
  } else if (hasSiteContext && signCategory === "channel_letters") {
    const isHalo = signType === "CHANNEL_LETTERS_BACK_LIT_HALO";
    prompt = `Generate a photorealistic photograph of ${isHalo ? "halo/back-lit" : "front-lit"} channel letter signs mounted on the wall surface shown in the attached [SITE WALL SURFACE] photo.

CONSTRUCTION — CRITICAL:
Each letter is an individual self-contained illuminated cabinet: an aluminum return (side wall), a painted face, LED modules inside, and a back plate. Letters are mounted individually to the wall or on a raceway, not backed by any panel. ${isHalo ? "Back-lit halo effect: LEDs shine backward, creating a glow halo between the letter back and the wall. Letter faces appear dark/opaque. Wall shows warm halo glow behind each letter." : "Front-lit: letter faces are translucent colored acrylic lit from inside by LEDs. Letter returns are aluminum."}

ABSOLUTE PROHIBITIONS:
- NO background panel, substrate, backing plate, or board behind the letters
- NO flat acrylic sign panel or rectangular surface
- ${isHalo ? "NO glowing letter faces — halo only" : "NO non-illuminated letter faces — they must glow from within"}

THE WALL IS THE ONLY BACKGROUND between and around letters.
${perspectiveNote ? `- ${perspectiveNote}` : ""}

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}${realSizeNote}
${hasLogo ? "Reproduce the attached logo exactly — render each letter/element as a separate illuminated channel letter cabinet." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" as individual illuminated channel letters mounted on the wall.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Photorealistic quality — like a real photograph.`;
  } else if (hasSiteContext && signCategory === "standoff_dimensional") {
    prompt = `Generate a photorealistic photograph of dimensional standoff letters/logo mounted directly on the wall surface shown in the attached [SITE WALL SURFACE] photo.

CONSTRUCTION — CRITICAL:
Each letter and logo element is an individual 3D fabricated piece (${tierSpec.materials.includes("stainless") ? "stainless steel or brushed metal" : "painted aluminum or acrylic"}) approximately 1–2 inches thick. Every piece is mounted on standoffs, sitting ~¾–1 inch proud of the wall. Visible edge depth on all elements. Each piece casts a soft natural shadow on the wall directly behind it.

ABSOLUTE PROHIBITIONS — the model must never include any of the following:
- NO background panel, substrate, backing plate, foam board, Dibond panel, or any rectangular board behind the letters/logo
- NO white, gray, or colored box, rectangle, or surface mounted to the wall as a backing for the sign
- NO acrylic panel, aluminum panel, or any flat sign substrate of any kind
- NO shadowbox, frame, cabinet, or enclosure around the letters
- The logo image provided may have a white or colored background — COMPLETELY IGNORE AND OMIT any background from the logo artwork. Extract ONLY the shapes, text, and icon elements and render each as a separate 3D dimensional piece.

THE WALL IS THE ONLY BACKGROUND. Every area of the wall not occupied by a dimensional letter or logo element shows the original wall texture/color from the site photo, with nothing mounted on it.

Key rules:
- Preserve the wall surface from the site photo exactly — same color, texture, lighting.
- Sign elements centered on the wall, filling ~70% of the image width — large and prominent.
${perspectiveNote ? `- ${perspectiveNote}` : ""}

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}${realSizeNote}
${hasLogo ? "The attached logo must be reproduced exactly in colors, proportions, and design — but render each element (icon, text, shapes) as a separate physical 3D dimensional object mounted on the wall. Strip any background from the logo completely — only the dimensional elements appear." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" as large dimensional letters mounted directly on the wall.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Photorealistic quality — like a real photograph.`;
  } else if (hasSiteContext && signCategory === "light_box") {
    prompt = `Generate a photorealistic photograph of an illuminated light box sign mounted on the wall surface shown in the attached [SITE WALL SURFACE] photo.

CONSTRUCTION — CRITICAL:
A light box is a rectangular aluminum cabinet with a translucent graphic face (acrylic face panel) internally illuminated by LED modules. The cabinet has visible depth (4–6 inches) with aluminum returns on all sides. The face glows evenly with the graphic/text printed on it.

Key construction details:
- Rectangular cabinet flush-mounted or projected from the wall
- Translucent face panel glowing uniformly from internal LEDs
- Aluminum frame/returns visible on sides
- The cabinet IS the sign — it is NOT dimensional letters
${perspectiveNote ? `- ${perspectiveNote}` : ""}

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}${realSizeNote}
${hasLogo ? "The attached logo must be reproduced exactly on the illuminated translucent face of the light box cabinet." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" on the glowing face of the light box cabinet.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Photorealistic quality — like a real photograph.`;
  } else if (hasSiteContext && signCategory === "awning") {
    prompt = `Generate a photorealistic photograph of a commercial awning sign installed on the building shown in the attached [SITE WALL SURFACE] photo.

CONSTRUCTION — CRITICAL:
An awning is a fabric or metal canopy structure that projects outward from a building's storefront or entrance. It has a sloped or rounded profile, metal frame, and fabric or metal cladding. Signage/branding is printed or applied directly to the awning fabric/surface.

Key construction details:
- Projects outward from the building facade at an angle
- Visible frame structure and fabric/metal covering
- Branding printed/applied on the sloped face and/or front valance
- NOT wall-mounted letters — it is a structural canopy element
${perspectiveNote ? `- ${perspectiveNote}` : ""}

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}${realSizeNote}
${hasLogo ? "The attached logo must be reproduced exactly on the awning surface." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" branding prominently on the awning.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Photorealistic quality — like a real photograph.`;
  } else if (hasSiteContext && signCategory === "monument") {
    prompt = `Generate a photorealistic photograph of a monument sign installed near the building shown in the attached [SITE WALL SURFACE] photo.

CONSTRUCTION — CRITICAL:
A monument sign is a low, ground-mounted freestanding identification sign at a building entrance or property boundary. It sits directly on the ground or a short base/planter. Typical construction: masonry, aluminum, or fabricated cabinet with an illuminated or non-illuminated face panel displaying the building/business name.

Key construction details:
- Ground-mounted, freestanding — NOT wall-mounted
- Low profile: typically 4–8 feet tall
- Solid base structure (masonry, aluminum cabinet, or brick)
- Sign face panel with branding, often internally illuminated
- Placed at driveway entrance or building frontage
${perspectiveNote ? `- ${perspectiveNote}` : ""}

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}${realSizeNote}
${hasLogo ? "The attached logo must be reproduced exactly on the monument sign face." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" prominently on the monument sign face.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Photorealistic quality — like a real photograph.`;
  } else if (hasSiteContext && signCategory === "pylon") {
    prompt = `Generate a photorealistic photograph of a pylon sign installed near the building shown in the attached [SITE WALL SURFACE] photo.

CONSTRUCTION — CRITICAL:
A pylon sign is a tall, freestanding pole-mounted or multi-post sign elevated high off the ground for visibility from a distance (roads, parking lots). The sign cabinet is mounted at the top of one or two poles. It is NOT wall-mounted — it stands independently.

Key construction details:
- Tall vertical pole(s) anchored in the ground
- Illuminated sign cabinet elevated at the top (typically 10–25 feet high)
- Cabinet has a translucent face panel with graphic/branding lit from inside
- Highly visible from roadways and parking areas
${perspectiveNote ? `- ${perspectiveNote}` : ""}

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}${realSizeNote}
${hasLogo ? "The attached logo must be reproduced exactly on the elevated pylon sign cabinet face." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" on the illuminated pylon sign cabinet.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Photorealistic quality — like a real photograph.`;
  } else if (hasSiteContext && signCategory === "blade_sign") {
    prompt = `Generate a photorealistic photograph of a blade sign (projecting sign) mounted on the building shown in the attached [SITE WALL SURFACE] photo.

CONSTRUCTION — CRITICAL:
A blade sign projects perpendicularly outward from the building fascia, so it is readable from both sides when walking along the sidewalk. It is double-faced (both sides display the graphic). Typically an aluminum cabinet or flat panel bracket-mounted to the wall face.

Key construction details:
- Mounted perpendicular to the building wall face (projects outward)
- Visible from both the left and right (double-faced)
- Flat or cabinet-style sign panel with graphic on both sides
- Bracket/arm hardware visible connecting it to the wall
${perspectiveNote ? `- ${perspectiveNote}` : ""}

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}${realSizeNote}
${hasLogo ? "The attached logo must be reproduced exactly on the visible face(s) of the blade sign." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" on the projecting blade sign.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Photorealistic quality — like a real photograph.`;
  } else if (hasSiteContext && signCategory === "acrylic_standoff") {
    prompt = `Generate a photorealistic photograph of an acrylic sign with standoff hardware mounted on the wall surface shown in the attached [SITE WALL SURFACE] photo.

CONSTRUCTION — CRITICAL:
An acrylic standoff sign is a flat acrylic panel (typically clear, frosted, or colored acrylic) mounted on visible chrome or brushed metal standoff hardware — circular barrel bolts at each corner that hold the panel away from the wall surface. The wall is visible behind and around the panel through the gap created by the standoffs.

Key construction details:
- Flat acrylic panel (NOT dimensional letters)
- Four or more visible chrome/brushed metal standoff caps at the corners/edges
- Panel floats ~¾–1 inch off the wall — wall texture visible behind panel
- Graphics/text printed on the face or second surface of the acrylic
${perspectiveNote ? `- ${perspectiveNote}` : ""}

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}${realSizeNote}
${hasLogo ? "The attached logo must be reproduced exactly on the acrylic panel face." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" on the acrylic panel with visible standoff hardware.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Photorealistic quality — like a real photograph.`;
  } else if (hasSiteContext && signCategory === "menu_board") {
    const isEMC = signType === "EMC_ELECTRONIC_MESSAGE_BOARD";
    prompt = `Generate a photorealistic photograph of a ${isEMC ? "LED electronic message center (EMC) display" : "menu board sign system"} installed on the building shown in the attached [SITE WALL SURFACE] photo.

CONSTRUCTION — CRITICAL:
${isEMC ? "An electronic message center (EMC) is a programmable LED display panel in an aluminum cabinet frame, mounted on a wall or pylon. The display surface shows scrolling or static LED text/graphics in full color or amber/red." : "A menu board system is an array of flat display panels (static printed graphics or digital screens) arranged in a grid, typically used in quick-service restaurants and food service environments. The panels are mounted in aluminum extrusion frames."}

Key construction details:
- Flat-panel display system — NOT dimensional letters
- Cabinet/frame construction with visible panel borders
- ${isEMC ? "Bright LED pixel matrix display surface" : "Multiple menu panels arranged in rows/columns"}
- Wall-mounted or integrated into a sign structure
${perspectiveNote ? `- ${perspectiveNote}` : ""}

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}${realSizeNote}
${hasLogo ? "The attached logo must be reproduced exactly on the display." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" content on the ${isEMC ? "LED display" : "menu board panels"}.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Photorealistic quality — like a real photograph.`;
  } else if (hasSiteContext && signCategory === "flat_applied") {
    prompt = `Generate a photorealistic photograph of flat applied vinyl/print graphics on the surface shown in the attached [SITE WALL SURFACE] photo.

CONSTRUCTION — CRITICAL:
Flat applied graphics are adhesive vinyl or printed material applied directly and flush to a wall or floor surface. There is zero depth — no standoffs, no cabinet, no frame, no substrate panel. The graphic is adhered directly onto the existing surface.

Key construction details:
- Graphics lie completely flat, flush with the surface
- No raised elements, no depth, no hardware
- Surface texture of the wall/floor shows through semi-transparent areas
- Edges of vinyl may show slight detail at very close range
${perspectiveNote ? `- ${perspectiveNote}` : ""}

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}${realSizeNote}
${hasLogo ? "The attached logo must be reproduced exactly as flat applied vinyl on the surface." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" as flat vinyl graphics applied directly to the surface.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Photorealistic quality — like a real photograph.`;
  } else if (hasSiteContext && signCategory === "vehicle") {
    const isWrap = signType === "VEHICLE_WRAP_FULL" || signType === "VEHICLE_WRAP_PARTIAL";
    const isMagnetic = signType === "MAGNETIC_SIGNS";
    prompt = `Generate a photorealistic photograph of ${isWrap ? "vehicle wrap graphics" : isMagnetic ? "magnetic vehicle signs" : "vehicle lettering and graphics"} applied to a vehicle. The attached [SITE WALL SURFACE] photo shows a reference vehicle or context — if it shows a vehicle, apply the graphics to it; otherwise generate a realistic commercial vehicle (white box truck, van, or pickup) with the graphics applied.

CONSTRUCTION — CRITICAL:
${isWrap ? "A full or partial vehicle wrap uses printed vinyl film covering large portions of the vehicle surface. The wrap follows body contours, window cutouts, door seams, and panel lines. Graphics extend across multiple body panels seamlessly." : isMagnetic ? "Magnetic signs are flat printed panels with a magnetic backing, placed flat on vehicle door panels. They lay perfectly flat on the door surface and can be removed — they do NOT wrap around edges or contours." : "Vehicle lettering uses cut vinyl letters, numbers, and logo shapes applied directly to the vehicle painted surface. Individual cut pieces follow the vehicle's curves and body lines. This is NOT a full wrap — vehicle body color is visible between graphic elements."}

Key details:
- Graphics are professionally applied — no bubbles, lifting edges, or imperfections
- ${isWrap ? "Wrap graphics wrap around body panels, door edges, and contours" : isMagnetic ? "Magnetic panels lie flat on door surfaces, visible door handle and panel lines" : "Cut vinyl letters/graphics follow the vehicle's curves and surface contours"}
- Vehicle must be shown in a realistic environment (parking lot, street, facility exterior)
- Full vehicle visible — not cropped off at edges

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}${realSizeNote}
${hasLogo ? "The attached logo must be reproduced exactly on the vehicle graphics." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" as professional vehicle graphics — company name prominently on the door or side panel.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Realistic commercial vehicle with professional graphics. Photorealistic quality.`;
  } else if (hasSiteContext && signCategory === "flag_sign") {
    const isFeather = signType === "FEATHER_FLAG";
    const isPole = signType === "POLE_BANNERS";
    prompt = `Generate a photorealistic photograph of a ${isFeather ? "feather/teardrop flag" : isPole ? "pole banner" : "flag sign"} installed outdoors near a building entrance. The attached [SITE WALL SURFACE] photo shows the building or site — use it as the background environment.

CONSTRUCTION — CRITICAL:
${isFeather ? "A feather flag (flutter flag / teardrop flag) is a tall, narrow fabric flag on a flexible fiberglass or aluminum segmented pole. The fabric is dye-sublimation printed polyester that billows and curves naturally in the breeze. The pole curves at the top creating the characteristic feather/teardrop silhouette." : isPole ? "A pole banner is a wide rectangular fabric panel mounted between two bracket arms extending from a vertical pole. Typically mounted on light poles or dedicated poles in pairs." : "A decorative flag sign on a pole or bracket, mounted outdoors near a building entrance."}

CRITICAL PLACEMENT & SCALE — NON-NEGOTIABLE:
- The flag stands BESIDE the building, NOT in front of it covering the facade. The building MUST remain clearly visible behind and around the flag.
- Place the pole/base on the ground (sidewalk, grass, or paved area) in the FOREGROUND, off-center (left or right third of the frame).
- ${isFeather ? "Feather/teardrop shape: tall narrow silhouette, pole height 10–14 feet. Fabric billows naturally." : isPole ? "Rectangular panels mounted perpendicular to the pole, pole height 12–16 feet." : "Flag fully visible, pole height 8–12 feet."}
- Flag occupies approximately 30–50% of image height — NOT more. The complete flag (base spike to top tip) must be fully inside the frame, not cropped.
- The flag itself must NEVER be taller than the building behind it. DO NOT scale the flag up to fill the frame.
- Ground stake/cross-base or pole mount clearly visible at the bottom. Pole casts a natural shadow on the ground matching scene lighting.

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}${realSizeNote}
${hasLogo ? "The attached logo must be reproduced exactly on the flag fabric — high-quality dye-sublimation print quality. Use ONLY the attached logo. Do NOT invent or add any other character, mascot, illustration, or graphic." : hasUserDesignBrief ? "Use ONLY the text/content specified in the client design direction below — do not invent additional graphics, characters, or mascots, and do not display the company name unless the brief asks for it." : `Display the text "${clientName}" prominently on the flag fabric in clean professional bold typography. TEXT ONLY — do NOT add any character, mascot, animal, ghost, robot, person, illustration, or decorative graphic of any kind.`}
${hasUserDesignBrief ? `\nClient design direction: ${promptBox}` : ""}
Tier: ${tier} — ${tierSpec.description}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Full flag visible from base to tip. Photorealistic quality.`;
  } else if (hasSiteContext && signCategory === "ada_sign") {
    prompt = `Generate a photorealistic photograph of ADA-compliant interior identification signs installed on the wall shown in the attached [SITE WALL SURFACE] photo.

CONSTRUCTION — CRITICAL:
ADA (Americans with Disabilities Act) compliant signs are interior identification signs featuring:
- Matte finish non-glare substrate (acrylic, aluminum, or composite) — absolutely no glare or specular reflection
- Raised tactile text copy (letters and numbers raised from the surface)
- Grade 2 Braille below the tactile text
- High contrast color combinations (white on dark, or dark on white/light)
- Clean, institutional or corporate aesthetic — professional and authoritative
- Mounted at 60" AFF (to sign centerline) on the latch side of the door

Key details:
- Clean, flat panel with clear tactile hierarchy
- Sign is properly sized for door identification (typically 6"×8" to 8"×12")
- Shown in context with appropriate wall and door environment

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}${realSizeNote}
${hasLogo ? "The attached logo must be reproduced on the ADA sign face in appropriate scale." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" on the ADA sign panel with tactile raised letters and Braille below.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Sign clearly visible and properly mounted. Photorealistic quality.`;
  } else if (hasSiteContext) {
    prompt = `Generate a photorealistic ${signTypeFormatted} sign face that will be composited onto a building photo. The attached [SITE WALL SURFACE] shows the installation area for lighting/color reference.

Key rules:
- The sign must fill 100% of the image edge-to-edge — every pixel is part of the sign. No empty margins, no background visible.
- Match lighting and color temperature from the site photo for natural integration.
${perspectiveNote ? `- ${perspectiveNote}` : ""}

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}${realSizeNote}
${hasLogo ? "The attached logo must be reproduced exactly — same design, colors, proportions. Make it the primary element, large and centered." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" as large centered text with professional signage typography.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Photorealistic quality — like a real photograph.`;
  } else if (signCategory === "channel_letters") {
    const isHalo = signType === "CHANNEL_LETTERS_BACK_LIT_HALO";
    prompt = `Generate a photorealistic photograph of ${isHalo ? "halo/back-lit" : "front-lit"} channel letter signs on a plain light gray wall. Flat front-facing view, no perspective — this will be composited onto a site photo.

CONSTRUCTION — CRITICAL:
Each letter is an individual illuminated cabinet (aluminum return + ${isHalo ? "opaque face, LEDs shine backward creating halo glow on the wall behind each letter" : "translucent colored acrylic face lit from inside by LEDs"}). Letters are mounted individually on the wall.

ABSOLUTE PROHIBITIONS:
- NO background panel or substrate behind the letters
- NO flat sign panel of any kind
${perspectiveNote ? `- ${perspectiveNote}` : ""}

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "Reproduce the attached logo exactly — render each element as an individual illuminated channel letter cabinet." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" as individual illuminated channel letters.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Sign elements fill ~75% of image width. Plain neutral wall background. Photorealistic quality.`;
  } else if (signCategory === "standoff_dimensional") {
    prompt = `Generate a photorealistic photograph of dimensional letters/logo mounted on a plain light gray wall. Flat front-facing view, no perspective — this will be composited onto a site photo.

CONSTRUCTION — CRITICAL:
Each letter and logo element is an individual 3D fabricated piece approximately 1–2 inches thick, mounted on standoffs sitting ~¾–1 inch off the wall. Visible edge depth and soft natural drop shadows on the wall behind each piece.

ABSOLUTE PROHIBITIONS:
- NO background panel, substrate, backing plate, foam board, Dibond panel, or rectangular board behind the letters/logo
- NO white, gray, or colored box, rectangle, or surface as a backing for the sign
- NO acrylic panel, aluminum panel, or any flat sign substrate of any kind
- If a logo image is provided, it may have a white or colored background — COMPLETELY IGNORE AND OMIT the logo background. Render ONLY the shapes, icon, and text as 3D dimensional pieces.

THE PLAIN GRAY WALL IS THE ONLY BACKGROUND. No substrate between the letters and the wall.

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly in colors, proportions, and design — but render each element (icon, text, shapes) as a separate physical 3D dimensional object. Strip any logo background completely." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" as large centered dimensional letters.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Sign elements fill ~75% of image width. Plain neutral wall background. Photorealistic quality.`;
  } else if (signCategory === "light_box") {
    prompt = `Generate a photorealistic photograph of an illuminated light box sign face. Flat front-facing view, no perspective — this will be composited onto a site photo.

CONSTRUCTION — CRITICAL:
A light box is a rectangular aluminum cabinet with a translucent graphic face internally illuminated by LED modules. The face glows evenly with the graphic/text displayed on it. The cabinet has visible depth with aluminum sides.

Key construction details:
- Rectangular illuminated cabinet — the cabinet IS the sign
- Translucent face panel glowing uniformly
- Aluminum frame/returns visible on sides
- NOT dimensional letters

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly on the glowing translucent face of the light box." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" on the illuminated face of the light box cabinet.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Sign fills image. Plain neutral background. Photorealistic quality.`;
  } else if (signCategory === "awning") {
    prompt = `Generate a photorealistic photograph of a commercial awning sign face. Flat front-facing view — this will be composited onto a building photo.

CONSTRUCTION — CRITICAL:
An awning is a fabric or metal canopy structure projecting outward from a building storefront. Branding is printed or applied on the awning surface. NOT wall-mounted letters — it is a structural canopy element with a sloped or rounded profile.

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly on the awning surface." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" branding on the awning canopy.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Photorealistic quality.`;
  } else if (signCategory === "monument") {
    prompt = `Generate a photorealistic photograph of a ground-mounted monument sign on a neutral outdoor background — this will be composited onto a site photo.

CONSTRUCTION — CRITICAL:
A monument sign is a low, ground-mounted freestanding identification sign (typically 4–8 feet tall) with a solid base structure (masonry, aluminum, or fabricated cabinet). The sign face displays the building/business name and is often internally illuminated. It is NOT wall-mounted — it stands independently on the ground.

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly on the monument sign face." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" prominently on the monument sign face.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Sign centered in frame with natural outdoor ground/landscape context. Photorealistic quality.`;
  } else if (signCategory === "pylon") {
    prompt = `Generate a photorealistic photograph of a tall pole-mounted pylon sign on a neutral outdoor background — this will be composited onto a site photo.

CONSTRUCTION — CRITICAL:
A pylon sign is a tall freestanding pole-mounted sign (typically 10–25 feet high) with an illuminated cabinet at the top, elevated for visibility from roads and parking lots. One or two vertical poles anchor it in the ground. It is NOT wall-mounted — it stands independently.

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly on the elevated pylon sign cabinet." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" on the illuminated pylon cabinet.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Full sign visible with pole extending to ground. Photorealistic quality.`;
  } else if (signCategory === "blade_sign") {
    prompt = `Generate a photorealistic photograph of a projecting blade sign on a plain neutral background — this will be composited onto a building photo.

CONSTRUCTION — CRITICAL:
A blade sign projects perpendicularly from a building wall, double-faced, readable from both sides while walking along the sidewalk. Aluminum cabinet or flat panel with bracket hardware.

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly on the visible face(s) of the blade sign." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" on the projecting blade sign.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Photorealistic quality.`;
  } else if (signCategory === "acrylic_standoff") {
    prompt = `Generate a photorealistic close-up image of an acrylic panel with standoff hardware. The acrylic panel MUST fill the ENTIRE image edge-to-edge — every pixel of the image is the panel face. No wall, no background, no space around the panel. This image will be composited onto a site photo; the wall behind the panel is supplied by the compositor, not by you.

CONSTRUCTION — CRITICAL:
A flat acrylic panel (clear, frosted, or colored acrylic) with visible chrome or brushed metal standoff caps at each corner. The standoff caps are circular barrel bolts, inset near the panel corners, flush against the panel face. Chrome/brushed-metal standoffs MUST be rendered as neutral silver/gray — do NOT tint them pink, purple, or warm.

Key details:
- The acrylic panel covers 100% of the image — edge to edge, top to bottom
- Four standoff caps visible at or near the corners, on the panel face
- Panel surface: frosted, clear, or lightly tinted acrylic — slight translucency is acceptable
- Graphics/text on the panel face are crisp and legible
- NO wall behind the panel, NO background, NO gap visible — panel fills the frame completely

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly on the acrylic panel face." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" on the flat acrylic panel with visible standoff hardware.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Panel fills every pixel. No background. Photorealistic quality.`;
  } else if (signCategory === "menu_board") {
    const isEMC = signType === "EMC_ELECTRONIC_MESSAGE_BOARD";
    prompt = `Generate a photorealistic photograph of a ${isEMC ? "LED electronic message center (EMC)" : "menu board display system"} face, filling the entire image edge-to-edge. Flat front-facing view.

CONSTRUCTION — CRITICAL:
${isEMC ? "An electronic message center is a programmable LED pixel display panel in an aluminum cabinet, showing scrolling or static LED text/graphics." : "A menu board system is a flat-panel display array (static or digital) mounted in aluminum extrusion frames, arranged in rows/columns for food service environments."}

Key details:
- Flat panel display system — NOT dimensional letters
- Cabinet/frame construction
- ${isEMC ? "LED pixel matrix display surface" : "Multiple display panels in aluminum frames"}

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly on the display panel." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" content on the ${isEMC ? "LED display" : "menu board panels"}.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Sign fills image edge-to-edge. Photorealistic quality.`;
  } else if (signCategory === "flat_applied") {
    prompt = `Generate a photorealistic ${signTypeFormatted} graphic applied flat to a neutral light surface, filling the image edge-to-edge. Flat front-facing view.

CONSTRUCTION — CRITICAL:
Flat adhesive vinyl or printed material applied directly and flush to the surface. Zero depth — no standoffs, no cabinet, no frame, no substrate. The graphic adheres directly to the surface with no raised elements.

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly as flat applied vinyl." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" as flat vinyl graphics.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Graphics fill image edge-to-edge. Photorealistic quality.`;
  } else if (signCategory === "vehicle") {
    const isWrap = signType === "VEHICLE_WRAP_FULL" || signType === "VEHICLE_WRAP_PARTIAL";
    const isMagnetic = signType === "MAGNETIC_SIGNS";
    prompt = `Generate a photorealistic photograph of ${isWrap ? "vehicle wrap graphics" : isMagnetic ? "magnetic vehicle signs" : "vehicle lettering and graphics"} applied to a realistic commercial vehicle. Show a white or light-colored commercial vehicle (van, pickup truck, or box truck) with professional graphics applied.

CONSTRUCTION — CRITICAL:
${isWrap ? "A full or partial vehicle wrap uses printed vinyl film covering large portions of the vehicle surface. The wrap follows body contours, window cutouts, door seams, and panel lines with seamless coverage." : isMagnetic ? "Magnetic signs are flat printed panels placed on vehicle door panels. They lay perfectly flat, do NOT wrap edges, and the panel edges may show slight lift. Vehicle door handle and panel lines remain visible." : "Vehicle lettering uses precision-cut vinyl letters, numbers, and logo graphics applied to the vehicle's painted surface. Individual cut pieces follow curves and body lines naturally. Vehicle body color shows between graphic elements."}

Key details:
- Vehicle shown from a 3/4 front angle or direct side view — full vehicle visible in frame
- Graphics professionally applied — clean, no bubbles or imperfections
- Realistic environment setting (commercial parking lot or building exterior)
- ALL graphic elements completely within the image — nothing cropped off

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly on the vehicle graphics — maintain exact colors, proportions, and design." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" as professional vehicle graphics — company name prominently on the door/side panel with contact info below.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Full vehicle with graphics visible. Photorealistic quality.`;
  } else if (signCategory === "flag_sign") {
    const isFeather = signType === "FEATHER_FLAG";
    const isPole = signType === "POLE_BANNERS";
    prompt = `Generate a photorealistic photograph of a ${isFeather ? "feather/teardrop flag" : isPole ? "pole banner" : "flag sign"} with professional graphics. Show the flag in a realistic outdoor setting.

CONSTRUCTION — CRITICAL:
${isFeather ? "A feather flag (flutter flag / teardrop flag) is a tall, narrow fabric flag on a flexible fiberglass or aluminum segmented pole. The fabric is dye-sublimation printed polyester that billows and curves naturally. The pole curves at the top, creating the characteristic feather/teardrop silhouette." : isPole ? "A pole banner is a wide rectangular fabric panel mounted between two bracket arms on a vertical pole. Often installed on street poles or dedicated signage poles." : "A decorative flag sign on a pole or bracket mount, shown outdoors."}

CRITICAL — FRAMING REQUIREMENTS:
- The ENTIRE flag must be FULLY VISIBLE within the image — from the ground spike/cross-base at the bottom to the very tip at the top
- Do NOT crop the top of the flag — the full curved teardrop/feather shape must be completely in frame
- Leave enough headroom above the flag tip so nothing is cut off
- Flag should occupy approximately 60–80% of the image height — scaled to be clearly readable

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly on the flag fabric — high-quality dye-sublimation print quality with vivid colors." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" prominently on the flag fabric with professional bold typography and attractive color design.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Full flag visible from base to tip — NOT cropped. Photorealistic quality.`;
  } else if (signCategory === "ada_sign") {
    prompt = `Generate a photorealistic photograph of an ADA-compliant interior identification sign panel. Flat front-facing view on a plain neutral wall background — this will be composited onto a site photo.

CONSTRUCTION — CRITICAL:
ADA (Americans with Disabilities Act) compliant signs are interior identification signs with these required features:
- Matte finish, non-glare substrate (acrylic, aluminum, or composite board) — absolutely NO glare or sheen
- Raised tactile copy — letters and numbers physically raised ~1/32" from the surface
- Grade 2 Braille below the tactile text in appropriate size
- High-contrast color combinations: white copy on dark field, or dark copy on white/light field
- Clean, authoritative institutional/corporate aesthetic

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced on the ADA sign face at appropriate scale — clean, legible." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" on the ADA sign panel with raised tactile letters and Braille below.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). ADA sign centered on plain neutral wall. Photorealistic quality.`;
  } else {
    prompt = `Generate a photorealistic ${signTypeFormatted} sign face filling the entire image edge-to-edge — every pixel is part of the sign, no margins, no background. Flat front-facing view, no perspective.

Sign: ${signTypeFormatted} for "${safeClientName}"
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly — same design, colors, proportions. Make it the primary element, large and centered." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" as large centered text with professional signage typography.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}
Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Output: ${aspectDesc} (${planeWidth}×${planeHeight}px). Photorealistic quality — like a real photograph.`;
  }

  const groundingHeader = buildGroundingHeader({
    signTypeFormatted,
    samplePrompt,
    generationNotes,
  });
  prompt = SOURCE_OF_TRUTH + groundingHeader + prompt;
  prompt += QUALITY_BOOST;
  if (hasSiteContext) {
    prompt += COMPOSITING_REALISM;
  }
  prompt += CONTENT_GUARD;
  if (chromaBackground) {
    prompt += CHROMA_BACKGROUND_OVERRIDE;
  }

  return prompt;
}

// Re-export so generateSignImage's logger statement can stay consistent.
export function isDimensionalSign(signType: string): boolean {
  return DIMENSIONAL_SIGN_TYPES.has(signType);
}
