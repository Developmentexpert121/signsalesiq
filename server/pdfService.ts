import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";
import fs from "fs";
import os from "os";
import path from "path";
import sharp from "sharp";
import type { Opportunity, Output, Tenant, SignSpec, Asset } from "@shared/schema";
import { BUDGET_LABELS, REQUIRED_FOOTER } from "@shared/schema";
import { isFullSceneOnly } from "@shared/fullSceneOnlySignTypes";
import { loadOutput, loadUpload, saveOutput } from "./objectStore";
import { selectSignSpecCanvasAsset } from "./signSpecIsolation";

import { logger } from "./logger";

/**
 * Object storage is authoritative. pdf-lib/sharp helpers below are path-based,
 * so inputs are materialized into an OS-temp cache on demand (transient cache,
 * not canonical storage).
 */
const PDF_TEMP_DIR = path.join(os.tmpdir(), "ssiq-pdf-cache");

async function resolveUploadFileAsync(filename: string): Promise<string | null> {
  if (!filename) return null;
  const safe = path.basename(filename);
  const cached = path.join(PDF_TEMP_DIR, safe);
  if (fs.existsSync(cached)) return cached;
  const buffer = await loadUpload(filename);
  if (!buffer) return null;
  fs.mkdirSync(PDF_TEMP_DIR, { recursive: true });
  fs.writeFileSync(cached, buffer);
  return cached;
}

async function resolveOutputFileAsync(oppId: string, filename: string): Promise<string | null> {
  if (!filename) return null;
  const safe = path.basename(filename);
  const cached = path.join(PDF_TEMP_DIR, oppId, safe);
  if (fs.existsSync(cached)) return cached;
  const buffer = await loadOutput(oppId, safe);
  if (!buffer) return null;
  fs.mkdirSync(path.join(PDF_TEMP_DIR, oppId), { recursive: true });
  fs.writeFileSync(cached, buffer);
  return cached;
}
const PDF_IMG_MAX_W = 1400;
const PDF_IMG_MAX_H = 1050;
const PDF_IMG_QUALITY = 82;

async function compressForPdf(
  filePath: string
): Promise<{ buf: Buffer; format: "jpg" | "png" } | null> {
  try {
    const img = sharp(filePath).rotate();
    const meta = await img.metadata();
    const w = meta.width ?? PDF_IMG_MAX_W;
    const h = meta.height ?? PDF_IMG_MAX_H;
    const needsResize = w > PDF_IMG_MAX_W || h > PDF_IMG_MAX_H;
    const hasAlpha = meta.hasAlpha;

    if (hasAlpha) {
      const buf = await sharp(filePath)
        .rotate()
        .resize(PDF_IMG_MAX_W, PDF_IMG_MAX_H, { fit: "inside", withoutEnlargement: true })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .jpeg({ quality: PDF_IMG_QUALITY, mozjpeg: true })
        .toBuffer();
      return { buf, format: "jpg" };
    }

    const buf = await sharp(filePath)
      .rotate()
      .resize(needsResize ? PDF_IMG_MAX_W : undefined, needsResize ? PDF_IMG_MAX_H : undefined, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: PDF_IMG_QUALITY, mozjpeg: true })
      .toBuffer();
    return { buf, format: "jpg" };
  } catch (err) {
    logger.warn({ err: err }, `[PDF] Warning: compressForPdf failed for ${filePath}:`);
    return null;
  }
}

async function convertToPngBuffer(filePath: string): Promise<Buffer | null> {
  try {
    return await sharp(filePath).png().toBuffer();
  } catch (err) {
    logger.warn({ err: err }, `[PDF] Warning: sharp failed to convert image to PNG: ${filePath}`);
    return null;
  }
}

