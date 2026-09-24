import { GLASS_TREATMENT_TYPES, getSignCategory } from "../signTaxonomy";
import {
  COMPOSITING_REALISM,
  CONTENT_GUARD,
  QUALITY_BOOST,
  SOURCE_OF_TRUTH,
  TIER_MATERIAL_SPECS,
} from "./constants";
import { sanitize } from "./sanitize";

export interface FullScenePromptContext {
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
  hasSitePhoto: boolean;
}

export function buildFullScenePromptAssembled(ctx: FullScenePromptContext): string {
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
    hasSitePhoto,
  } = ctx;

  const groundingLines: string[] = [];
  if (generationNotes && generationNotes.trim().length > 0) {
    groundingLines.push(
      `CRITICAL CONSTRUCTION NOTES for ${signType.replace(/_/g, " ").toLowerCase()} (follow exactly — these define the physical build): ${generationNotes.trim()}`
    );
  }
  if (samplePrompt && samplePrompt.trim().length > 0) {
    groundingLines.push(
      `IDEAL SPEC FOR THIS SIGN TYPE (use as the calibration target for what to produce): ${samplePrompt.trim()}`
    );
  }
  const groundingHeader = groundingLines.length > 0 ? `\n${groundingLines.join("\n\n")}\n` : "";

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
  const generationGuide = generationNotes
    ? `\nCRITICAL CONSTRUCTION NOTES (follow exactly): ${generationNotes}`
    : "";
  const improvementGuide = improvementGuidance
    ? `\nKNOWN ISSUES TO CORRECT (from previous reviewer feedback — actively fix these): ${improvementGuidance}`
    : "";
  const hasUserDesignBrief = !!safePromptBox && safePromptBox.trim().length > 0;
  const signCategory = getSignCategory(signType);
  const isGlassTreatment = GLASS_TREATMENT_TYPES.has(signType);

  const isPrivacyFilm = signType === "PRIVACY_FILM";

  function buildFullScenePrompt(): string {
    const siteCtx = hasSitePhoto
      ? `Use this exact building — preserve its architecture, colors, textures, and surroundings exactly as shown.`
      : `Generate against a realistic building facade with natural outdoor surroundings.`;
    const photoSource = hasSitePhoto
      ? `installed on the building in the attached site photo.`
      : `for "${safeClientName}" installed on a realistic building facade.`;

    if (isGlassTreatment && hasSitePhoto) {
      return `Generate a photorealistic photograph showing the building in the attached site photo with ${isPrivacyFilm ? "dense frosted privacy film" : signTypeFormatted} applied to the glass surfaces. ${siteCtx}

${isPrivacyFilm ? `The frosted film is a DENSE, clearly visible, semi-opaque frost covering the glass — it should substantially obscure what is behind the glass (around 70-80% opacity). The frost color must be NEUTRAL GRAYSCALE — white, silver, or light gray only. Never yellow, gold, warm-tinted, or colored.` : ""}
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? `The attached client logo should be ${isPrivacyFilm ? "knocked out (cut out) of the frost film as clear glass — the logo shape is transparent/see-through while everything around it is frosted" : "prominently displayed on the glass treatment"}.` : hasUserDesignBrief ? `Use only the text and content specified in the client design direction below — do not display the company name.` : `Display "${safeClientName}" text ${isPrivacyFilm ? "knocked out of the frost as clear glass lettering" : "on the glass"}.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}. Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Photorealistic quality — like a real photograph.`;
    }

    if (signCategory === "channel_letters") {
      const isHalo = signType === "CHANNEL_LETTERS_BACK_LIT_HALO";
      return `Generate a photorealistic photograph of ${isHalo ? "halo/back-lit" : "front-lit"} channel letter signs ${photoSource} ${siteCtx}

CONSTRUCTION — CRITICAL:
Each letter is an individual self-contained illuminated cabinet (aluminum return, ${isHalo ? "opaque face with LEDs shining backward — warm halo glow on wall behind each letter, faces appear dark/opaque" : "translucent colored acrylic face lit from inside by LEDs"}). Letters are mounted individually to the wall or on a raceway.

ABSOLUTE PROHIBITIONS:
- NO background panel, substrate, or board behind the letters
- NO flat sign panel of any kind
- The building wall must remain visible between and around all letters

${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly — render each element as an individual illuminated channel letter cabinet." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" as individual illuminated channel letters on the building.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}. Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

The sign should be a major visual element — large and prominently placed. Photorealistic quality — like a real photograph.`;
    }

    if (signCategory === "standoff_dimensional") {
      return `Generate a photorealistic photograph of dimensional standoff letters/logo ${photoSource} ${siteCtx}

CONSTRUCTION — CRITICAL:
Each letter and logo element is an individual 3D fabricated piece (${tierSpec.materials.includes("stainless") ? "stainless steel or brushed metal" : "painted aluminum or acrylic"}) approximately 1–2 inches thick, mounted on standoffs off the wall, casting natural shadows. The building wall must remain visible between and around all letters.

ABSOLUTE PROHIBITIONS:
- NO background panel, substrate, backing plate, or any rectangular board behind the letters/logo
- NO acrylic panel, aluminum panel, or any flat sign substrate of any kind
- NO shadowbox, frame, cabinet, or enclosure around the letters

${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly — render each element as a separate physical 3D dimensional object. Strip any logo background completely." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" as large dimensional letters on the building.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}. Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

The sign should be a major visual element — large and prominently placed. Photorealistic quality — like a real photograph.`;
    }

    if (signCategory === "light_box") {
      return `Generate a photorealistic photograph of an illuminated light box sign ${photoSource} ${siteCtx}

CONSTRUCTION — CRITICAL:
A light box is a rectangular aluminum cabinet with a translucent graphic face internally illuminated by LED modules. The cabinet has visible depth (4–6 inches) with aluminum returns on all sides. The face glows evenly with the graphic/text. It is wall-mounted — NOT dimensional individual letters.

${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly on the illuminated translucent face of the light box cabinet." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" on the glowing face of the light box cabinet.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}. Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

The sign should be a major visual element — large and prominently placed. Photorealistic quality — like a real photograph.`;
    }

    if (signCategory === "awning") {
      return `Generate a photorealistic photograph of a commercial awning sign ${photoSource} ${siteCtx}

CONSTRUCTION — CRITICAL:
An awning is a fabric or metal canopy structure that projects outward from a building's storefront or entrance at an angle. It has a visible frame structure and fabric/metal cladding. Branding is printed or applied on the awning face and valance. It is NOT wall-mounted letters — it is a structural canopy projecting from the building.

${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly on the awning surface." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" branding prominently on the awning.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}. Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

The awning should be realistically sized and proportioned for the storefront. Photorealistic quality — like a real photograph.`;
    }

    if (signCategory === "monument") {
      return `Generate a photorealistic photograph of a ground-mounted monument sign ${hasSitePhoto ? "at the property shown in the attached site photo" : "at a realistic building entrance"}. ${siteCtx}

CONSTRUCTION — CRITICAL:
A monument sign is a low, ground-mounted freestanding identification sign (typically 4–8 feet tall) with a solid base structure (masonry, aluminum, or fabricated cabinet). It stands independently at a driveway entrance or building frontage — NOT wall-mounted. The sign face often has internal illumination.

${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly on the monument sign face." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" prominently on the monument sign face.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}. Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Place the monument sign prominently at the entrance area with natural landscape context. Photorealistic quality — like a real photograph.`;
    }

    if (signCategory === "pylon") {
      return `Generate a photorealistic photograph of a tall pole-mounted pylon sign ${hasSitePhoto ? "near the property shown in the attached site photo" : "at a realistic commercial location"}. ${siteCtx}

CONSTRUCTION — CRITICAL:
A pylon sign is a tall freestanding pole-mounted sign (typically 10–25 feet high) with an illuminated cabinet elevated at the top for maximum visibility from roads and parking lots. One or two vertical poles anchor it in the ground — it is NOT wall-mounted, it stands independently.

${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly on the elevated pylon sign cabinet face." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" on the illuminated pylon sign cabinet.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}. Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Show the full pylon sign with pole extending to the ground, visible from a distance. Photorealistic quality — like a real photograph.`;
    }

    if (signCategory === "blade_sign") {
      return `Generate a photorealistic photograph of a projecting blade sign ${photoSource} ${siteCtx}

CONSTRUCTION — CRITICAL:
A blade sign projects perpendicularly outward from the building fascia, double-faced and readable from both sides when walking along the sidewalk. Bracket/arm hardware connects it to the wall face.

${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly on the visible face(s) of the blade sign." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" on the projecting blade sign.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}. Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

The sign should be a major visual element — prominently placed on the building. Photorealistic quality — like a real photograph.`;
    }

    if (signCategory === "acrylic_standoff") {
      return `Generate a photorealistic photograph of an acrylic sign with standoff hardware ${photoSource} ${siteCtx}

CONSTRUCTION — CRITICAL:
A flat acrylic panel (clear, frosted, or colored) mounted on visible chrome or brushed metal standoff hardware — circular barrel bolts at each corner holding the panel ~¾ inch off the wall surface. The wall is visible behind the panel through the gap created by the standoffs.

${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly on the acrylic panel face." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" on the flat acrylic panel with visible standoff hardware.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}. Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

The sign should be a major visual element. Photorealistic quality — like a real photograph.`;
    }

    if (signCategory === "menu_board") {
      const isEMC = signType === "EMC_ELECTRONIC_MESSAGE_BOARD";
      return `Generate a photorealistic photograph of a ${isEMC ? "LED electronic message center (EMC) display" : "menu board sign system"} ${photoSource} ${siteCtx}

CONSTRUCTION — CRITICAL:
${isEMC ? "An electronic message center is a programmable LED pixel display panel in an aluminum cabinet frame, showing scrolling or static LED text/graphics in full color." : "A menu board system is an array of flat display panels (static printed or digital) arranged in a grid in aluminum extrusion frames, typically used in quick-service restaurants."} It is a flat panel system — NOT dimensional individual letters.

${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly on the display." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" content on the ${isEMC ? "LED display" : "menu board panels"}.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}. Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

The sign should be a major visual element. Photorealistic quality — like a real photograph.`;
    }

    if (signCategory === "flat_applied") {
      return `Generate a photorealistic photograph of flat applied vinyl/print graphics ${photoSource} ${siteCtx}

CONSTRUCTION — CRITICAL:
Flat adhesive vinyl or printed material applied directly and flush to a wall or floor surface — zero depth, no standoffs, no cabinet, no frame, no substrate. The graphic adheres directly onto the existing surface with no raised elements.

${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly as flat applied vinyl on the surface." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" as flat vinyl graphics applied directly to the surface.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}. Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Photorealistic quality — like a real photograph with natural lighting.`;
    }

    if (signCategory === "vehicle") {
      const isWrap = signType === "VEHICLE_WRAP_FULL" || signType === "VEHICLE_WRAP_PARTIAL";
      const isMagnetic = signType === "MAGNETIC_SIGNS";
      return `Generate a photorealistic photograph of ${isWrap ? "vehicle wrap graphics" : isMagnetic ? "magnetic vehicle signs" : "vehicle lettering and graphics"} for "${safeClientName}" applied to a commercial vehicle. ${hasSitePhoto ? "The attached site photo may show a vehicle — if so, apply graphics to that vehicle. Otherwise," : ""} Show a realistic commercial vehicle (white van, pickup truck, or box truck) with professional graphics.

CONSTRUCTION — CRITICAL:
${isWrap ? "A full or partial vehicle wrap uses printed vinyl film covering large portions of the vehicle surface. The wrap follows body contours, door seams, window cutouts, and panel lines seamlessly." : isMagnetic ? "Magnetic signs are flat printed panels placed flat on vehicle door panels. They lay flush with the door surface and do NOT wrap around edges." : "Vehicle lettering uses precision-cut vinyl letters, numbers, and logo graphics applied directly to the vehicle painted surface. Individual pieces follow curves and body lines. Vehicle body color is visible between graphic elements."}

- Vehicle shown from 3/4 front or direct side view — full vehicle visible
- Professional application quality — clean, no bubbles or imperfections
- Realistic outdoor environment (parking lot or building exterior)

${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly on the vehicle graphics." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" as professional vehicle graphics — company name prominently on door/side panel.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}. Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Photorealistic quality — like a real commercial vehicle photograph.`;
    }

    if (signCategory === "flag_sign") {
      const isFeather = signType === "FEATHER_FLAG";
      const isPole = signType === "POLE_BANNERS";
      return `Generate a photorealistic photograph of a ${isFeather ? "feather/teardrop flag" : isPole ? "pole banner" : "flag sign"} for "${clientName}" installed outdoors. ${hasSitePhoto ? "Use the attached site photo as the background environment — keep the building/landmark clearly visible behind and around the flag." : "Show it on a sidewalk or grass area in front of a realistic commercial building exterior."}

CONSTRUCTION — CRITICAL:
${isFeather ? "A feather flag (flutter flag / teardrop flag) is a tall, narrow fabric flag on a flexible fiberglass or aluminum segmented pole. The fabric is dye-sublimation printed polyester that billows and curves naturally in the breeze. The pole curves at the top, creating the characteristic feather/teardrop silhouette." : isPole ? "A pole banner is a wide rectangular fabric panel mounted on two bracket arms extending from a vertical pole. Installed on street poles or dedicated poles." : "A decorative outdoor flag on a pole or bracket mount."}

CRITICAL PLACEMENT & SCALE — NON-NEGOTIABLE:
- The flag stands BESIDE the building, NOT in front of it covering the facade. The building/landmark in the site photo MUST remain clearly visible.
- Place the pole/base on the ground (sidewalk, grass, or paved surface) in the FOREGROUND, off-center (left or right third of the frame).
- Flag pole height: ${isFeather ? "10–14 feet (slightly taller than a single-story doorway)" : isPole ? "12–16 feet (street-light pole height)" : "8–12 feet"}. The flag itself must NEVER be taller than the building behind it.
- Flag occupies approximately 30–50% of image height — NOT more. The complete flag (from base/spike to top tip) must be fully visible inside the frame, not cropped.
- DO NOT scale the flag up to fill the frame. DO NOT center the flag over the main subject of the photo.
- The pole casts a natural shadow on the ground in the same direction as other shadows in the site photo. The fabric shows slight natural curve/billow from a light breeze.

${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly on the flag fabric — vibrant dye-sublimation print quality. Use ONLY the attached logo. Do NOT invent or add any other character, mascot, illustration, or graphic." : hasUserDesignBrief ? "Use ONLY the text/content specified in the client design direction below — do not invent additional graphics, characters, or mascots, and do not display the company name unless the brief asks for it." : `Display the text "${clientName}" prominently on the flag fabric in clean professional bold typography. TEXT ONLY — do NOT add any character, mascot, animal, ghost, robot, person, illustration, or decorative graphic of any kind. The flag content must be the company name and nothing else.`}
${hasUserDesignBrief ? `\nClient design direction: ${promptBox}` : ""}
Tier: ${tier} — ${tierSpec.description}. Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, pole/base hardware, and fabric finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Full flag visible from base to tip, building visible behind it. Photorealistic quality — like a real outdoor photograph of an installed flag.`;
    }

    if (signCategory === "ada_sign") {
      return `Generate a photorealistic photograph of ADA-compliant interior identification signs for "${safeClientName}" ${hasSitePhoto ? "installed in the environment shown in the attached site photo." : "mounted on a clean interior wall."}

CONSTRUCTION — CRITICAL:
ADA (Americans with Disabilities Act) compliant signs are interior identification signs requiring:
- Matte finish non-glare substrate (acrylic, aluminum, or composite) — absolutely NO reflective glare
- Raised tactile copy — letters and numbers physically raised ~1/32" from the surface
- Grade 2 Braille below the tactile text
- High-contrast color: white on dark, or dark on white/light
- Clean, professional institutional or corporate aesthetic
- Proper mounting at 60" AFF (centerline) on the latch side of the door

${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced on the ADA sign face at appropriate scale." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" on the ADA sign panel with raised tactile letters and Braille.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}. Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Photorealistic quality — like a professional interior signage photograph.`;
    }

    if (signCategory === "portable_display") {
      const isBannerStand = signType === "BANNER_STAND";
      const isAFrame = signType === "A_FRAME_SIGN";
      const isTableThrow = signType === "TABLE_THROW";
      const isStepRepeat = signType === "STEP_AND_REPEAT_BACKDROP";
      const isYardSign =
        signType === "CORO_YARD_SIGNS" ||
        signType === "REAL_ESTATE_SIGNS" ||
        signType === "SITE_SIGN" ||
        signType === "L_POSTS";
      const isBanner = signType === "BANNERS" || signType === "MESH_BANNER";

      const isMeshBanner = signType === "MESH_BANNER";
      const isVinylBanner = signType === "BANNERS";

      const itemDesc = isBannerStand
        ? "a portable retractable banner stand — a narrow upright fabric/vinyl banner (typically 33 inches wide × 78–84 inches tall) that pulls up from a small aluminum base with a single support pole behind it. Free-standing on the floor."
        : isAFrame
          ? "a portable A-frame sandwich-board sign sitting on the ground — two hinged panels forming an A shape, typically 24-30 inches wide × 36-42 inches tall, used as sidewalk signage."
          : isTableThrow
            ? "a printed fabric table throw / tablecloth draped over a standard 6 ft trade-show table, with branding on the front face."
            : isStepRepeat
              ? "a step-and-repeat media backdrop — a tall fabric panel (typically 8 ft wide × 8 ft tall) on a portable pipe-and-drape frame, with a tiled logo pattern."
              : isYardSign
                ? "a small yard/site sign — a corrugated plastic or aluminum panel (typically 18×24 inches or 24×36 inches) staked into the ground on H-stakes or wire frame stakes."
                : isMeshBanner
                  ? "a perforated mesh banner — a printed PVC mesh fabric panel with grommets, designed to be tied or zip-tied onto a CHAIN-LINK FENCE or scaffolding section. The mesh is partially see-through (~30% open weave), so the background remains visible THROUGH the banner. Typical size: 4-8 ft wide × 3-5 ft tall."
                  : isVinylBanner
                    ? "a flat printed vinyl banner with grommets at the corners, attached to a specific wall section, fence panel, or banner frame. Typical size: 3-6 ft wide."
                    : "a portable display item placed naturally in the scene at human scale.";

      const sizeRule = isBannerStand
        ? "Banner stand height ≈ 7 feet — TALLER than an average adult. SCALE REFERENCE: if any people are visible in the site photo, the top of the banner stand should be slightly above an average adult's head. The banner stand should occupy roughly 25–35% of the image height — NOT fill the frame, NOT dominate the scene."
        : isAFrame
          ? "A-frame sandwich board is SMALL and LOW TO THE GROUND — total height only ~3.5 feet (waist-to-chest height of a standing adult). SCALE REFERENCE: if any people are visible in the site photo, the TOP of the A-frame must be NO HIGHER than the WAIST of an average adult — never higher than chest. It is a tabletop-sized object on the ground, NOT a doorway-sized object. Should occupy roughly 10–18% of image height — never more. If the rendered A-frame appears taller than half the height of a standing person in the scene, it is WRONG and must be smaller."
          : isTableThrow
            ? "Table throw is on a standard 30-inch-tall trade-show table. Show the full table from front. Table+throw combined occupies ~40–50% of image height."
            : isStepRepeat
              ? "Backdrop is 8 ft tall — about the height of a doorway. Show as a wall element behind, not filling the entire frame."
              : isYardSign
                ? "Yard sign is SMALL — top of sign is roughly knee-to-waist height of a standing adult (~2-3 ft above ground). SCALE REFERENCE: if people are visible in the site photo, the top of the sign must be BELOW the waist of an average adult. Should occupy 10–20% of image height — never more."
                : isMeshBanner
                  ? "Mesh banner is mounted on an existing fence section, scaffolding, or wall area in the scene. It must occupy ONLY 25-40% of image width and 15-30% of image height — NOT the entire frame. The building or scene behind it MUST remain clearly visible (both around the banner AND partially through the mesh weave)."
                  : isVinylBanner
                    ? "Vinyl banner is attached to a specific existing wall section, fence panel, or banner frame in the scene. It must occupy 20-35% of image width — NOT the entire frame, NOT spanning the whole image."
                    : "Item is sized realistically for the scene — NOT filling the entire frame.";

      return `Generate a photorealistic photograph of ${itemDesc} for "${safeClientName}". ${hasSitePhoto ? "Use the attached site photo as the background environment — place the item naturally within that scene." : "Show the item in a realistic commercial setting (storefront sidewalk, lobby, trade show floor, or office interior as appropriate)."} ${siteCtx}

CONSTRUCTION — CRITICAL:
${itemDesc.charAt(0).toUpperCase() + itemDesc.slice(1)}

CRITICAL SCALE & PLACEMENT — NON-NEGOTIABLE:
- ${sizeRule}
- The item must be sized realistically for the scene. It must NOT cover, obstruct, or replace the background. The original building/scene must remain mostly visible around the item.
- Do NOT scale the item up to fill the frame. Do NOT center-stretch it across the whole image. Do NOT cut, divide, or hide the background to make room for it.
- The item casts realistic contact shadows and matches the scene lighting (sun direction, color temperature).
${
  isStepRepeat
    ? "- The backdrop is a wall element placed against an existing wall in the scene — show it occupying only one portion of the frame (e.g. behind a podium area), with surrounding scene visible."
    : isMeshBanner
      ? "- Tie/attach the mesh banner to a chain-link fence, scaffolding, or wall section that exists in the scene. Show the building/landmark clearly THROUGH the perforated mesh weave (semi-transparent), AND clearly around the banner. The banner must NOT cover or obscure the entire building."
      : isVinylBanner
        ? "- Attach the banner to a specific existing wall section, fence panel, or frame in the scene. Position it where a real banner would actually be installed (storefront wall section, fence line, façade panel) — NOT floating in the foreground, NOT spanning the entire image."
        : isTableThrow
          ? "- Show the full draped table positioned naturally in the scene (lobby, entrance, trade-show floor). Camera viewpoint preserved from the site photo."
          : "- Place it on the ground/floor in a believable foreground position — typically off-center (lower-left or lower-right third), with the camera viewpoint preserved from the site photo."
}

${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? `The attached logo must be reproduced exactly on the ${isBannerStand ? "banner face" : isAFrame ? "A-frame panel" : isTableThrow ? "front of the table throw" : isStepRepeat ? "backdrop in a tiled repeat pattern" : isYardSign ? "yard sign panel" : isMeshBanner ? "mesh banner face" : "banner face"}. Use ONLY the attached logo. Do NOT invent or add any other character, mascot, animal, ghost, robot, illustration, or graphic.` : hasUserDesignBrief ? "Use ONLY the text/content specified in the client design direction below — do not invent additional graphics, characters, or mascots, and do not display the company name unless the brief asks for it." : `Display the text "${clientName}" prominently on the ${isBannerStand ? "banner face" : isAFrame ? "A-frame panel" : isTableThrow ? "front of the table throw" : isMeshBanner ? "mesh banner face" : "display face"} in clean professional typography. TEXT ONLY — do NOT add any character, mascot, animal, ghost, robot, person, illustration, or decorative graphic. The display content must be the company name and nothing else.`}
${hasUserDesignBrief ? `\nClient design direction: ${promptBox}` : ""}
Tier: ${tier} — ${tierSpec.description}. Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, fabric finish, and stand hardware style — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

Photorealistic quality — like a real photograph of the portable display in situ. Background scene must remain intact and visible.`;
    }

    return `Generate a photorealistic photograph of a ${signTypeFormatted} sign ${photoSource} ${siteCtx}
${signDetail}${attrsDesc}${generationGuide}${improvementGuide}
${hasLogo ? "The attached logo must be reproduced exactly — same design, colors, proportions." : hasUserDesignBrief ? "Use only the text and content specified in the client design direction below — do not display the company name." : `Display "${safeClientName}" as large centered text with professional signage typography.`}
${hasUserDesignBrief ? `\n<USER_INPUT>Client design direction: ${safePromptBox}</USER_INPUT>` : ""}
Tier: ${tier} — ${tierSpec.description}. Materials: ${tierSpec.materials}
${productsDesc}
${hasRefs ? "Reference photos are AUTHORITATIVE for construction technique, mounting style, and material finish — match them exactly. Branding (logo, text, mascots, graphics) comes ONLY from [CLIENT LOGO] and the company name, never from the references." : ""}

The sign should be sized realistically and proportionately for the scene — fitting naturally within the existing environment without obstructing or replacing the background. Place it where a real sign of this type would actually be installed. Photorealistic quality — like a real photograph with natural lighting and realistic materials.`;
  }

  return (
    SOURCE_OF_TRUTH +
    groundingHeader +
    buildFullScenePrompt() +
    QUALITY_BOOST +
    (hasSitePhoto ? COMPOSITING_REALISM : "") +
    CONTENT_GUARD
  );
}
