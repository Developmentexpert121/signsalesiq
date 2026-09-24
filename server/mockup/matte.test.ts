import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { extractSignMatte } from "./matte";

const W = 100;
const H = 100;
const MAGENTA: [number, number, number] = [255, 0, 255];

// Build an RGB PNG: background color with optional filled rectangles of another color.
async function makeImage(
  bg: [number, number, number],
  rects: { x0: number; y0: number; x1: number; y1: number; color: [number, number, number] }[]
): Promise<Buffer> {
  const data = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let c = bg;
      for (const r of rects) {
        if (x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1) c = r.color;
      }
      const i = (y * W + x) * 3;
      data[i] = c[0];
      data[i + 1] = c[1];
      data[i + 2] = c[2];
    }
  }
  return sharp(data, { raw: { width: W, height: H, channels: 3 } })
    .png()
    .toBuffer();
}

async function alphaAt(buf: Buffer, x: number, y: number): Promise<number> {
  const { data } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return data[(y * W + x) * 4 + 3];
}

describe("extractSignMatte", () => {
  it("keys magenta to transparent and keeps the sign opaque", async () => {
    const img = await makeImage(MAGENTA, [{ x0: 30, y0: 30, x1: 70, y1: 70, color: [10, 10, 10] }]);
    const matte = await extractSignMatte(img);
    expect(matte).not.toBeNull();
    if (!matte) throw new Error("expected a matte buffer");
    expect(await alphaAt(matte, 50, 50)).toBe(255); // inside the black sign
    expect(await alphaAt(matte, 5, 5)).toBe(0); // magenta corner
  });

  it("keeps negative space between sign elements transparent (the wall shows through gaps)", async () => {
    // Two black bars with a magenta gap between them — like the space between letters.
    const img = await makeImage(MAGENTA, [
      { x0: 20, y0: 30, x1: 40, y1: 70, color: [10, 10, 10] },
      { x0: 60, y0: 30, x1: 80, y1: 70, color: [10, 10, 10] },
    ]);
    const matte = await extractSignMatte(img);
    expect(matte).not.toBeNull();
    if (!matte) throw new Error("expected a matte buffer");
    expect(await alphaAt(matte, 30, 50)).toBe(255); // left bar
    expect(await alphaAt(matte, 70, 50)).toBe(255); // right bar
    expect(await alphaAt(matte, 50, 50)).toBe(0); // magenta gap between bars
  });

  it("does not key out red/blue/white sign colors", async () => {
    const img = await makeImage(MAGENTA, [
      { x0: 10, y0: 40, x1: 30, y1: 60, color: [255, 0, 0] }, // red
      { x0: 40, y0: 40, x1: 60, y1: 60, color: [0, 0, 255] }, // blue
      { x0: 70, y0: 40, x1: 90, y1: 60, color: [255, 255, 255] }, // white
    ]);
    const matte = await extractSignMatte(img);
    expect(matte).not.toBeNull();
    if (!matte) throw new Error("expected a matte buffer");
    expect(await alphaAt(matte, 20, 50)).toBe(255); // red kept
    expect(await alphaAt(matte, 50, 50)).toBe(255); // blue kept
    expect(await alphaAt(matte, 80, 50)).toBe(255); // white kept
  });

  it("returns null when there is no magenta field (model ignored the chroma instruction)", async () => {
    const img = await makeImage(
      [128, 128, 128],
      [{ x0: 30, y0: 30, x1: 70, y1: 70, color: [10, 10, 10] }]
    );
    const matte = await extractSignMatte(img);
    expect(matte).toBeNull();
  });
});
