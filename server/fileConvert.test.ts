import { PDFDocument, rgb } from "pdf-lib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { convertToPng, isConvertibleFile, isUnsupportedVectorFile } from "./fileConvert";

// Read a single RGBA pixel at (x, y).
async function rgba(buf: Buffer, x: number, y: number): Promise<[number, number, number, number]> {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const i = (y * info.width + x) * 4;
  return [data[i], data[i + 1], data[i + 2], data[i + 3]];
}

// A 1-page PDF with a blue rectangle in the center and a clear (empty) margin.
async function makePdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([100, 100]);
  page.drawRectangle({ x: 25, y: 25, width: 50, height: 50, color: rgb(0.1, 0.5, 0.9) });
  return Buffer.from(await doc.save());
}

describe("convertToPng", () => {
  it("rasterizes a PDF into a transparent-background PNG, preserving alpha", async () => {
    const result = await convertToPng(await makePdf(), "client-logo.pdf");

    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.filename).toMatch(/_converted\.png$/);
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);

    const meta = await sharp(result.buffer).metadata();
    expect(meta.format).toBe("png");
    expect(meta.hasAlpha).toBe(true);
    expect(meta.channels).toBe(4);

    // The empty margin stays fully transparent (logo composites cleanly).
    const [, , , cornerAlpha] = await rgba(result.buffer, 4, 4);
    expect(cornerAlpha).toBe(0);

    // The center carries the blue rectangle, fully opaque.
    const [r, g, b, a] = await rgba(
      result.buffer,
      Math.floor(result.width / 2),
      Math.floor(result.height / 2)
    );
    expect(a).toBe(255);
    expect(b).toBeGreaterThan(150);
    expect(r).toBeLessThan(120);
  });

  it("classifies PDF as convertible and not an unsupported vector format", () => {
    expect(isConvertibleFile("logo.pdf")).toBe(true);
    expect(isConvertibleFile("logo.PDF")).toBe(true);
    expect(isUnsupportedVectorFile("logo.pdf")).toBe(false);
    expect(isUnsupportedVectorFile("logo.ai")).toBe(true);
  });
});
