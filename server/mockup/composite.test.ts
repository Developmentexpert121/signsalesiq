import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("../logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock("./geminiClient", () => ({ callGeminiWithRetry: vi.fn() }));
vi.mock("./uploadCache", () => ({
  fileToBase64: vi.fn(),
  resolveUploadFileAsync: vi.fn(),
  makeOutputTempDir: vi.fn(),
}));

import { compositeSignOntoPhoto } from "./composite";

const W = 200;
const H = 200;
const tmpFiles: string[] = [];

// Canvas with a distinct value at every pixel, so we can assert byte-identity outside the quad.
async function makeCanvas(): Promise<Buffer> {
  const data = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      data[i] = (x * 7) % 256;
      data[i + 1] = (y * 5) % 256;
      data[i + 2] = (x + y) % 256;
    }
  }
  return sharp(data, { raw: { width: W, height: H, channels: 3 } })
    .png()
    .toBuffer();
}

async function makeRedSign(): Promise<Buffer> {
  const s = 100;
  const data = Buffer.alloc(s * s * 4);
  for (let i = 0; i < s * s; i++) {
    data[i * 4] = 255;
    data[i * 4 + 1] = 0;
    data[i * 4 + 2] = 0;
    data[i * 4 + 3] = 255;
  }
  return sharp(data, { raw: { width: s, height: s, channels: 4 } })
    .png()
    .toBuffer();
}

async function rgb(buf: Buffer, x: number, y: number): Promise<[number, number, number]> {
  const { data } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * W + x) * 3;
  return [data[i], data[i + 1], data[i + 2]];
}

afterAll(() => {
  for (const f of tmpFiles) {
    try {
      fs.unlinkSync(f);
    } catch (_) {}
  }
});

describe("compositeSignOntoPhoto", () => {
  it("leaves pixels outside the plane quad byte-identical to the original canvas", async () => {
    const canvas = await makeCanvas();
    const sign = await makeRedSign();
    const out = path.join(os.tmpdir(), `composite_test_${Date.now()}.png`);
    tmpFiles.push(out);

    // Axis-aligned quad covering the center.
    const planePoints = [
      { x: 50, y: 50 },
      { x: 150, y: 50 },
      { x: 150, y: 150 },
      { x: 50, y: 150 },
    ];

    await compositeSignOntoPhoto({
      canvasBuffer: canvas,
      signImageBuffer: sign,
      planePoints,
      outputPath: out,
    });
    const result = fs.readFileSync(out);

    // Outside the quad: identical to the original canvas pixel.
    for (const [x, y] of [
      [10, 10],
      [190, 190],
      [10, 190],
      [190, 10],
    ] as [number, number][]) {
      expect(await rgb(result, x, y)).toEqual(await rgb(canvas, x, y));
    }

    // Inside the quad center: the red sign was placed.
    const [r, g, b] = await rgb(result, 100, 100);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(60);
    expect(b).toBeLessThan(60);
  });
});
