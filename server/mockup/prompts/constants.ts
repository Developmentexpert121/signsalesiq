export const TIER_MATERIAL_SPECS: Record<string, { description: string; materials: string }> = {
  GOOD: {
    description: "Standard-grade commercial signage with clean, professional execution",
    materials:
      "Standard aluminum construction, basic acrylic faces, vinyl graphics, standard LED modules (6500K white), painted finishes, surface-mounted hardware, basic weatherproofing. Single-color or simple two-color design. No decorative trim or premium accents.",
  },
  BETTER: {
    description: "Mid-range professional signage with upgraded materials and refined craftsmanship",
    materials:
      "Heavier-gauge aluminum or steel construction, cast acrylic faces, routed aluminum composite panels, higher-density LED arrays with improved color rendering, brushed or anodized metal returns, concealed mounting hardware, powder-coat or automotive-grade paint finishes. Multi-color capability with clean color transitions.",
  },
  BEST: {
    description:
      "Premium commercial signage with top-tier materials, engineering, and visual impact",
    materials:
      "Stainless steel or bronze construction, polished or brushed metal returns, high-output LED with tunable color temperature and even light distribution, fabricated dimensional elements, premium substrates (Dibond, stainless, copper), museum-quality finishes, integrated trim cap, architectural-grade mounting systems. Full-color graphics, gradient-capable illumination, and refined edge details.",
  },
};

export const QUALITY_BOOST = `
VISUAL QUALITY — NON-NEGOTIABLE REQUIREMENTS (apply to every pixel):
• PHOTOREALISM: The output must be completely indistinguishable from a professional commercial photography shoot of a real installed sign — NOT a render, NOT a composite, NOT a mockup template. Every detail must look genuinely real.
• CAMERA: Simulate a high-end DSLR or mirrorless camera — tack-sharp focus on sign elements, natural lens depth-of-field with gentle bokeh on distant background, clean balanced exposure, realistic film-like tonal range.
• LIGHTING & ATMOSPHERE: Physically accurate lighting with proper cast shadows, ambient occlusion, and realistic light spill on surrounding surfaces. For any illuminated/lit sign elements (channel letters, light boxes, halo letters, EMC boards): warm LED glow visibly pools on the adjacent wall; letter edges and cabinet faces radiate subtle light; glow color temperature is warm amber-white (3000–4000K). Match the environment's ambient light color: golden-hour warmth for evening exterior scenes, cool blue-white for daytime, warm incandescent for interior lobbies. Wall sconces, architectural accent lights, and surrounding illumination should be realistically integrated.
• MATERIALS: Full physical surface fidelity — brushed metal returns show directional micro-highlights and subtle environment reflection; acrylic faces show clarity with micro-edge glow; painted aluminum shows slight surface texture and sheen; concrete, masonry, brick, wood grain, and tile surfaces render with full realistic micro-detail and depth.
• SIGN-TO-SURFACE INTEGRATION: Sign elements are physically present in the scene — NOT pasted on. Mounting hardware (standoffs, raceway, brackets) casts contact shadows on the wall; gaps between letters and the wall surface show ambient occlusion darkening; sign edges interact with environment lighting with subtle rim-light and shadow falloff.
• DESIGN & AESTHETIC: Modern, premium, award-winning commercial signage visual style — bold and balanced typographic hierarchy, strong visual weight, refined composition. The look should match the quality standard of International Sign Association award-winning installations and high-end architectural signage portfolios.
• ENVIRONMENT: The full scene — building facade, surrounding landscape, sky, plants, street elements — should look vivid, naturally lit, and professionally composed, creating a compelling and aspirational presentation.`;

export const COMPOSITING_REALISM = `

PHOTOREALISTIC COMPOSITING — the sign must be integrated into the attached site photo as if it were physically present there during the shoot:
• PERSPECTIVE: The sign's perspective angle must exactly match the camera angle of the site photo — same vanishing points, same eye-line, same horizon. Do NOT render the sign as a flat front-on graphic if the site photo is shot from an angle.
• LIGHTING DIRECTION: Match the ambient lighting of the site photo — identify the direction, color temperature, and intensity of the existing light (sun position, overcast diffusion, interior lamps) and light the sign from the same direction with matching warmth/coolness.
• CAST SHADOWS: The sign must cast natural, physically accurate shadows onto the ground or wall surface beneath it, with the same shadow direction, softness, and opacity as other shadows already visible in the site photo.
• EDGES: Sign edges must be sharp and realistic — NO outer glow, NO halo, NO drop-shadow effect, NO blurry seam between the sign and the background. Edge transitions should look like a real photographed object against a real background.
• CONTACT: The base of the sign meets the ground/floor with realistic contact shadow and ambient occlusion. For wall-mounted items, mounting hardware shows believable contact darkening at the wall interface.
• ATMOSPHERE: The sign picks up the same atmospheric haze, color cast, and depth-of-field as objects at its distance from the camera in the site photo.
• INTEGRATION: Do NOT float the sign. Do NOT make it look "pasted on" or "added in post". The result must be indistinguishable from a photograph where the sign was physically installed before the shutter clicked.`;

