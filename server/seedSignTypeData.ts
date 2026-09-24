export type SeedSignType = {
  name: string;
  label: string;
  category: string;
  sortOrder: number;
  description: string;
  attributes: readonly string[];
  generationNotes?: string;
  active: boolean;
};

export const SIGN_TYPE_SEED_DATA: SeedSignType[] = [
  {
    name: "ACRYLIC_SIGN_WITH_STAND_OFFS",
    label: "Stand Offs Sign",
    category: "INTERIOR",
    sortOrder: 0,
    description:
      "A flat acrylic panel, typically 1/4-inch to 1/2-inch thick clear or frosted material, with full-color UV-printed graphics applied to the second surface (printed on the back so the front remains smooth and glossy). The panel is mounted to an interior wall using four cylindrical brushed stainless steel or polished chrome standoff hardware pieces at each corner, creating a 1/2-inch to 1-inch gap between the panel and wall for a floating dimensional effect. Edges are flame-polished for a clean, glass-like finish. Panel sizes range from small 8x10-inch directional plaques to large 24x36-inch or bigger lobby displays. The acrylic may be optically clear with reverse-printed opaque white ink backing, or solid-color frosted/satin acrylic with surface-applied vinyl graphics. Standoff caps are available in round barrel, conical, or dome profiles. Commonly installed in office lobbies, medical waiting rooms, conference rooms, and corporate reception areas as a modern, upscale alternative to flat wall plaques.",
    attributes: [],
    generationNotes:
      "CRITICAL — This is NOT channel letters. Generate a single flat acrylic panel (rectangle) mounted on a wall using four cylindrical brushed stainless steel standoff hardware pieces at the corners, creating a 1/2-inch to 1-inch floating gap between the panel and the wall. The panel face displays the logo/text. The wall is visible around and behind the panel. Do NOT generate individual letterforms or channel letters.",
    active: true,
  },
  {
    name: "A_FRAME_SIGN",
    label: "A-Frame Sign",
    category: "EXTERIOR",
    sortOrder: 0,
    description:
      "A portable double-sided sidewalk sign with a hinged top rail and two angled panels that form an A-shape when opened and set on the ground. The frame is typically powder-coated aluminum or injection-molded plastic in black, white, or silver, with a spring-loaded or slide-in channel that accepts interchangeable printed inserts, dry-erase marker boards, or chalkboard panels. Standard sizes include 24x36-inch and 22x28-inch panel areas. Some models feature a weighted water-fill base for wind resistance, while others use snap-open poster frames for quick graphic changes. Common variants include the classic Signicade molded plastic A-frame, the Windmaster wind-resistant model with springs, and metal sandwich board frames with chalkboard surfaces. Placed on sidewalks, in front of retail storefronts, at restaurant entrances, or in parking areas for daily specials, directional wayfinding, and promotional messaging.",
    attributes: [],
    generationNotes:
      "CRITICAL — Generate the complete physical A-frame unit as it appears on a sidewalk, NOT just a flat graphic face. Show: two angled panels forming an A-shape, hinged at the top, standing on the ground. The printed graphic insert is visible on the front-facing panel. Show the full sign in a sidewalk/storefront context at a slight angle so the A-shape is recognizable. Do NOT fill the frame edge-to-edge with a flat graphic face only.",
    active: true,
  },
  {
    name: "BANNER_STAND",
    label: "Banner Stand",
    category: "INTERIOR",
    sortOrder: 0,
    description:
      "A tall, portable display unit consisting of a retractable printed graphic that rolls up from a weighted aluminum base cassette. The graphic, printed on 13-oz vinyl or fabric, is pulled upward by hand and supported at the top by a telescoping aluminum support pole that hooks into a rail along the top edge of the print. The base unit is a flat, wide-profile aluminum housing, typically silver or black anodized, that sits on the floor and contains the rolled graphic inside. Standard retractable banner stand widths are 24, 33, 36, and 48 inches with heights from 78 to 92 inches. The entire unit weighs 8 to 15 pounds and comes with a zippered nylon carrying case. Premium models feature adjustable height, interchangeable cassettes, and wider bases for stability. Used at trade show booths, conference presentations, hotel lobby displays, retail point-of-purchase setups, and corporate event backdrops.",
    attributes: [],
    generationNotes:
      "CRITICAL — Generate the complete retractable banner stand as a full physical unit, NOT just the graphic face. Show: the flat aluminum base cassette on the floor, the telescoping pole rising from the base, and the printed graphic banner extending upward from the cassette to the top support rail. The full unit is visible in an indoor setting (trade show, lobby, or conference room). Do NOT fill the frame with only the printed graphic.",
    active: true,
  },
  {
    name: "BLADE_SIGN",
    label: "Blade Sign",
    category: "EXTERIOR",
    sortOrder: 0,
    description:
      "A projecting sign mounted perpendicular to a building facade on a decorative wrought iron, powder-coated steel, or aluminum bracket that extends 24 to 48 inches from the wall surface. The sign panel can be round, oval, rectangular, or custom die-cut shaped, fabricated from aluminum composite panel, HDU (high-density urethane) foam, or formed aluminum cabinet. Blade signs may be flat printed panels, carved and painted dimensional panels, or internally illuminated cabinet signs with translucent acrylic faces. The mounting bracket often features decorative scrollwork, gooseneck lighting fixtures, or simple clean-line modern arms. The sign hangs from the bracket via chains, eye bolts, or a rigid welded connection. Typically installed 8 to 10 feet above grade to provide pedestrian-level visibility from the sidewalk in both directions. Common in downtown retail districts, restaurant rows, and mixed-use commercial buildings.",
    attributes: [],
    generationNotes:
      "CRITICAL — This is a SINGLE PANEL sign projecting perpendicular from the building wall on a bracket arm — not individual letterforms. Generate the complete blade sign assembly: a decorative bracket arm extending 24–48 inches from the wall, with the sign panel (round, oval, or rectangular) hanging or rigidly attached to the bracket end. Show the sign from pedestrian eye level with the bracket and panel both visible. Do NOT generate channel letters or dimensional letterforms.",
    active: true,
  },
  {
    name: "CHANNEL_LETTERS_RACEWAY",
    label: "Channel Letters Raceway",
    category: "EXTERIOR",
    sortOrder: 0,
    description:
      "Individually fabricated aluminum channel letters mounted to a shared rectangular metal raceway box that runs horizontally behind and below the letter set. The raceway is typically a 4-to-6-inch tall extruded or fabricated aluminum box, painted to match the building facade or letter color, that houses all electrical wiring, LED power supplies, and provides a unified mounting surface. The letters are wired inside the raceway and the entire assembly installs as one pre-wired unit, bolted to the building wall with lag bolts or through-bolts, requiring only a single electrical connection. Letters feature translucent acrylic faces with internal LED modules for front-lit illumination, with aluminum returns in 3.5-inch to 5-inch depths. The raceway-mounted configuration reduces wall penetrations and simplifies installation, making it the standard approach for strip mall storefronts, multi-tenant commercial buildings, and facades where open-back individual letter mounting is not feasible.",
    attributes: [],
    active: true,
  },
  {
    name: "CORO_YARD_SIGNS",
    label: "Coro Yard Signs",
    category: "EXTERIOR",
    sortOrder: 0,
    description:
      "Lightweight corrugated plastic (Coroplast) signs with a fluted polypropylene core, digitally printed with full-color UV or screen-printed graphics on one or both sides. Standard sizes are 18x24 inches and 24x36 inches with 4mm or 6mm thickness. Signs are displayed on galvanized steel H-wire stakes (typically 9-gauge wire bent into an H-profile) that push into the ground, with the sign sliding into the stake channels along the flute direction. The material is waterproof, lightweight, and inexpensive for high-volume runs. Commonly used for political campaign signs, real estate open house directionals, contractor job site identification, event parking wayfinding, garage sale advertising, and seasonal promotional displays. Designed for temporary outdoor use lasting weeks to a few months before UV degradation affects print quality.",
    attributes: [],
    generationNotes:
      "Show the sign installed on a galvanized steel H-wire stake pushed into a grass or ground surface, at a slight angle showing both the printed face and the stake. Outdoor residential or commercial context. The corrugated fluted edge of the Coroplast material should be visible on the side.",
    active: true,
  },
  {
    name: "DIMENSIONAL_EXTERIOR_NON_ILLUMINATED",
    label: "Dimensional Exterior Non Illuminated",
    category: "EXTERIOR",
    sortOrder: 0,
    description:
      "Thick flat-cut or CNC-cut dimensional letters, typically 1 inch or more in depth, mounted on an exterior building facade. Letters are individually stud-mounted with standoffs (approximately 1/2-inch) so they float off the wall surface and cast natural drop shadows that shift with sunlight. Construction uses solid, rigid materials such as aluminum, acrylic, PVC, or composite. Finish options vary widely: painted flat colors (white, black, dark gray, or custom PMS colors), brushed metal (aluminum or stainless steel with directional grain), or polished metallic finishes (gold, brass, bronze). Letters have clean, crisp edges and unlit returns showing the material thickness from the side. Often installed on stone, brick, stucco, painted walls, or metal panel facades. May include a company logo mark fabricated in the same dimensional style alongside the text. Some installations include thin horizontal rule lines or separators between lines of text. No internal or external illumination - the sign relies entirely on ambient and natural light for visibility. The overall aesthetic is clean, architectural, and high-end corporate.",
    attributes: [
      "Brushed Aluminum Polished",
      "Brushed Gold",
      "Painted PMS color",
      "Painted Letters",
      "Stud Mounted",
    ],
    active: true,
  },
  {
    name: "DIMENSIONAL_LOGO_LETTERS",
    label: "Dimensional Logo Letters",
    category: "INTERIOR",
    sortOrder: 0,
    description:
      "A combined installation of a three-dimensional fabricated logo element and matching dimensional letterforms, both mounted together on an interior wall to present a complete branded identity. The logo is CNC-routed or laser-cut from acrylic, PVC, aluminum, or stainless steel to replicate the brand mark with physical depth, typically 1/2-inch to 1-inch thick. The accompanying letter set is fabricated from the same or complementary materials, such as brushed aluminum letters paired with a painted acrylic logo, or all-metal construction in matching finishes. Both elements are pin-mounted or stud-mounted to the wall with spacers to create a floating effect with shadow lines. Finishes include brushed metal, polished chrome, satin gold, painted PMS colors, or combinations thereof. Commonly installed on feature walls in office lobbies, reception desks, conference room entries, and building entrance vestibules where a premium, cohesive brand statement is desired.",
    attributes: [],
    active: true,
  },
  {
    name: "DIRECTORY",
    label: "Directory",
    category: "INTERIOR",
    sortOrder: 0,
    description:
      "An interior wayfinding sign panel listing multiple tenants, suite numbers, or departments within a building, mounted in a lobby, elevator vestibule, or main corridor. Directory signs use modular systems with interchangeable name strips or panels that slide into aluminum or acrylic track channels, allowing easy updates when tenants change. Frame systems include wall-mounted single-panel directories with header and individual tenant strips, freestanding pedestal-mounted directories, and multi-panel Slatz-style systems with individual curved or flat aluminum name plates that click into vertical rails. Common finishes are brushed silver aluminum, satin black, or white frames with clear lens covers protecting paper or vinyl inserts. Directories may also include floor plans, arrows, or color-coded wayfinding zones. Sizes range from small 18x24-inch wall units to large 36x48-inch lobby directories listing dozens of tenants.",
    attributes: [],
    active: true,
  },
  {
    name: "DOOR_GRAPHICS",
    label: "Door Graphics",
    category: "INTERIOR",
    sortOrder: 0,
    description:
      "Vinyl graphics, frosted film, or cut lettering applied directly to interior and exterior glass door surfaces including entrance doors, sidelights, and vestibule panels. Common applications include frosted/etched vinyl film covering full or partial glass panels for privacy and branding, cut vinyl logos and business names, hours of operation text, suite numbers, and decorative banding or border elements. Frosted door graphics use a translucent matte vinyl that simulates acid-etched glass, with company logos or text cut out to reveal clear glass beneath. Full-color printed vinyl door graphics are also used for branding panels and promotional displays. Graphics are applied to the first surface (exterior face) or second surface (interior face) depending on the application. Installed on commercial storefronts, office suite entrances, medical facility doors, conference room glass panels, and interior partition doors.",
    attributes: [],
    active: true,
  },
  {
    name: "EMC_ELECTRONIC_MESSAGE_BOARD",
    label: "EMC - Electronic Message Board",
    category: "EXTERIOR",
    sortOrder: 0,
    description:
      "A programmable electronic LED display sign capable of showing dynamic text, graphics, images, animations, and video content that can be updated remotely via wireless or wired connection or on-site using a controller. The display module consists of a matrix of individual LED pixels behind a protective polycarbonate or tempered glass face panel, housed in a weather-sealed aluminum or steel cabinet. Pixel pitch ranges from 10mm to 20mm for outdoor applications, determining resolution and minimum viewing distance. EMC signs are available as standalone pole-mounted units, integrated panels within monument sign structures, or wall-mounted displays. Full-color RGB models display thousands of colors, while monochrome models use single-color LEDs (typically amber, red, or white). Commonly installed at churches, schools, car dealerships, banks, municipal buildings, and retail businesses along high-traffic roadways. Local sign codes typically regulate brightness, animation timing, and message dwell duration.",
    attributes: [],
    active: true,
  },
  {
    name: "FEATHER_FLAG",
    label: "Feather Flag",
    category: "EXTERIOR",
    sortOrder: 0,
    description:
      "A tall, narrow, vertically oriented fabric flag in a teardrop, feather, or blade shape, mounted on a flexible fiberglass or aluminum segmented pole that curves or bows the fabric into its characteristic profile. The flag fabric is dye-sublimation printed on 3.5-oz or 4-oz knitted polyester, which is lightweight enough to flutter in light breezes and allows some see-through of the reverse-printed image on the back side. Flags are single-sided (mirror image visible on reverse) or double-sided (two printed panels sewn together with a light-blocking liner). Standard heights range from 8 feet (small) to 15 feet (extra-large) when fully assembled on the pole. Base options include a ground spike for grass/dirt, a cross base with water bag for hard surfaces, and a tire base for parking lot deployment. The pole segments into 2 to 4 sections and the flag attaches via a sewn sleeve pocket along the curved edge. Used for storefront promotions, auto dealership lots, apartment community entrances, sporting events, and parking lot directional displays.",
    attributes: [],
    generationNotes:
      "CRITICAL — Generate the complete feather flag assembly as a physical outdoor installation, NOT a flat rectangular graphic. Show: the flexible fiberglass or aluminum segmented pole curved into the characteristic feather/teardrop bow shape, with the printed fabric banner attached along the curved edge and billowing naturally. Base options: ground spike in grass, or cross base on a hard surface. Show the full height of the flag (8–15 feet) in an outdoor setting. Do NOT generate a flat vertical rectangle.",
    active: true,
  },
  {
    name: "FLAG_SIGNS",
    label: "Flag Signs",
    category: "EXTERIOR",
    sortOrder: 0,
    description:
      "A custom-printed fabric flag or banner flag designed to fly from a flagpole, wall-mounted outrigger bracket, or building-mounted pole. The flag is constructed from dye-sublimated polyester or sewn nylon with reinforced heading, brass grommets, or a pole sleeve for attachment. Shapes include standard rectangular flags, vertical gonfalon-style banners, and pennant or swallowtail cuts. Fabric banner flags are commonly wall-mounted on outrigger brackets that hold the flag perpendicular to the building face, similar in concept to blade signs but constructed from fabric rather than rigid materials. Sizes range from small 2x3-foot flags to large 4x6-foot or custom sizes. Used for corporate campus branding, school and university identification, municipal and civic displays, storefront projecting fabric signage, and event or seasonal promotional flags.",
    attributes: [],
    generationNotes:
      "CRITICAL — Generate the complete flag sign as installed, NOT a flat rectangular panel. Show the printed fabric flag mounted on a wall-mounted outrigger bracket or flagpole, with realistic fabric drape, slight movement or wave, and the mounting bracket/pole visible. The flag hangs perpendicular to the building face or flies from a pole. Show the building facade for context. Do NOT generate a flat rectangular graphic fill.",
    active: true,
  },
  {
    name: "LIGHT_BOX",
    label: "Light Box",
    category: "EXTERIOR",
    sortOrder: 0,
    description:
      "An internally illuminated sign cabinet consisting of an aluminum or steel frame housing with one or two translucent face panels and internal LED strip lighting or LED modules that provide even, bright backlighting of the printed graphics. Face panels are fabricated from translucent white acrylic, polycarbonate, or flexible vinyl stretched in an aluminum extrusion frame. Graphics are applied as translucent vinyl prints, opaque vinyl with cut-out lettering revealing the lit face beneath, or direct-printed translucent panels. Light boxes come in rectangular, round, oval, and custom shapes with cabinet depths of 4 to 8 inches. Mounting options include wall-mounted flush cabinets, suspended ceiling-hung double-sided units, and projecting bracket-mounted cabinets. The aluminum extrusion frame snaps or slides open for easy graphic and lamp access. Common installations include storefront identification signs, shopping center tenant panels, gas station canopy signs, and interior retail backlit displays. Round light box variants are sometimes called drum signs or barrel signs.",
    attributes: [],
    generationNotes:
      "CRITICAL — This sign is internally illuminated. Render the sign face as backlit — graphics appear bright and vibrant, glowing from even internal LED lighting behind the translucent face panel. The face panel edges show the aluminum extrusion frame. Prefer a dusk or interior setting where the illumination reads clearly. Do NOT render as a flat non-illuminated panel.",
    active: true,
  },
  {
    name: "L_POSTS",
    label: "L-Posts",
    category: "EXTERIOR",
    sortOrder: 0,
    description:
      "A post-and-panel ground sign system consisting of a printed or routed sign panel hung between two vertical posts using a horizontal crossbar, screws, or hanging hardware. Posts are typically powder-coated aluminum, extruded vinyl/PVC, or treated wood in square, round, or decorative fluted profiles, set into the ground with concrete footings or driven directly into soil. The sign panel is aluminum composite, PVC, HDU foam, or painted aluminum, attached via screws, clips, or hanging chains. An L-post specifically refers to posts with an L-shaped profile or bracket arm at the top that supports the panel from above. Standard panel sizes range from 18x24 inches to 36x48 inches. Rider panels can be hung above or below the main panel for supplemental information. Commonly used for real estate for-sale/for-lease listings, property management identification, small commercial site signs, and residential community entrance markers.",
    attributes: [],
    active: true,
  },
  {
    name: "MAGNETIC_SIGNS",
    label: "Magnetic Signs",
    category: "INTERIOR",
    sortOrder: 0,
    description:
      "A flat, flexible sign panel with a magnetic rubber backing (typically 30-mil thickness) that adheres directly to any ferrous (steel) metal surface through magnetic attraction without adhesive. The magnetic sheet is topped with a white vinyl print surface that is digitally printed with full-color UV-cured or solvent inks, then die-cut or straight-cut to the finished shape. Standard sizes range from 12x18 inches to 18x24 inches with rounded or square corners. The magnetic backing provides strong holding force on flat, smooth metal panels while allowing easy removal and repositioning. Vehicle-grade magnetic signs are designed for use on car doors, truck panels, and van sides, where they can be applied during work hours and removed off-duty. Also used on metal filing cabinets, equipment housings, metal doors, and industrial machinery for temporary identification, safety warnings, and removable branding.",
    attributes: [],
    active: true,
  },
  {
    name: "MENU_BOARDS",
    label: "Menu Boards",
    category: "INTERIOR",
    sortOrder: 0,
    description:
      "Wall-mounted or ceiling-hung display panels used in restaurants, cafes, and food service establishments to present menu items, pricing, daily specials, and promotional offerings. Printed menu boards are typically aluminum composite or PVC panels with full-color digitally printed and laminated graphics, mounted in aluminum frames or track systems behind the service counter. Multi-panel configurations use 2 to 6 individual boards side by side to create a continuous menu display. Other formats include backlit menu boards with translucent panels in aluminum light box frames, chalkboard-style panels (real slate or vinyl chalkboard surface) with hand-drawn or liquid chalk marker content, and digital menu boards using commercial LCD or LED screens controlled by content management software. Printed menu boards feature organized layouts with section headers, item descriptions, pricing columns, and food photography, and are framed in brushed aluminum, black, or wood-tone trim.",
    attributes: [],
    active: true,
  },
  {
    name: "MESH_BANNER",
    label: "Mesh Banner",
    category: "EXTERIOR",
    sortOrder: 0,
    description:
      "A large-format banner printed on perforated mesh vinyl material (typically 9-oz to 12-oz mesh with visible tiny holes throughout the surface) that allows approximately 30-50% airflow through the material, significantly reducing wind load compared to solid vinyl banners. The mesh construction makes these banners suitable for large outdoor installations on fences, scaffolding, building facades, and exposed structures where wind resistance is critical. Mesh banners feature hemmed or heat-welded edges with metal grommets spaced every 18 to 24 inches for secure mounting with zip ties, bungee cords, or ropes. Standard printing uses solvent or UV inks directly on the mesh surface, which produces slightly less sharp imagery than solid vinyl but maintains excellent readability at typical viewing distances. Common applications include construction site fence wraps, building renovation screening, chain-link fence advertising, parking garage facades, and large-scale outdoor event displays. Sizes range from standard 3x6-foot panels to massive building-wrap installations exceeding 100 feet wide.",
    attributes: [],
    active: true,
  },
  {
    name: "POLE_BANNERS",
    label: "Pole Banners",
    category: "EXTERIOR",
    sortOrder: 0,
    description:
      "Vertical fabric or vinyl banners mounted to street light poles, dedicated flag poles, or parking lot poles using specialized metal bracket hardware and fiberglass or aluminum support arms that hold the banner taut and visible. Banners are typically 24 to 30 inches wide and 48 to 96 inches tall, printed on 18-oz blockout vinyl or dye-sublimated polyester fabric, and feature pole pockets sewn along one or both vertical edges that slide over the support arms. The bracket hardware clamps around the pole with stainless steel banding or bolts and extends horizontal arms at the top and bottom of the banner to keep it flat. Banners are installed in matching pairs (one on each side of the pole) or singles, and are typically deployed in series along a streetscape to create a unified branded corridor. Commonly used along municipal downtown main streets, university campus pathways, hospital campus drives, shopping center parking lots, and event venue approaches.",
    attributes: [],
    generationNotes:
      "Show two matching banners installed on a single vertical street pole using horizontal bracket arms at the top and bottom edges of each banner, keeping the fabric flat and taut. Both banners visible, pole centered between them, outdoor streetscape or parking lot context. The bracket hardware at top and bottom of each banner should be visible.",
    active: true,
  },
  {
    name: "PUSH_THRU_LETTERS",
    label: "Push Thru Letters",
    category: "INTERIOR",
    sortOrder: 0,
    description:
      "Individual letter shapes or logo elements routed out of an opaque sign cabinet face panel (typically painted aluminum or acrylic) and filled with translucent acrylic inserts that are pushed through from behind, creating a flush or slightly raised (1/8-inch to 1/4-inch) letter surface proud of the cabinet face. The translucent acrylic letter faces may be clear, white, or color-tinted and are illuminated from within the cabinet by LED modules or LED strip lights, producing bright, evenly lit lettering that glows through the acrylic while the surrounding cabinet face remains opaque. The letter inserts are secured with silicone adhesive and trimmed flush or left slightly protruding for a dimensional effect. Push-thru letters are commonly used on light box cabinet signs, monument sign faces, and wall-mounted illuminated cabinets where clean, crisp illuminated lettering is desired without the fabrication complexity of individual channel letters. The finished appearance shows glowing letter shapes surrounded by an opaque background panel.",
    attributes: [],
    generationNotes:
      "CRITICAL — This is NOT individual channel letters. Generate a flat sign cabinet face (opaque background panel) with letter-shaped cutouts filled with translucent acrylic inserts that glow from internal LED backlighting. The letters appear as bright, evenly lit shapes sitting flush with or slightly proud of the opaque cabinet surface. The surrounding cabinet face is solid opaque. Do NOT render separate 3D letterforms floating off a wall.",
    active: true,
  },
  {
    name: "REAL_ESTATE_SIGNS",
    label: "Real Estate Signs",
    category: "EXTERIOR",
    sortOrder: 0,
    description:
      "Post-mounted signs used by real estate agents, brokers, and property management companies to advertise properties for sale, lease, or rent. The primary panel is hung from a vertical post with a horizontal arm or crossbar, or mounted between two L-posts. Panels are fabricated from aluminum composite (dibond), PVC, or corrugated plastic in standard real estate sizes (18x24, 24x36, and 36x48 inches). Post systems include single wooden 4x4 posts with screw-eye hangers, metal L-post frames, colonial-style routed posts, and vinyl sleeve posts. Rider panels (smaller horizontal panels) hang above or below the main sign on hooks or chains to display agent name, phone number, status updates (Under Contract, Open House, Price Reduced), or brokerage branding. Hardware includes hanging chains, screw eyes, bracket clips, and rider hooks. Signs are typically installed at the property frontage along the road edge and may include directional arrow riders for open house wayfinding.",
    attributes: [],
    active: true,
  },
  {
    name: "SITE_SIGN",
    label: "Site Sign",
    category: "EXTERIOR",
    sortOrder: 0,
    description:
      "A large temporary or semi-permanent outdoor sign installed at construction sites, new developments, and commercial properties to advertise upcoming projects, leasing opportunities, or property information. Site signs are typically 4x8 feet or larger (up to 4x16 feet for multi-panel displays), constructed from 3mm or 6mm aluminum composite panel (ACM/dibond) or exterior-grade MDO plywood, mounted on pressure-treated wooden 4x4 or 6x6 posts driven into the ground or set in concrete footings. Graphics are full-color digitally printed vinyl applied to the panel face and may include architectural renderings, project branding, developer logos, general contractor identification, and contact information. Some site signs feature V-shaped dual-panel configurations for visibility from two directions. Installed at the property frontage facing primary road traffic, these signs are designed to withstand outdoor exposure for months to years during the development timeline.",
    attributes: [],
    active: true,
  },
  {
    name: "STEP_AND_REPEAT_BACKDROP",
    label: "Step and Repeat Backdrop",
    category: "INTERIOR",
    sortOrder: 0,
    generationNotes:
      "CRITICAL — The graphic must be a true step-and-repeat repeating tile pattern: the logo or brand mark repeats uniformly across the ENTIRE backdrop surface in a grid with alternating horizontal offsets (each row offset by half a logo width). No single centered logo — the pattern must cover edge-to-edge. Show the full backdrop on its pipe-and-drape frame in an event setting.",
    description:
      "A large-format backdrop panel featuring a repeating tile pattern of logos, brand names, and sponsor marks arranged in a grid with alternating horizontal offsets (stepped pattern) so that logos are evenly distributed across the entire surface. The backdrop is printed on wrinkle-resistant polyester fabric using dye-sublimation or on smooth vinyl, and is mounted on an adjustable telescoping pipe-and-drape style frame that assembles without tools. Standard widths are 8 feet, 10 feet, or 12 feet with heights of 8 feet, and the frame adjusts with telescoping uprights and crossbars. The fabric attaches to the frame via pole pockets, Velcro strips, or grommets. Step and repeat backdrops are designed for event photography where every photo captures multiple sponsor logos in the background, and are used at press conferences, red carpet events, charity galas, corporate awards ceremonies, trade show activations, and promotional appearances.",
    attributes: [],
    active: true,
  },
  {
    name: "STICKERS_DECALS_VINYL",
    label: "Stickers / Decals - Vinyl",
    category: "EXTERIOR",
    sortOrder: 0,
    description:
      "Custom-cut or digitally printed adhesive vinyl graphics applied to smooth surfaces including walls, windows, floors, vehicles, equipment, and products. Production methods include die-cut vinyl (individual shapes cut from solid-color vinyl sheets using a plotter), digitally printed vinyl (full-color inkjet or UV-printed graphics on white or clear adhesive vinyl with matte or gloss lamination), and transfer decals (multiple vinyl elements pre-spaced on transfer tape for precise multi-color application). Vinyl types include calendered (economy, 3-5 year outdoor life), cast (premium, 7-10 year outdoor life with better conformability), and specialty films (reflective, fluorescent, metallic, holographic). Common applications include window store hours and lettering, die-cut logo stickers for products and packaging, vehicle door decals, wall-applied branding graphics, floor directional decals with non-slip laminate, and safety/regulatory labeling.",
    attributes: [],
    active: true,
  },
  {
    name: "TABLE_THROW",
    label: "Table Throw",
    category: "INTERIOR",
    sortOrder: 0,
    description:
      "A fitted or draped fabric cover that goes over a standard 6-foot or 8-foot folding banquet table, printed with full-color dye-sublimated graphics, logos, and branding on polyester fabric. Table throws come in three main styles: draped (loose fabric that hangs to the floor on all sides with pleated corners), fitted (tailored to the table dimensions with sewn corner darts for a snug appearance), and stretch (spandex-blend fabric that pulls tightly over the table for a sleek, wrinkle-free modern look). The front panel typically features the primary logo and branding, while side panels may include additional messaging, website URLs, or taglines. Standard fabric weight is 6-oz to 8-oz polyester with stain-resistant treatment. The dye-sublimation printing process produces vibrant, full-bleed, edge-to-edge color that is embedded in the fabric fibers and will not crack, peel, or fade with washing. Used at trade show booths, conference registration tables, job fair displays, retail promotional setups, and corporate event check-in stations. Machine-washable and wrinkle-resistant for repeated use.",
    attributes: [],
    generationNotes:
      "CRITICAL — Generate the complete table throw as installed on a 6-foot or 8-foot folding banquet table in a real setting (trade show booth, event registration, conference). Show the full table with the printed fabric draped over it — front panel displaying the logo prominently, sides draped to the floor or table edge. The 3D drape, fabric folds at the corners, and table form should all be visible. Do NOT generate just a flat rectangular fabric panel.",
    active: true,
  },
  {
    name: "VEHICLE_LETTERING",
    label: "Vehicle Lettering",
    category: "VEHICLE",
    sortOrder: 0,
    description:
      "Individual cut vinyl letters, logos, and graphic elements applied directly to vehicle body panels, doors, tailgates, rear windows, and side windows using pressure-sensitive adhesive vinyl film. Vehicle lettering uses cast vinyl (7-year outdoor durability) cut on a plotter into individual letter shapes, weeded of excess material, and applied using transfer tape for precise spacing and alignment. The vinyl conforms to mild body curves and panel seams with heat application. Typical installations include company name and logo on doors, phone number and website on tailgate or rear panel, license/certification numbers, and USDOT/MC numbers on commercial vehicles. Vehicle lettering covers only select areas of the body, leaving the majority of the original vehicle paint visible, making it a cost-effective identification solution. Commonly applied to work trucks, service vans, pickup trucks, box trucks, and fleet vehicles for professional business identification and mobile advertising.",
    attributes: ["Vinyl", "Car lettering", "Truck lettering"],
    active: true,
  },
  {
    name: "DIMENSIONAL_LETTERS",
    label: "Dimensional Letters",
    category: "INTERIOR",
    sortOrder: 1,
    description:
      "Individually cut three-dimensional letters fabricated from acrylic, PVC foam (Sintra), brushed aluminum, stainless steel, bronze, or painted metal, mounted directly to interior walls with threaded studs and spacers or adhesive pads. Each letter is CNC-routed or laser-cut to precise typographic specifications with clean edges and visible material depth, typically ranging from 1/4-inch (acrylic and PVC) to 1-inch or more (metal). The letters are stud-mounted with small spacers behind each letter to create a 1/4-inch to 1/2-inch floating gap from the wall surface, producing natural shadow lines that add depth and dimension. Finish options include clear or colored acrylic, matte or gloss painted surfaces in any PMS color, brushed aluminum with directional grain, polished chrome or mirror-finish stainless steel, satin brass, and patina bronze. Interior dimensional letters are used for lobby signs, reception wall branding, conference room identification, executive office suites, and building directory headers. The dimensional quality creates a premium, architectural appearance that flat printed signs cannot achieve.",
    attributes: ["Acrylic", "PVC", "Brushed Metal", "Painted Metal", "Polished Chrome"],
    active: true,
  },
  {
    name: "DIMENSIONAL_LOGO",
    label: "Dimensional Logo",
    category: "INTERIOR",
    sortOrder: 3,
    description:
      "A three-dimensional fabricated logo element, typically the company brand mark or icon, CNC-routed or laser-cut from acrylic, PVC, aluminum, stainless steel, or brass and mounted to an interior wall as a standalone branded focal point. The logo shape replicates the brand mark with physical depth and volume, usually 1/2-inch to 1-1/2-inch thick, and is mounted with threaded studs and standoff spacers to float off the wall surface. Multi-layer logos may stack materials at different depths for a layered dimensional effect, such as a brushed aluminum base shape with a polished chrome overlay element. Finish options include brushed aluminum with directional grain, polished chrome or mirror stainless steel, satin or polished gold/brass, painted metal in brand PMS colors, and clear or colored acrylic. Commonly installed as the centerpiece of reception area walls, lobby feature walls, boardroom entries, and executive suite branding, often paired with dimensional letter text below or alongside the logo mark.",
    attributes: [
      "Chrome",
      "Polished Chrome",
      "Brushed Aluminum",
      "Painted Metal",
      "Acrylic",
      "Stainless Steel",
    ],
    active: true,
  },
  {
    name: "ADA",
    label: "ADA Signs",
    category: "INTERIOR",
    sortOrder: 4,
    description:
      "ADA-compliant room identification signs fabricated from acrylic, photopolymer, or metal substrates, featuring raised tactile text (1/32-inch minimum relief), pictogram symbols, and Grade 2 Braille translation beads positioned below the tactile text. Signs comply with ADA/ABA Accessibility Guidelines including minimum 5/8-inch tall characters in sans-serif uppercase typefaces with high-contrast color combinations. Common color schemes include dark backgrounds (navy, black, charcoal, dark brown) with light raised text (white, silver, cream), or woodgrain textured surfaces with contrasting raised characters for a natural aesthetic. Standard sizes are typically 6x8 inches or 8x8 inches for room signs, with larger formats for directional and informational panels. Mounting is at 48 to 60 inches above finished floor on the latch side of the door, per ADA requirements. Applications include restroom identification signs (with standard ISA pictograms), suite and room number plaques, fire safety exit signs, elevator signage, and complete wayfinding suites coordinated across an entire building. Custom shapes, rounded corners, and decorative border elements are available while maintaining ADA compliance.",
    attributes: ["Standard Plaque", "Custom Shape", "Wayfinding Suite"],
    active: true,
  },
  {
    name: "WALL_GRAPHICS",
    label: "Wall Graphics",
    category: "INTERIOR",
    sortOrder: 5,
    description:
      "Large-scale vinyl graphics, printed murals, or cut vinyl elements applied directly to interior wall surfaces for branding, decoration, or informational display. Wall graphics encompass several formats: full photographic wall murals printed on adhesive vinyl or wallcovering material applied in panels to create seamless large-scale imagery; cut vinyl lettering and logos in solid colors applied individually to painted drywall or glass; printed vinyl wraps that cover entire wall sections including wrapping around corners, columns, and furniture surfaces like reception desks; and textured or specialty vinyl films with woodgrain, carbon fiber, or metallic finishes applied as decorative wall accents. Installation uses either wet-apply or dry-apply methods depending on the vinyl type and surface. Applications include corporate lobby branding walls, retail interior environments, medical office feature walls, restaurant interior theming, gym and fitness facility motivation graphics, office cubicle and desk surface wraps, and tradeshow booth wall panels.",
    attributes: ["Vinyl Print", "Wall Mural", "Cut Vinyl", "Textured Vinyl"],
    active: true,
  },
  {
    name: "WINDOW_GRAPHICS",
    label: "Window Graphics",
    category: "INTERIOR",
    sortOrder: 6,
    description:
      "Vinyl graphics, printed imagery, or cut lettering applied to interior or exterior storefront and commercial window glass surfaces for branding, promotional messaging, privacy, and visual merchandising. Window graphic types include frosted/etched vinyl film (translucent matte film that simulates sandblasted glass), cut vinyl logos and text in opaque colors, full-color digitally printed vinyl panels, and perforated one-way vision vinyl (micro-perforated film with printed graphics on the exterior that allows see-through visibility from the interior). Frosted films can cover full panes or be precision-cut to reveal logos and decorative patterns in clear glass. Graphics are applied to the first surface (exterior face) for street-facing visibility or second surface (interior face) for protection from weather and tampering. Used on retail storefronts for branding and seasonal promotions, office glass partitions for privacy banding, restaurant windows for menu displays, medical office windows for practice identification, and commercial building lobbies for tenant directories.",
    attributes: ["Frosted Film", "Cut Vinyl", "Full Color Print", "Perforated Vinyl"],
    active: true,
  },
  {
    name: "PRIVACY_FILM",
    label: "Privacy Film",
    category: "INTERIOR",
    sortOrder: 7,
    description:
      "A translucent frosted or decorative adhesive vinyl film applied to interior glass surfaces to obscure visibility while maintaining natural light transmission. The primary format is a solid frost film that replicates the appearance of acid-etched or sandblasted glass, applied as full-coverage panels or precision-cut with logos, text, or decorative patterns revealed in clear glass within the frosted field. Gradient frost films transition from opaque frost at the bottom to clear at the top for partial privacy. Decorative pattern films include geometric shapes, stripes, dots, organic forms, and architectural line patterns that add visual interest while providing varying degrees of privacy. Installation uses a wet-apply method with slip solution for precise positioning on the glass. Privacy film is applied to office partition glass, conference room windows and sidelights, medical exam room windows, storefront glass for after-hours privacy, bathroom and shower enclosures, and glass-walled meeting rooms. Custom die-cut logos and text can be incorporated into the frost film design so company branding is visible within the frosted surface.",
    attributes: ["Frosted", "Decorative Pattern", "Logo Cutout", "Gradient Frost"],
    active: true,
  },
  {
    name: "MONUMENT_SMALL_2x3",
    label: "Monument Sign (2x3)",
    category: "EXTERIOR",
    sortOrder: 10,
    description:
      "A compact freestanding ground-level sign approximately 2 feet tall by 3 feet wide, positioned at property entrances, parking area entries, or pedestrian approaches. The sign panel is typically aluminum composite, routed HDU foam, or formed aluminum mounted on a low-profile base structure made from painted steel, aluminum, masonry, or composite material. Graphics include applied vinyl lettering, digitally printed panels, or routed and painted text. Small monument signs serve address identification, directional wayfinding, tenant listing, parking instructions, and property branding purposes. The base may be a simple metal frame, tapered concrete or masonry pedestal, or decorative architectural element matching the building style. Some installations include gooseneck or ground-mounted accent lights for nighttime visibility. Common at medical office complexes, small retail centers, apartment community entries, church campuses, and professional office buildings.",
    attributes: ["Metal Frame", "Posts"],
    active: true,
  },
  {
    name: "MONUMENT_MED_4x6",
    label: "Monument Sign (4x6)",
    category: "EXTERIOR",
    sortOrder: 11,
    description:
      "A medium-sized freestanding ground-level sign approximately 4 feet tall by 6 feet wide, installed at building entrances, office park entries, and commercial property frontages. Construction typically consists of an aluminum sign cabinet or panel mounted on a substantial base structure clad in materials matching the building architecture such as stone veneer, brick, stucco, composite panels, or painted aluminum. The sign face may feature dimensional letters, routed push-thru graphics, applied vinyl, or a tenant directory panel listing multiple businesses. Many medium monument signs include internal LED illumination behind translucent face panels or external gooseneck lighting fixtures. The base is set on a reinforced concrete footing below grade for structural stability. Multi-tenant configurations include modular panel systems with individual business name strips that can be updated when tenants change. Common at office parks, medical complexes, strip mall entrances, multi-tenant commercial buildings, and corporate campus entries.",
    attributes: ["Dimensional Letters", "Posts"],
    active: true,
  },
  {
    name: "MONUMENT_LARGE_4x8",
    label: "Monument Sign (4x8)",
    category: "EXTERIOR",
    sortOrder: 12,
    description:
      "A large freestanding ground-level sign approximately 4 feet tall by 8 feet wide (or larger), constructed with a substantial base of masonry, natural stone, cast stone, concrete, brick, or architectural aluminum panel cladding with an integrated sign cabinet, panel, or dimensional letter display. These monument signs represent the primary identification for major properties and often feature internally illuminated channel letters or push-thru graphics on the upper cabinet section, with the base structure providing an architectural design element that complements the building and landscape. Multi-tenant versions include modular directory panels listing multiple businesses with individual backlit or non-illuminated tenant strips. Some large monuments integrate electronic message center (EMC) LED displays within the overall structure. Construction requires engineered concrete footings and may include underground electrical conduit for illumination. Installed at major commercial property entrances, corporate headquarters driveways, shopping center main entries, hospital campuses, and large-scale developments where a permanent, high-end ground-level presence is required.",
    attributes: ["Stone Base", "Brick Base", "Multi-Tenant", "Single-Tenant", "Digital Display"],
    active: true,
  },
  {
    name: "CHANNEL_LETTERS_FRONT_LIT",
    label: "Channel Letters (Front-Lit)",
    category: "EXTERIOR",
    sortOrder: 13,
    description:
      "Individually fabricated three-dimensional metal letters with translucent acrylic faces and internal LED module illumination that lights the front face of each letter, producing bright, glowing letter faces visible day and night. Each letter is constructed from an aluminum back panel, aluminum return walls (the sides, typically 3.5-inch to 5-inch deep), and a routed translucent acrylic face panel (white, colored, or custom-matched to brand colors). LED modules are mounted inside each letter on the aluminum back and project light forward through the acrylic face. The exterior aluminum returns are painted to match the brand color or the building facade. Letters are individually mounted to the building wall with threaded studs and standoffs, or grouped on a raceway (see Channel Letters Raceway). Front-lit channel letters are the most common form of illuminated commercial signage, used on retail storefronts, restaurant facades, medical buildings, hotels, automotive dealerships, and office buildings. The illuminated faces are visible from hundreds of feet at night while the dimensional letter forms provide daytime visibility through shadows and depth.",
    attributes: ["Aluminum", "Stainless Steel", "Standard LED", "High-Output LED"],
    active: true,
  },
  {
    name: "CHANNEL_LETTERS_BACK_LIT_HALO",
    label: "Channel Letters (Back-Lit/Halo)",
    category: "EXTERIOR",
    sortOrder: 14,
    description:
      "Individually fabricated metal channel letters with solid, opaque front faces and open or translucent backs that allow internal LED lighting to project backward, casting a soft halo glow onto the wall surface behind each letter. The letters are constructed from aluminum with painted, brushed, or polished metal front faces (the faces do not illuminate) and are pin-mounted with 1-inch to 1.5-inch standoff spacers to create a visible gap between the letter and the wall. LED modules inside each letter face rearward, projecting light through the open back of the letter channel onto the building surface, creating a dramatic silhouette and halo effect. The resulting appearance at night is dark letter forms outlined by a soft wash of light on the wall. Front face finishes include brushed aluminum, brushed stainless steel, polished stainless, painted colors, and even rusted Corten steel for architectural applications. Halo-lit channel letters are considered a premium exterior sign type, commonly used on upscale retail, restaurants, hotels, corporate offices, and residential developments where a sophisticated, indirect lighting aesthetic is preferred over bright face illumination.",
    attributes: [
      "Aluminum",
      "Brushed Aluminum",
      "Stainless Steel",
      "Polished Stainless",
      "RGB LED",
    ],
    active: true,
  },
  {
    name: "PARKING_SIGNS",
    label: "Parking Signs",
    category: "EXTERIOR",
    sortOrder: 15,
    description:
      "Aluminum or steel sign panels mounted on single round or square metal posts, installed in parking lots, garages, and driveways to regulate traffic flow and designate parking spaces. Sign panels are typically 12x18-inch or 18x24-inch flat aluminum with digitally printed or screen-printed graphics, often using engineer-grade or high-intensity reflective sheeting for nighttime visibility. Common parking sign messages include Reserved Parking, Visitor Parking, Handicap Accessible (with ISA symbol), Fire Lane No Parking, Employee Only, 15-Minute Parking, Tow-Away Zone, and directional arrows. Posts are 2-inch round or 2-inch square galvanized steel tubes, either direct-buried in concrete footings or attached to bolt-down surface-mount bases for paved areas. Signs attach to posts with tamper-resistant bracket hardware. Custom parking signs may include tenant logos, property management contact information, and numbered space identifiers. Commonly installed at commercial properties, medical offices, retail centers, apartment complexes, and municipal parking facilities.",
    attributes: ["Reflective", "Non-Reflective", "Custom Post", "Standard Post"],
    active: true,
  },
  {
    name: "BANNERS",
    label: "Banners",
    category: "EXTERIOR",
    sortOrder: 16,
    description:
      "A large-format printed banner with reinforced hemmed edges and metal grommets spaced every 18 to 24 inches along the perimeter for mounting with ropes, bungee cords, zip ties, or banner hanging hardware. Banners are digitally printed with solvent, UV, or latex inks on durable 13-oz or 15-oz scrim vinyl material in full color. Standard sizes range from 2x4 feet to 4x12 feet or larger for custom applications. Finishing options include pole pockets sewn along the top and bottom edges for horizontal pole mounting, wind slits cut into the material for outdoor wind resistance, and webbing reinforcement along stress points. Banners are displayed horizontally on building facades, fences, between poles, on scaffolding, and across storefronts. Indoor banners may use lighter-weight vinyl, fabric, or satin material. Applications include grand opening announcements, seasonal sales promotions, event advertising, construction site identification, sponsor displays, and temporary directional wayfinding.",
    attributes: ["Vinyl", "Fabric", "Mesh", "Double-Sided", "Pole Mount", "Wall Mount"],
    active: true,
  },
  {
    name: "WINDOW_GRAPHICS_EXT",
    label: "Window Graphics (Exterior)",
    category: "EXTERIOR",
    sortOrder: 17,
    description:
      "Vinyl graphics, lettering, or printed panels applied to the exterior (first surface) of storefront and commercial window glass for maximum street-side visibility and impact. Exterior window graphic formats include cut vinyl logos and business names in opaque colors, full-coverage digitally printed window wraps on opaque or perforated vinyl, and large-format perforated window film (one-way vision) that displays full-color graphics from the outside while maintaining interior see-through visibility from inside. The vinyl is precision-cut on a plotter or printed with UV-resistant inks and laminated for outdoor durability. Perforated vinyl features tiny holes throughout the material (typically 50/50 or 60/40 print-to-hole ratio) that allow light and visibility from the interior while presenting a solid graphic image from the exterior viewing angle. Applications include storefront branding wraps, seasonal promotional displays, window-height brand bars, sale announcements, coming soon displays, and full-window photographic murals. Installed on retail storefronts, restaurants, automotive showrooms, real estate offices, and commercial building ground-floor windows.",
    attributes: ["Perforated Vinyl", "Cut Vinyl", "Full Coverage", "Frosted"],
    active: true,
  },
  {
    name: "STOREFRONT_PAN_SIGN_FLAT",
    label: "Storefront Pan Sign (Flat)",
    category: "EXTERIOR",
    sortOrder: 18,
    description:
      "A flat or shallow-profile rectangular sign panel fabricated from aluminum sheet metal with formed pan edges (1-inch to 2-inch returns bent around the perimeter) that create a clean, finished border profile and add structural rigidity. The sign face features applied vinyl graphics, digitally printed and laminated vinyl panels, or painted lettering on a smooth baked-enamel or powder-coated aluminum surface. Pan signs are mounted flush against building facades above storefronts using Z-clips, French cleats, or direct bolt attachment. Sizes commonly range from 2x8 feet to 3x12 feet for single-tenant storefronts. Illumination options include externally mounted gooseneck light fixtures aimed at the sign face, internal LED backlighting behind a translucent polycarbonate or acrylic face panel conversion, or non-illuminated installations relying on ambient storefront lighting. The flat pan sign is a cost-effective, clean-looking exterior identification sign commonly installed on strip mall tenant spaces, standalone retail buildings, commercial office entrances, and professional service storefronts.",
    attributes: [
      "Gooseneck Lit",
      "Internal LED",
      "Non-Illuminated",
      "Vinyl Face",
      "Polycarbonate Face",
    ],
    active: true,
  },
  {
    name: "VEHICLE_WRAP_FULL",
    label: "Vehicle Wrap (Full)",
    category: "VEHICLE",
    sortOrder: 20,
    description:
      "A digitally printed cast vinyl wrap covering every visible exterior painted surface of a vehicle including hood, roof (optional), doors, fenders, quarter panels, bumpers, and tailgate, transforming the entire vehicle into a mobile branded advertisement. The wrap uses premium cast vinyl film (3M IJ180C, Avery MPI 1105, or equivalent) with a pressure-activated or air-release adhesive that conforms to compound curves, body lines, recesses, door handles, and mirrors through professional heat application with a heat gun and squeegee. Graphics are printed with solvent, eco-solvent, or UV inks and overlaminated with a cast gloss, matte, or satin protective clear film for UV protection and abrasion resistance. Full wraps completely change the vehicle appearance and protect the original paint underneath. The vinyl is removable without paint damage when professionally removed with heat. Commonly applied to box trucks, cargo vans, sprinter vans, pickup trucks, SUVs, and passenger cars for fleet branding, business advertising, and promotional campaigns. Professional installation typically takes 1 to 3 days depending on vehicle size and design complexity.",
    attributes: ["Gloss Finish", "Matte Finish", "Satin Finish", "Textured"],
    active: true,
  },
  {
    name: "VEHICLE_WRAP_PARTIAL",
    label: "Vehicle Wrap (Partial)",
    category: "VEHICLE",
    sortOrder: 21,
    description:
      "A digitally printed cast vinyl wrap covering a portion of a vehicle body, typically applied to doors, rear quarter panels, tailgate, rear window, or specific body sections while leaving some areas of original paint visible. Partial wraps blend printed graphics with the vehicle's factory paint color, using design techniques such as fades, splashes, geometric shapes, or hard-edge transitions to create a seamless integration between wrapped and unwrapped areas. The vinyl material and printing process are the same as full wraps (premium cast vinyl with protective overlaminate), and the wrap edges are carefully tucked into body seams, door jambs, and panel gaps for clean termination lines. Partial wraps offer more visual impact and brand coverage than cut vinyl lettering alone at a lower cost than full wraps, typically covering 25% to 75% of the vehicle surface. Common configurations include door and rear panel coverage on trucks and vans, tailgate wraps on pickup trucks, and rear-third or rear-half coverage on cargo vans. Installed on commercial trucks, service vans, delivery vehicles, and fleet vehicles for professional business branding.",
    attributes: ["Doors Only", "Rear Only", "Hood + Doors", "Custom Coverage"],
    active: true,
  },
  {
    name: "AWNING",
    label: "Awning",
    category: "EXTERIOR",
    sortOrder: 0,
    description:
      "A commercial fabric or vinyl awning projecting outward from the building facade above a storefront entrance, window, or patio on a welded aluminum or steel frame structure. The awning canopy is fabricated from solution-dyed acrylic fabric (such as Sunbrella), vinyl-coated polyester, or PVC-laminated canvas in solid colors, stripes, or custom patterns. Company name, logo, and messaging are screen-printed, digitally printed, or vinyl-applied on the front slope panel and hanging valence (the vertical front flap) in bold, contrasting colors. The fabric is stretched taut over the frame and professionally heat-sealed or sewn at attachment points to prevent sagging or flapping. Common frame styles include standard flat slope (angled straight panel), dome (rounded barrel vault), bullnose (curved front edge with a rolled leading edge), quarterbarrel (half-round), box or marquee (squared sides and flat top), and entrance canopy (deep projection over doorways). Frames are finished in powder-coated colors to match the building or brand. Awning sizes range from small 3-foot window awnings to large 10-foot-deep entrance canopies spanning entire storefronts. Commonly installed on retail storefronts, restaurants, hotels, medical offices, and commercial buildings to provide weather protection, solar shading, and prominent branded street presence.",
    attributes: [],
    generationNotes:
      "CRITICAL — Generate the complete awning as installed on a building facade, NOT a flat panel. Show the fabric canopy projecting outward from the building above the storefront entrance, with realistic 3D depth and the correct profile for the selected style (standard flat slope / dome / bullnose / box marquee). The company name and logo appear on the front slope panel and/or hanging valence. Show the building facade above and below for context. Do NOT generate a flat rectangular graphic face.",
    active: true,
  },
  {
    name: "LIGHT_BOX_FACE",
    label: "Light Box Face",
    category: "EXTERIOR",
    sortOrder: 0,
    description:
      "A replacement translucent face panel designed to retrofit into an existing light box sign cabinet, fabricated from vacuum-formed or flat-sheet translucent white acrylic (typically 3/16-inch or 1/8-inch thick) or flexible polycarbonate with digitally printed translucent vinyl graphics applied to the first or second surface. The face panel is custom-cut to the exact dimensions of the existing cabinet frame and installs by sliding into aluminum extrusion channels, snapping into retainer clips, or securing with screws along the perimeter. Graphics are printed on translucent vinyl using solvent or UV inks, allowing internal LED or fluorescent lighting to backlight the imagery for bright, even illumination day and night. Full-color photographic imagery, logos, and text appear vibrant when lit from behind. Light box face replacements are a cost-effective rebranding solution when the existing cabinet structure and electrical components are in good condition but the tenant or branding has changed. Common applications include shopping center tenant panel replacements, gas station canopy sign refacing, storefront light box updates, and franchise location rebranding.",
    attributes: [],
    generationNotes:
      "CRITICAL — This sign is internally illuminated. Render the sign face as backlit — graphics appear bright and vibrant, glowing from even internal LED lighting behind the translucent face panel. The face panel edges show the aluminum extrusion frame. Prefer a dusk or interior setting where the illumination reads clearly. Do NOT render as a flat non-illuminated panel.",
    active: true,
  },
];
