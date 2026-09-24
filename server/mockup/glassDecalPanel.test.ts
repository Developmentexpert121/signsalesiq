import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("./uploadCache", () => ({ resolveUploadFileAsync: vi.fn() }));

import { buildGlassDecalPanel } from "./glassDecalPanel";
import { resolveUploadFileAsync } from "./uploadCache";

const mockResolve = vi.mocked(resolveUploadFileAsync);
const tmpFiles: string[] = [];

// Read a single RGBA pixel at (x, y).
async function rgba(buf: Buffer, x: number, y: number): Promise<[number, number, number, number]> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

beforeEach(() => {
  mockResolve.mockReset();
});

afterAll(() => {
  for (const f of tmpFiles) {
    try {
      fs.unlinkSync(f);
    } catch (_) {}
  }
});

describe("buildGlassDecalPanel", () => {
  it("fills the requested plane size with an opaque flat grey panel", async () => {
    mockResolve.mockResolvedValue(null);
    const buf = await buildGlassDecalPanel({ clientName: "", planeWidth: 200, planeHeight: 200 });

    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(200);
    expect(meta.height).toBe(200);

    // A point in the padding margin (clear of border, logo, and text) is the flat grey, fully opaque.
    const [r, g, b, a] = await rgba(buf, 12, 100);
    expect([r, g, b]).toEqual([168, 168, 168]);
    expect(a).toBe(255);
  });

  it("clamps tiny planes up to a minimum size", async () => {
    mockResolve.mockResolvedValue(null);
    const buf = await buildGlassDecalPanel({ clientName: "", planeWidth: 10, planeHeight: 5 });
    const meta = await sharp(buf).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(50);
  });

  it("composites the client logo centered on the grey panel", async () => {
    const logoPath = path.join(os.tmpdir(), `glass_decal_logo_${Date.now()}.png`);
    const red = await sharp({
      create: { width: 80, height: 80, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 1 } },
    })
      .png()
      .toBuffer();
    fs.writeFileSync(logoPath, red);
    tmpFiles.push(logoPath);
    mockResolve.mockResolvedValue(logoPath);

    const buf = await buildGlassDecalPanel({
      logoFilename: "logo.png",
      clientName: "Acme",
      planeWidth: 200,
      planeHeight: 200,
    });

    // Center carries the logo (red).
    const [r, g, b] = await rgba(buf, 100, 100);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(60);
    expect(b).toBeLessThan(60);

    // Padding margin around the logo stays flat grey.
    expect((await rgba(buf, 12, 100)).slice(0, 3)).toEqual([168, 168, 168]);
  });

  it("falls back to grey (no logo) when the logo cannot be resolved", async () => {
    mockResolve.mockResolvedValue(null);
    const buf = await buildGlassDecalPanel({
      logoFilename: "missing.png",
      clientName: "",
      planeWidth: 200,
      planeHeight: 200,
    });
    expect((await rgba(buf, 100, 100)).slice(0, 3)).toEqual([168, 168, 168]);
  });
});