function formatSignType(name: string): string {
  return name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function hexToRgb(hex: string | null | undefined, fallback: ReturnType<typeof rgb>) {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return fallback;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  return rgb(r, g, b);
}

function lightenColor(
  hex: string | null | undefined,
  amount: number,
  fallback: ReturnType<typeof rgb>
) {
  if (!hex || !/^#[0-9a-fA-F]{6}$/.test(hex)) return fallback;
  const r = Math.min(1, parseInt(hex.slice(1, 3), 16) / 255 + amount);
  const g = Math.min(1, parseInt(hex.slice(3, 5), 16) / 255 + amount);
  const b = Math.min(1, parseInt(hex.slice(5, 7), 16) / 255 + amount);
  return rgb(r, g, b);
}

const DEFAULT_BRAND = {
  primary: rgb(0.11, 0.27, 0.53),
  primaryLight: rgb(0.22, 0.42, 0.72),
  accent: rgb(0.0, 0.6, 0.53),
  warmGold: rgb(0.76, 0.6, 0.2),
  tierGood: rgb(0.13, 0.55, 0.42),
  tierBest: rgb(0.58, 0.42, 0.08),
  darkText: rgb(0.12, 0.14, 0.18),
  bodyText: rgb(0.22, 0.24, 0.28),
  mutedText: rgb(0.42, 0.44, 0.48),
  lightText: rgb(0.58, 0.6, 0.64),
  divider: rgb(0.88, 0.89, 0.92),
  bgLight: rgb(0.96, 0.97, 0.98),
  bgAccent: rgb(0.93, 0.96, 0.99),
  white: rgb(1, 1, 1),
};

function buildBrand(tenant?: Tenant) {
  const primary = hexToRgb(tenant?.pdfPrimaryColor, DEFAULT_BRAND.primary);
  const accent = hexToRgb(tenant?.pdfAccentColor, DEFAULT_BRAND.accent);
  const primaryLight = lightenColor(tenant?.pdfPrimaryColor, 0.15, DEFAULT_BRAND.primaryLight);
  const bgAccent = lightenColor(tenant?.pdfPrimaryColor, 0.78, DEFAULT_BRAND.bgAccent);
  return {
    ...DEFAULT_BRAND,
    primary,
    primaryLight,
    accent,
    tierBetter: primary,
    bgAccent,
  };
}

export async function generateProposalPDF(params: {
  opportunity: Opportunity;
  outputs: Output[];
  signTypeLabel?: string;
  tenant?: Tenant;
  salesperson?: { name: string; email: string; phone?: string | null };
  canvasFilename?: string;
  signSpecs?: SignSpec[];
  signTypeLabels?: Record<string, string>;
  signTypeShowCode?: Record<string, boolean>;
  assets?: Asset[];
}): Promise<{ filename: string; buffer: Buffer }> {
  const {
    opportunity,
    outputs,
    signTypeLabel,
    tenant,
    salesperson,
    canvasFilename,
    signSpecs,
    signTypeLabels,
    signTypeShowCode,
    assets,
  } = params;
  const enableGBBTiers = process.env.VITE_ENABLE_GBB_TIERS === "true";

  function buildSimpleNote(output: Output): string {
    const parts: string[] = [];
    if (opportunity.clientName) parts.push(`Client: ${opportunity.clientName}`);
    if (opportunity.address) parts.push(`Location: ${opportunity.address}`);
    if (output.selectedProducts.length > 0)
      parts.push(`Products: ${output.selectedProducts.join(", ")}`);
    if (opportunity.budgetRange)
      parts.push(`Budget: ${BUDGET_LABELS[opportunity.budgetRange] ?? opportunity.budgetRange}`);
    return parts.join(" · ");
  }

  const BRAND = buildBrand(tenant);
  const bannerText = tenant?.pdfBannerText || "SIGN CONCEPT RENDERING";
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  function addNewPage(): PDFPage {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
    return page;
  }

  function needsNewPage(requiredSpace: number) {
    if (y - requiredSpace < margin + 40) {
      addNewPage();
    }
  }

  function drawColorBar(pg: PDFPage, barY: number, barH: number, color = BRAND.primary) {
    pg.drawRectangle({ x: 0, y: barY, width: pageWidth, height: barH, color });
  }

  function drawText(
    text: string,
    options: {
      size?: number;
      font?: PDFFont;
      color?: any;
      maxWidth?: number;
      x?: number;
      lineHeight?: number;
    }
  ) {
    const sz = options.size ?? 10;
    const f = options.font ?? font;
    const c = options.color ?? BRAND.bodyText;
    const maxW = options.maxWidth ?? contentWidth;
    const startX = options.x ?? margin;
    const lh = options.lineHeight ?? sz + 4;

    const words = text.split(" ");
    let line = "";
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      const w = f.widthOfTextAtSize(testLine, sz);
      if (w > maxW && line) {
        needsNewPage(lh);
        page.drawText(line, { x: startX, y, size: sz, font: f, color: c });
        y -= lh;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      needsNewPage(lh);
      page.drawText(line, { x: startX, y, size: sz, font: f, color: c });
      y -= lh;
    }
  }

  function drawDivider(thickness = 0.75) {
    y -= 4;
    page.drawLine({
      start: { x: margin, y },
      end: { x: pageWidth - margin, y },
      thickness,
      color: BRAND.divider,
    });
    y -= 8;
  }

  function drawTierBadge(tierLabel: string, tierColor: any) {
    const badgeW = boldFont.widthOfTextAtSize(tierLabel, 11) + 24;
    const badgeH = 22;
    const badgeX = margin;
    const badgeY = y - badgeH + 6;

    page.drawRectangle({
      x: badgeX,
      y: badgeY,
      width: badgeW,
      height: badgeH,
      color: tierColor,
      borderColor: tierColor,
      borderWidth: 0,
    });
    page.drawRectangle({
      x: badgeX,
      y: badgeY,
      width: 4,
      height: badgeH,
      color: tierColor,
    });

    page.drawText(tierLabel, {
      x: badgeX + 12,
      y: badgeY + 6,
      size: 11,
      font: boldFont,
      color: BRAND.white,
    });

    page.drawLine({
      start: { x: badgeX + badgeW, y: badgeY + badgeH / 2 },
      end: { x: pageWidth - margin, y: badgeY + badgeH / 2 },
      thickness: 0.5,
      color: BRAND.divider,
    });

    y = badgeY - 8;
  }

  drawColorBar(page, pageHeight - 6, 6, BRAND.primary);
  drawColorBar(page, pageHeight - 8, 2, BRAND.accent);

  let logoEmbedded = false;
  if (tenant?.logoFilename) {
    try {
      const logoPath = await resolveUploadFileAsync(tenant.logoFilename);
      if (logoPath) {
        const logoCompressed = await compressForPdf(logoPath);
        const logoImg = logoCompressed
          ? await pdfDoc.embedJpg(logoCompressed.buf).catch(() => null)
          : null;
        if (logoImg) {
          const maxLogoH = 48;
          const maxLogoW = 140;
          const scale = Math.min(maxLogoW / logoImg.width, maxLogoH / logoImg.height, 1);
          const logoW = logoImg.width * scale;
          const logoH = logoImg.height * scale;
          page.drawImage(logoImg, { x: margin, y: y - logoH + 8, width: logoW, height: logoH });
          logoEmbedded = true;

          const textStartX = margin + logoW + 18;
          const textMaxW = pageWidth - margin - textStartX;
          const companyName = tenant.name || "SignSalesIQ";
          page.drawText(companyName, {
            x: textStartX,
            y: y,
            size: 18,
            font: boldFont,
            color: BRAND.primary,
          });
          let infoY = y - 16;
          const contactParts: string[] = [];
          if (tenant.address) contactParts.push(tenant.address);
          if (tenant.phone) contactParts.push(tenant.phone);
          if (tenant.email) contactParts.push(tenant.email);
          if (tenant.website) contactParts.push(tenant.website);
          if (contactParts.length > 0) {
            const contactLine = contactParts.join("  ·  ");
            const contactLines = wrapText(contactLine, font, 8.5, textMaxW);
            for (const cl of contactLines) {
              page.drawText(cl, {
                x: textStartX,
                y: infoY,
                size: 8.5,
                font,
                color: BRAND.mutedText,
              });
              infoY -= 11;
            }
          }
          y = Math.min(y - logoH - 10, infoY - 4);
        }
      }
    } catch {}
  }

  if (!logoEmbedded && tenant) {
    page.drawText(tenant.name || "SignSalesIQ", {
      x: margin,
      y,
      size: 22,
      font: boldFont,
      color: BRAND.primary,
    });
    y -= 20;
    const contactParts: string[] = [];
    if (tenant.address) contactParts.push(tenant.address);
    if (tenant.phone) contactParts.push(`Tel: ${tenant.phone}`);
    if (tenant.email) contactParts.push(tenant.email);
    if (tenant.website) contactParts.push(tenant.website);
    if (contactParts.length > 0) {
      drawText(contactParts.join("  ·  "), { size: 9, color: BRAND.mutedText });
    }
    y -= 4;
  } else if (!logoEmbedded) {
    page.drawText("SignSalesIQ", { x: margin, y, size: 22, font: boldFont, color: BRAND.primary });
    y -= 24;
  }

  if (tenant?.pdfHeaderText) {
    drawText(tenant.pdfHeaderText, { size: 8.5, font: italicFont, color: BRAND.mutedText });
  }

  y -= 4;
  page.drawRectangle({
    x: margin,
    y: y - 1,
    width: contentWidth,
    height: 2,
    color: BRAND.accent,
  });
  y -= 14;

  page.drawRectangle({
    x: margin,
    y: y - 38,
    width: contentWidth,
    height: 42,
    color: BRAND.primary,
  });
  page.drawText(bannerText, {
    x: margin + 16,
    y: y - 26,
    size: 22,
    font: boldFont,
    color: BRAND.white,
  });
  const dateStr = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const dateW = font.widthOfTextAtSize(dateStr, 9);
  page.drawText(dateStr, {
    x: pageWidth - margin - dateW - 16,
    y: y - 24,
    size: 9,
    font,
    color: rgb(0.75, 0.82, 0.95),
  });
  y -= 52;

  page.drawRectangle({
    x: margin,
    y: y - 60,
    width: contentWidth,
    height: 62,
    color: BRAND.bgLight,
  });

  const col1X = margin + 14;
  const col2X = margin + contentWidth / 2 + 10;
  const infoY = y - 4;

  page.drawText("CLIENT DETAILS", {
    x: col1X,
    y: infoY,
    size: 7,
    font: boldFont,
    color: BRAND.accent,
  });
  page.drawText(opportunity.clientName, {
    x: col1X,
    y: infoY - 14,
    size: 12,
    font: boldFont,
    color: BRAND.darkText,
  });
  if (opportunity.contactName) {
    page.drawText(`Contact: ${opportunity.contactName}`, {
      x: col1X,
      y: infoY - 28,
      size: 9,
      font,
      color: BRAND.bodyText,
    });
  }
  page.drawText(opportunity.address, {
    x: col1X,
    y: infoY - 40,
    size: 9,
    font,
    color: BRAND.bodyText,
  });

  page.drawText("CONTACT", { x: col2X, y: infoY, size: 7, font: boldFont, color: BRAND.accent });
  let contactInfoY = infoY - 14;
  if (opportunity.phone) {
    page.drawText(`Phone: ${opportunity.phone}`, {
      x: col2X,
      y: contactInfoY,
      size: 9,
      font,
      color: BRAND.bodyText,
    });
    contactInfoY -= 13;
  }
  if (opportunity.email) {
    page.drawText(`Email: ${opportunity.email}`, {
      x: col2X,
      y: contactInfoY,
      size: 9,
      font,
      color: BRAND.bodyText,
    });
    contactInfoY -= 13;
  }

  y -= 72;

  if (signSpecs && signSpecs.length > 0) {
    const signTypeNames = [
      ...Array.from(
        new Set(signSpecs.map((s) => signTypeLabels?.[s.signType] || formatSignType(s.signType)))
      ),
    ];
    drawText(`Sign Types: ${signTypeNames.join(", ")}`, {
      size: 9,
      font: boldFont,
      color: BRAND.bodyText,
    });
  } else {
    drawText(
      `${signTypeLabel || formatSignType(opportunity.signType)}  ·  ${opportunity.locationType}  ·  ${BUDGET_LABELS[opportunity.budgetRange]}  ·  ${opportunity.signDuration}`,
      { size: 9, color: BRAND.bodyText }
    );
  }
  y -= 2;

  if (salesperson) {
    const spParts: string[] = [salesperson.name];
    if (salesperson.email) spParts.push(salesperson.email);
    if (salesperson.phone) spParts.push(salesperson.phone);
    drawText(`Prepared by: ${spParts.join("  ·  ")}`, {
      size: 8.5,
      font: italicFont,
      color: BRAND.mutedText,
    });
  }

  drawDivider(1);

  const permitSignTypes =
    signSpecs
      ?.filter((s) => signTypeShowCode?.[s.signType] ?? s.showSignCode)
      .map((s) => signTypeLabels?.[s.signType] || formatSignType(s.signType)) || [];
  if (permitSignTypes.length > 0) {
    page.drawRectangle({
      x: margin,
      y: y - 16,
      width: contentWidth,
      height: 20,
      color: rgb(1.0, 0.97, 0.92),
    });
    page.drawRectangle({
      x: margin,
      y: y - 16,
      width: 3,
      height: 20,
      color: BRAND.warmGold,
    });
    page.drawText(`NOTICE: Sign permit required for: ${permitSignTypes.join(", ")}`, {
      x: margin + 10,
      y: y - 10,
      size: 8.5,
      font: boldFont,
      color: rgb(0.55, 0.4, 0.05),
    });
    y -= 26;
  } else if (signTypeShowCode?.[opportunity.signType] ?? opportunity.showSignCode) {
    page.drawRectangle({
      x: margin,
      y: y - 16,
      width: contentWidth,
      height: 20,
      color: rgb(1.0, 0.97, 0.92),
    });
    page.drawRectangle({
      x: margin,
      y: y - 16,
      width: 3,
      height: 20,
      color: BRAND.warmGold,
    });
    page.drawText("NOTICE: A sign permit will be required for this project.", {
      x: margin + 10,
      y: y - 10,
      size: 8.5,
      font: boldFont,
      color: rgb(0.55, 0.4, 0.05),
    });
    y -= 26;
  }

  async function embedImage(filePath: string): Promise<any> {
    try {
      if (!fs.existsSync(filePath)) {
        logger.warn(`[PDF] Warning: embedImage file not found: ${filePath}`);
        return null;
      }
      const compressed = await compressForPdf(filePath);
      if (compressed) {
        const embedded = await pdfDoc.embedJpg(compressed.buf).catch(() => null);
        if (embedded) return embedded;
      }
      logger.warn(`[PDF] Warning: could not compress/embed image: ${filePath}`);
      return null;
    } catch (err) {
      logger.warn({ err: err }, `[PDF] Warning: embedImage unexpected error for ${filePath}:`);
      return null;
    }
  }

  async function renderTierOutputs(tierOutputs: Output[], specCanvasImg: any) {
    const tiers = ["GOOD", "BETTER", "BEST"] as const;
    const tierConfig = {
      GOOD: { label: "Good Option", color: BRAND.tierGood },
      BETTER: { label: "Better Option", color: BRAND.tierBetter },
      BEST: { label: "Best Option", color: BRAND.tierBest },
    };

    for (const tier of tiers) {
      const output = tierOutputs.find((o) => o.tier === tier);
      if (!output) continue;

      needsNewPage(280);

      const config = tierConfig[tier];
      if (enableGBBTiers) drawTierBadge(config.label, config.color);

      if (output.selectedProducts.length > 0) {
        drawText(`Products: ${output.selectedProducts.join(", ")}`, {
          size: 9,
          color: BRAND.mutedText,
        });
      }
      y -= 4;

      const mockupFilename = output.aiMockupFilename || output.baselineImageFilename;
      let mockupImg: any = null;
      if (mockupFilename) {
        const basename = path.basename(mockupFilename);
        const resolvedMockupPath = await resolveOutputFileAsync(opportunity.id, basename);
        if (resolvedMockupPath) {
          mockupImg = await embedImage(resolvedMockupPath);
        }
        if (!mockupImg) {
          logger.warn(
            `[PDF] Warning: Could not embed mockup image: ${mockupFilename} (basename: ${basename})`
          );
        }
      } else {
        logger.warn(
          `[PDF] Warning: Output ${output.id} (tier=${output.tier}) has no mockup filename`
        );
      }

      if (specCanvasImg && mockupImg) {
        const colWidth = (contentWidth - 12) / 2;
        const maxImgH = 200;

        const canvasScale = Math.min(
          colWidth / specCanvasImg.width,
          maxImgH / specCanvasImg.height,
          1
        );
        const canvasW = Math.min(specCanvasImg.width * canvasScale, colWidth);
        const canvasH = Math.min(specCanvasImg.height * canvasScale, maxImgH);

        const mockupScale = Math.min(colWidth / mockupImg.width, maxImgH / mockupImg.height, 1);
        const mockupW = Math.min(mockupImg.width * mockupScale, colWidth);
        const mockupH = Math.min(mockupImg.height * mockupScale, maxImgH);

        const rowH = Math.max(canvasH, mockupH);
        needsNewPage(rowH + 24);

        page.drawRectangle({
          x: margin - 2,
          y: y - rowH - 4,
          width: colWidth + 6,
          height: rowH + 6,
          color: BRAND.bgLight,
        });
        page.drawRectangle({
          x: margin + colWidth + 8,
          y: y - rowH - 4,
          width: colWidth + 6,
          height: rowH + 6,
          color: BRAND.bgLight,
        });

        y -= rowH;
        page.drawImage(specCanvasImg, {
          x: margin,
          y: y + (rowH - canvasH),
          width: canvasW,
          height: canvasH,
        });
        page.drawImage(mockupImg, {
          x: margin + colWidth + 12,
          y: y + (rowH - mockupH),
          width: mockupW,
          height: mockupH,
        });
        y -= 4;

        page.drawText("Original Photo", {
          x: margin,
          y,
          size: 7,
          font: boldFont,
          color: BRAND.lightText,
        });
        page.drawText("Sign Mockup", {
          x: margin + colWidth + 12,
          y,
          size: 7,
          font: boldFont,
          color: BRAND.lightText,
        });
        y -= 14;
      } else if (mockupImg) {
        const maxImgW = contentWidth;
        const scale = Math.min(maxImgW / mockupImg.width, 250 / mockupImg.height, 1);
        const imgW = mockupImg.width * scale;
        const imgH = mockupImg.height * scale;

        needsNewPage(imgH + 20);

        page.drawRectangle({
          x: margin - 2,
          y: y - imgH - 4,
          width: imgW + 4,
          height: imgH + 6,
          color: BRAND.bgLight,
        });

        y -= imgH;
        page.drawImage(mockupImg, { x: margin, y, width: imgW, height: imgH });
        y -= 4;
        page.drawText("Sign Mockup", {
          x: margin,
          y,
          size: 7,
          font: boldFont,
          color: BRAND.lightText,
        });
        y -= 14;
      } else if (specCanvasImg) {
        const maxImgW = contentWidth * 0.6;
        const scale = Math.min(maxImgW / specCanvasImg.width, 200 / specCanvasImg.height, 1);
        const imgW = specCanvasImg.width * scale;
        const imgH = specCanvasImg.height * scale;

        needsNewPage(imgH + 20);
        y -= imgH;
        page.drawImage(specCanvasImg, { x: margin, y, width: imgW, height: imgH });
        y -= 4;
        page.drawText("Site Photo", {
          x: margin,
          y,
          size: 7,
          font: boldFont,
          color: BRAND.lightText,
        });
        y -= 14;
      }

      {
        const noteText = enableGBBTiers
          ? output.rationaleText && !output.rationaleText.includes("FAILED")
            ? output.rationaleText
            : null
          : buildSimpleNote(output);
        if (noteText) {
          page.drawRectangle({
            x: margin,
            y: y - 2,
            width: 3,
            height: 2,
            color: enableGBBTiers ? config.color : BRAND.primaryLight,
          });
          drawText("Project Notes", {
            size: 8,
            font: boldFont,
            color: BRAND.darkText,
            x: margin + 8,
          });
          const noteLines = wrapText(noteText, font, 8.5, contentWidth - 8);
          for (const nl of noteLines) {
            needsNewPage(12);
            page.drawText(nl, { x: margin + 8, y, size: 8.5, font, color: BRAND.bodyText });
            y -= 12;
          }
        }
      }

      y -= 8;
      drawDivider(0.5);
    }
  }

  if (signSpecs && signSpecs.length > 0) {
    for (const spec of signSpecs) {
      const specOutputs = outputs.filter((o) => o.signSpecId === spec.id);
      if (specOutputs.length === 0) continue;

      needsNewPage(200);

      const stLabel = signTypeLabels?.[spec.signType] || formatSignType(spec.signType);

      page.drawRectangle({
        x: margin,
        y: y - 24,
        width: contentWidth,
        height: 28,
        color: BRAND.bgAccent,
      });
      page.drawRectangle({
        x: margin,
        y: y - 24,
        width: 4,
        height: 28,
        color: BRAND.primaryLight,
      });
      page.drawText(stLabel, {
        x: margin + 14,
        y: y - 16,
        size: 13,
        font: boldFont,
        color: BRAND.primary,
      });
      y -= 34;

      drawText(
        `${spec.locationType}  ·  Budget: ${BUDGET_LABELS[spec.budgetRange]}  ·  Duration: ${spec.signDuration}`,
        {
          size: 9,
          color: BRAND.mutedText,
        }
      );
      y -= 4;

      // A spec shows ONLY its own linked site photo (spec.canvasAssetId). It must
      // never borrow the opportunity-level "latest CANVAS" — in the per-spec model
      // that is always some other spec's photo (or one that was cleared), which is
      // exactly how a full-scene-only spec (yard signs, flags, A-frames) or any
      // photo-less spec ended up displaying a sibling's "Original Photo".
      let specCanvasImg: any = null;
      if (assets) {
        const canvasAsset = selectSignSpecCanvasAsset(spec, assets);
        if (canvasAsset?.filename) {
          const canvasPath = await resolveUploadFileAsync(canvasAsset.filename);
          if (canvasPath) {
            specCanvasImg = await embedImage(canvasPath);
            if (!specCanvasImg)
              logger.warn(
                `[PDF] Warning: Could not embed spec canvas image: ${canvasAsset.filename} (resolved: ${canvasPath})`
              );
          } else {
            logger.warn(
              `[PDF] Warning: Could not resolve spec canvas file: ${canvasAsset.filename}`
            );
          }
        }
      }

      await renderTierOutputs(specOutputs, specCanvasImg);
    }

    const unlinkedOutputs = outputs.filter((o) => !o.signSpecId);
    if (unlinkedOutputs.length > 0) {
      let fallbackCanvasImg: any = null;
      if (canvasFilename && !isFullSceneOnly(opportunity.signType)) {
        const canvasPath = await resolveUploadFileAsync(canvasFilename);
        if (canvasPath) {
          fallbackCanvasImg = await embedImage(canvasPath);
          if (!fallbackCanvasImg)
            logger.warn(
              `[PDF] Warning: Could not embed fallback canvas image: ${canvasFilename} (resolved: ${canvasPath})`
            );
        } else {
          logger.warn(`[PDF] Warning: Could not resolve fallback canvas file: ${canvasFilename}`);
        }
      }
      await renderTierOutputs(unlinkedOutputs, fallbackCanvasImg);
    }
  } else {
    let canvasImg: any = null;
    if (canvasFilename && !isFullSceneOnly(opportunity.signType)) {
      const canvasPath = await resolveUploadFileAsync(canvasFilename);
      if (canvasPath) {
        canvasImg = await embedImage(canvasPath);
        if (!canvasImg)
          logger.warn(
            `[PDF] Warning: Could not embed canvas image: ${canvasFilename} (resolved: ${canvasPath})`
          );
      } else {
        logger.warn(`[PDF] Warning: Could not resolve canvas file: ${canvasFilename}`);
      }
    }
    await renderTierOutputs(outputs, canvasImg);
  }

  const allPages = pdfDoc.getPages();
  for (const pg of allPages) {
    pg.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 6, color: BRAND.primary });
    pg.drawRectangle({ x: 0, y: 6, width: pageWidth, height: 2, color: BRAND.accent });

    if (tenant?.pdfFooterText) {
      const footerLines = wrapText(tenant.pdfFooterText, font, 7, contentWidth);
      let fy = 42 + (footerLines.length - 1) * 9;
      for (const fl of footerLines) {
        pg.drawText(fl, { x: margin, y: fy, size: 7, font, color: BRAND.mutedText });
        fy -= 9;
      }
    }

    pg.drawLine({
      start: { x: margin, y: 38 },
      end: { x: pageWidth - margin, y: 38 },
      thickness: 0.5,
      color: BRAND.divider,
    });

    const DISCLAIMER =
      "Disclaimer: This visual is a conceptual representation provided by AI to illustrate design intent. The final manufactured product may differ in appearance, material finish, and scale based on finalized budget and site requirements.";
    const disclaimerLines = wrapText(DISCLAIMER, italicFont, 6, contentWidth);
    let dy = 30;
    for (const dl of disclaimerLines) {
      pg.drawText(dl, { x: margin, y: dy, size: 6, font: italicFont, color: BRAND.lightText });
      dy -= 8;
    }

    const noteLines = wrapText(REQUIRED_FOOTER, font, 6, contentWidth);
    for (const nl of noteLines) {
      pg.drawText(nl, { x: margin, y: dy, size: 6, font, color: BRAND.lightText });
      dy -= 8;
    }
  }

  const pdfBytes = await pdfDoc.save();
  const buffer = Buffer.from(pdfBytes);
  const filename = `proposal_${Date.now()}.pdf`;
  await saveOutput(opportunity.id, filename, buffer, "application/pdf");

  return { filename, buffer };
}

function wrapText(text: string, f: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (f.widthOfTextAtSize(testLine, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);
  return lines;
}