// Single precedence line prepended to every assembled prompt. Establishes which inputs
// are authoritative for which dimension of the output so the model stops drifting away
// from the supplied references / sign-type metadata. See plan §2.3.
export const SOURCE_OF_TRUTH = `
SOURCE OF TRUTH & PRECEDENCE — read this first:
(1) The provided sign-type CONSTRUCTION NOTES and the attached [SIGN REFERENCES] define HOW the sign is physically built — its construction method, material/finish, 3D form, proportions, mounting hardware, and illumination. Follow these exactly. Match the primary reference's fabrication as if your output came from the same shop.
(2) The [CLIENT LOGO] defines WHAT branding appears on the sign — it is the only branding/text/graphics allowed on the sign face, and it already contains any company wordmark. The supplied company name is CONTEXT/metadata only: do NOT render it as standalone text when a [CLIENT LOGO] is provided. Render the company name as text ONLY if no logo is attached, or the client design brief explicitly requests it. Never copy any logo, lettering, mascot, character, or artwork from the references; those belong to other companies.
(3) The attached [SITE PHOTO] (when present) defines WHERE the sign is installed — the camera angle, lighting, and surroundings to match.
Invent nothing outside (1)–(3).
`;

export const CONTENT_GUARD = `

ABSOLUTE CONTENT PROHIBITIONS — these rules override everything else and must NEVER be violated:
• NO cartoon characters, pixel art sprites, mascots, animals, illustrated figures, anime, manga, ghosts, robots, blob characters, smiley creatures, or any character-based artwork — regardless of whether such imagery appears in any reference photo provided or in any logo provided.
• NO clipart, vector illustrations, flat-design icons, drawings, paintings, or any artistic illustration style of any kind. The ONLY exception is the EXACT client logo file provided as [CLIENT LOGO] — reproduce that logo precisely as-is, but never invent additional graphics around it.
• NO human figures, animal figures, robot figures, fantasy creatures, or any living or fictional entity rendered in any illustrative or stylized way.
• If NO [CLIENT LOGO] is attached, the sign face must contain ONLY clean professional typography of the company name — no decorative graphics, no characters, no mascots, no invented logos.
• The ONLY permitted content is real commercial signage: fabricated physical sign structures, dimensional letters, sign cabinets, illuminated panels, mounting hardware, raceway systems, and architectural building elements.
• REFERENCE PHOTOS are AUTHORITATIVE for the sign's physical CONSTRUCTION, MATERIAL/FINISH, 3D FORM, PROPORTIONS, mounting hardware, and ILLUMINATION — match those exactly. But their BRANDING IS NOT YOURS: never reproduce, trace, or imitate any logo, lettering, mascot, character, artwork, or any text visible on the reference signs — those belong to other companies. Branding on the generated sign comes EXCLUSIVELY from [CLIENT LOGO] and the company name; if any reference photo contains characters, mascots, animals, pixel art, or any non-sign artwork, that content must be completely ignored and must NOT appear in the output.
• Any company name, logo, lettering, or text visible in the FEW-SHOT EXAMPLE OUTPUTS or in the SIGN REFERENCES belongs to a different business. The ONLY branding permitted on the output sign is from [CLIENT LOGO] and the supplied company name — never carry over branding from any example or reference into the result.
• BUSINESS NAME: Do NOT render the business/company name as standalone text on the sign when a [CLIENT LOGO] is provided — the logo already carries the wordmark. Render the company name as text ONLY if no logo is attached, or the client design brief explicitly asks for it (e.g. "include the company name", "add our name below the logo").
• LOGO COLOR FIDELITY: Reproduce the [CLIENT LOGO] with its EXACT original colors — never recolor, re-tint, shift hue/saturation, convert to monochrome, or otherwise alter the logo's colors unless the design brief explicitly requests a color change. Material/illumination effects intrinsic to the sign type (e.g. halo-lit faces, frosted-glass knockouts) follow the construction notes, but the logo's design colors must not be arbitrarily changed.
• LOGO PROPORTIONS: The [CLIENT LOGO] must keep its uploaded aspect ratio and proportions — never stretch, squash, skew, or distort it. Scale it uniformly so it is never deformed or shrunk out of proportion.
• The sign must stay fully within its designated placement area and must not extend, overflow, or bleed beyond the boundaries of the sign structure or the region where it is being installed. The sign must NEVER cover, replace, or obscure the entire background scene — the building, landmark, and surroundings of the site photo MUST remain clearly visible around the sign.
• Every element of the generated image must look exactly as it would appear in a real-world professional sign installation photograph — nothing illustrative, nothing fictional, nothing decorative beyond the sign itself.

OUTPUT REQUIREMENT — CRITICAL:
• You MUST generate and return a complete rendered IMAGE. Do NOT return text, do NOT return an empty response, do NOT return a placeholder.
• If the requested sign design cannot be applied for any reason, still return the original site photo with a simple, realistic, plain-text sign placed in an appropriate location.
• NEVER return a blank, empty, or incomplete result. Always output a full image.`;
