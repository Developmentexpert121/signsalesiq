export const FULL_SCENE_ONLY_SIGN_TYPES = new Set<string>([
  "BANNER_STAND",
  "DIRECTORY",
  "MAGNETIC_SIGNS",
  "MENU_BOARDS",
  "STEP_AND_REPEAT_BACKDROP",
  "TABLE_THROW",
  "A_FRAME_SIGN",
  "CORO_YARD_SIGNS",
  "FEATHER_FLAG",
  "FLAG_SIGNS",
  "L_POSTS",
  "POLE_BANNERS",
  "REAL_ESTATE_SIGNS",
  "PARKING_SIGNS",
]);

export const isFullSceneOnly = (signType?: string | null): boolean =>
  !!signType && FULL_SCENE_ONLY_SIGN_TYPES.has(signType);
