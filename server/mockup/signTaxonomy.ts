export { FULL_SCENE_ONLY_SIGN_TYPES, isFullSceneOnly } from "../../shared/fullSceneOnlySignTypes";

export const GLASS_TREATMENT_TYPES = new Set([
  "GLASS_WALL_DECAL",
  "PRIVACY_FILM",
  "FROSTED_FILM",
  "WINDOW_GRAPHICS",
  "WINDOW_GRAPHICS_EXT",
  "DOOR_GRAPHICS",
  "WINDOW_PERF",
  "PERFORATED_WINDOW_FILM",
]);

// Glass types that should NOT be sent through the AI sign render. On real storefront glass the
// image model invents a framed interior scene instead of a clean decal, so these are produced
// deterministically as a flat grey panel + centered logo (see buildGlassDecalPanel).
export const GREY_BOX_GLASS_TYPES = new Set(["GLASS_WALL_DECAL"]);

/**
 * Whether this sign type uses the deterministic grey-box panel instead of the AI sign render.
 */
export function usesGreyBoxPanel(signType: string): boolean {
  return GREY_BOX_GLASS_TYPES.has(signType);
}

export const CHANNEL_LETTER_TYPES = new Set([
  "CHANNEL_LETTERS_FRONT_LIT",
  "CHANNEL_LETTERS_BACK_LIT_HALO",
  "CHANNEL_LETTERS_RACEWAY",
]);

export const STANDOFF_DIMENSIONAL_TYPES = new Set([
  "DIMENSIONAL_LETTERS",
  "DIMENSIONAL_LOGO",
  "DIMENSIONAL_LOGO_LETTERS",
  "DIMENSIONAL_EXTERIOR_NON_ILLUMINATED",
  "DIMENSIONAL_LETTERS_AND_LOGO",
  "PUSH_THRU_LETTERS",
]);

export const LIGHT_BOX_TYPES = new Set(["LIGHT_BOX", "LIGHT_BOX_FACE"]);

export const AWNING_TYPES = new Set(["AWNING", "AWININGS"]);

export const MONUMENT_TYPES = new Set([
  "MONUMENT_MED_4x6",
  "MONUMENT_LARGE",
  "MONUMENT_LARGE_4x8",
  "MONUMENT_SMALL_2x3",
  "MONUMENT",
]);

export const PYLON_TYPES = new Set(["PYLON_SIGN"]);

export const BLADE_SIGN_TYPES = new Set(["BLADE_SIGN"]);

export const ACRYLIC_STANDOFF_TYPES = new Set(["ACRYLIC_SIGN_WITH_STAND_OFFS"]);

export const MENU_BOARD_TYPES = new Set(["MENU_BOARDS", "EMC_ELECTRONIC_MESSAGE_BOARD"]);

export const VEHICLE_TYPES = new Set([
  "VEHICLE_LETTERING",
  "VEHICLE_WRAP_FULL",
  "VEHICLE_WRAP_PARTIAL",
  "MAGNETIC_SIGNS",
]);

export const FLAG_TYPES = new Set(["FEATHER_FLAG", "FLAG_SIGNS", "POLE_BANNERS"]);

export const ADA_SIGN_TYPES = new Set(["ADA", "DIRECTORY", "PARKING_SIGNS"]);

export const PORTABLE_DISPLAY_TYPES = new Set([
  "BANNER_STAND",
  "BANNERS",
  "MESH_BANNER",
  "STEP_AND_REPEAT_BACKDROP",
  "TABLE_THROW",
  "A_FRAME_SIGN",
  "CORO_YARD_SIGNS",
  "REAL_ESTATE_SIGNS",
  "SITE_SIGN",
  "L_POSTS",
]);

export const FLAT_APPLIED_SIGN_TYPES = new Set([
  "WALL_GRAPHICS",
  "STICKERS_DECALS_VINYL",
  "VINYL_LETTERING",
  "VINYL_WALL_GRAPHICS",
  "FLOOR_GRAPHICS",
]);

export const DIMENSIONAL_SIGN_TYPES = new Set([
  ...Array.from(CHANNEL_LETTER_TYPES),
  ...Array.from(STANDOFF_DIMENSIONAL_TYPES),
  ...Array.from(LIGHT_BOX_TYPES),
  ...Array.from(AWNING_TYPES),
  ...Array.from(MONUMENT_TYPES),
  ...Array.from(PYLON_TYPES),
  ...Array.from(BLADE_SIGN_TYPES),
  ...Array.from(ACRYLIC_STANDOFF_TYPES),
  ...Array.from(MENU_BOARD_TYPES),
]);

