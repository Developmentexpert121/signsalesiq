export function isConfigured(): boolean {
  return !!(process.env.FIREFLY_CLIENT_ID && process.env.FIREFLY_CLIENT_SECRET);
}

export async function renderTier(params: {
  canvasFilename: string;
  compositeFilename: string;
  planePoints: { x: number; y: number }[];
  tier: string;
  opportunityId: string;
}): Promise<string> {
  if (!isConfigured()) {
    throw new Error(
      "Adobe Firefly is not configured. Set FIREFLY_CLIENT_ID and FIREFLY_CLIENT_SECRET environment variables."
    );
  }

  throw new Error(
    "Adobe Firefly integration is configured but the API implementation requires valid credentials. " +
      "This is a stub that will be replaced with the actual Firefly API call. " +
      "The deterministic composite has been generated successfully as the primary output."
  );
}