export type SignCategory =
  | "channel_letters"
  | "standoff_dimensional"
  | "light_box"
  | "awning"
  | "monument"
  | "pylon"
  | "blade_sign"
  | "acrylic_standoff"
  | "menu_board"
  | "flat_applied"
  | "glass_treatment"
  | "vehicle"
  | "flag_sign"
  | "ada_sign"
  | "portable_display"
  | "generic";

// Typical real-world WIDTH (inches) per sign category. Used as a sane default scale hint
// for the LLM when the user has NOT drawn a reference measurement — output quality drops
// noticeably without any physical-size anchor. These are rough commercial-signage norms;
// the precise measured value (when the user provides one) always takes precedence.
const TYPICAL_WIDTH_INCHES: Record<SignCategory, number> = {
  channel_letters: 96,
  standoff_dimensional: 72,
  light_box: 72,
  awning: 120,
  monument: 72,
  pylon: 144,
  blade_sign: 36,
  acrylic_standoff: 36,
  menu_board: 60,
  flat_applied: 96,
  glass_treatment: 48,
  vehicle: 180,
  flag_sign: 30,
  ada_sign: 12,
  portable_display: 36,
  generic: 72,
};

/**
 * Approximate real-world dimensions for a sign type, derived from a per-category typical
 * width and the plane's on-screen aspect ratio. Used only as a fallback when no reference
 * measurement was drawn, to give the model a physical-scale anchor.
 */
export function getDefaultRealWorldDims(
  signType: string,
  planeWidth: number,
  planeHeight: number
): { width: number; height: number } {
  const width = TYPICAL_WIDTH_INCHES[getSignCategory(signType)] ?? TYPICAL_WIDTH_INCHES.generic;
  const aspect = planeWidth > 0 && planeHeight > 0 ? planeWidth / planeHeight : 1;
  return { width, height: width / aspect };
}

// Categories whose generated sign image has negative space around/between the sign
// elements (the wall would show through). For these the sign must be rendered on a
// removable background and matted out before compositing, so the gaps reveal the real
// (clean-plate) wall instead of an opaque gray panel.
//
// NOTE: acrylic_standoff is intentionally excluded. Its flat panel fills the plane
// edge-to-edge so no gap transparency is needed, and its chrome standoff caps and
// frosted/clear acrylic surface reflect/bleed the magenta background, causing the
// matte to partially key them out (purple blobs, blurry panel). It is warped whole.
const NEEDS_MATTE_CATEGORIES = new Set<SignCategory>([
  "channel_letters",
  "standoff_dimensional",
  "awning",
  "monument",
  "pylon",
  "blade_sign",
  "ada_sign",
]);

/**
 * Whether the generated sign for this type should be background-matted before compositing.
 * False for "fills-frame" types (light box, menu board, flat-applied vinyl, glass treatments,
 * generic) whose sign covers the placement region edge-to-edge — those are warped whole.
 */
export function needsBackgroundMatte(signType: string): boolean {
  return NEEDS_MATTE_CATEGORIES.has(getSignCategory(signType));
}

export function getSignCategory(signType: string): SignCategory {
  if (CHANNEL_LETTER_TYPES.has(signType)) return "channel_letters";
  if (STANDOFF_DIMENSIONAL_TYPES.has(signType)) return "standoff_dimensional";
  if (LIGHT_BOX_TYPES.has(signType)) return "light_box";
  if (AWNING_TYPES.has(signType)) return "awning";
  if (MONUMENT_TYPES.has(signType)) return "monument";
  if (PYLON_TYPES.has(signType)) return "pylon";
  if (BLADE_SIGN_TYPES.has(signType)) return "blade_sign";
  if (ACRYLIC_STANDOFF_TYPES.has(signType)) return "acrylic_standoff";
  if (MENU_BOARD_TYPES.has(signType)) return "menu_board";
  if (VEHICLE_TYPES.has(signType)) return "vehicle";
  if (FLAG_TYPES.has(signType)) return "flag_sign";
  if (ADA_SIGN_TYPES.has(signType)) return "ada_sign";
  if (PORTABLE_DISPLAY_TYPES.has(signType)) return "portable_display";
  if (FLAT_APPLIED_SIGN_TYPES.has(signType)) return "flat_applied";
  if (GLASS_TREATMENT_TYPES.has(signType)) return "glass_treatment";
  return "generic";
}
