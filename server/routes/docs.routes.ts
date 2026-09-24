import type { Express, Request, Response } from "express";

import { logger } from "../logger";
export function registerDocsRoutes(app: Express) {
  app.get("/api/docs/:docName", async (req: Request, res: Response) => {
    try {
      const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
      const fs = await import("fs");
      const pathMod = await import("path");

      const docMap: Record<string, { file: string; title: string }> = {
        "user-manual": { file: "docs/USER_MANUAL.md", title: "SignSalesIQ - User Manual" },
        "super-admin-manual": {
          file: "docs/MANUAL_SUPER_ADMIN.md",
          title: "SignSalesIQ - Super Admin Manual",
        },
        "owner-admin-manual": {
          file: "docs/MANUAL_OWNER_ADMIN.md",
          title: "SignSalesIQ - Owner Admin Manual",
        },
        "sales-user-manual": {
          file: "docs/MANUAL_SALES_USER.md",
          title: "SignSalesIQ - Sales User Manual",
        },
        "developer-guide": {
          file: "docs/DEVELOPER_PRODUCTION_GUIDE.md",
          title: "SignSalesIQ - Developer Production Guide",
        },
      };

      const doc = docMap[req.params.docName as string];
      if (!doc) return res.status(404).json({ message: "Document not found" });

      const filePath = pathMod.default.join(process.cwd(), doc.file);
      if (!fs.default.existsSync(filePath))
        return res.status(404).json({ message: "Document file not found" });

      const markdown = fs.default.readFileSync(filePath, "utf-8");
      const lines = markdown.split("\n");

      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const monoFont = await pdfDoc.embedFont(StandardFonts.Courier);

      const pageWidth = 612;
      const pageHeight = 792;
      const margin = 50;
      const maxTextWidth = pageWidth - margin * 2;

      let page = pdfDoc.addPage([pageWidth, pageHeight]);
      let y = pageHeight - margin;

      const newPageIfNeeded = (needed: number) => {
        if (y < margin + needed) {
          page = pdfDoc.addPage([pageWidth, pageHeight]);
          y = pageHeight - margin;
        }
      };

      const wrapAndDraw = (
        text: string,
        fontSize: number,
        usedFont: any,
        color: any,
        indent: number = 0
      ) => {
        const words = text.split(" ");
        let line = "";
        const lineHeight = fontSize + 4;
        const availWidth = maxTextWidth - indent;

        for (const word of words) {
          const testLine = line ? `${line} ${word}` : word;
          const w = usedFont.widthOfTextAtSize(testLine, fontSize);
          if (w > availWidth && line) {
            newPageIfNeeded(lineHeight);
            page.drawText(line, { x: margin + indent, y, size: fontSize, font: usedFont, color });
            y -= lineHeight;
            line = word;
          } else {
            line = testLine;
          }
        }
        if (line) {
          newPageIfNeeded(lineHeight);
          page.drawText(line, { x: margin + indent, y, size: fontSize, font: usedFont, color });
          y -= lineHeight;
        }
      };

      const black = rgb(0.1, 0.1, 0.1);
      const blue = rgb(0.15, 0.35, 0.7);
      const gray = rgb(0.35, 0.35, 0.35);
      const lightGray = rgb(0.5, 0.5, 0.5);

      let inCodeBlock = false;

      const sanitizeForPdf = (text: string): string => {
        return text.replace(/[^\x20-\x7E\t\n\r]/g, (ch) => {
          const cp = ch.codePointAt(0) || 0;
          if (cp >= 0x2018 && cp <= 0x201d) return '"';
          if (cp === 0x2013 || cp === 0x2014) return "-";
          if (cp === 0x2026) return "...";
          if (cp === 0x2022) return "-";
          return "";
        });
      };

      for (const rawLine of lines) {
        const line = sanitizeForPdf(rawLine.trimEnd());

        if (line.startsWith("```")) {
          inCodeBlock = !inCodeBlock;
          if (inCodeBlock) y -= 4;
          else y -= 4;
          continue;
        }

        if (inCodeBlock) {
          newPageIfNeeded(12);
          const codeText = line.length > 90 ? line.substring(0, 87) + "..." : line;
          if (codeText.trim()) {
            page.drawText(codeText || " ", {
              x: margin + 10,
              y,
              size: 7.5,
              font: monoFont,
              color: gray,
            });
          }
          y -= 11;
          continue;
        }

        if (line.trim() === "") {
          y -= 6;
          continue;
        }

        if (line.startsWith("# ")) {
          newPageIfNeeded(40);
          y -= 10;
          wrapAndDraw(line.substring(2), 20, boldFont, blue);
          y -= 6;
          page.drawLine({
            start: { x: margin, y: y + 2 },
            end: { x: pageWidth - margin, y: y + 2 },
            thickness: 1.5,
            color: blue,
          });
          y -= 10;
        } else if (line.startsWith("## ")) {
          newPageIfNeeded(30);
          y -= 8;
          wrapAndDraw(line.substring(3), 15, boldFont, blue);
          y -= 2;
          page.drawLine({
            start: { x: margin, y: y + 2 },
            end: { x: pageWidth - margin, y: y + 2 },
            thickness: 0.5,
            color: rgb(0.8, 0.8, 0.8),
          });
          y -= 6;
        } else if (line.startsWith("### ")) {
          newPageIfNeeded(24);
          y -= 6;
          wrapAndDraw(line.substring(4), 12, boldFont, rgb(0.2, 0.2, 0.2));
          y -= 2;
        } else if (line.startsWith("#### ")) {
          newPageIfNeeded(20);
          y -= 4;
          wrapAndDraw(line.substring(5), 11, boldFont, rgb(0.25, 0.25, 0.25));
          y -= 2;
        } else if (line.trim().startsWith("| ") && line.trim().endsWith("|")) {
          if (line.includes("---")) continue;
          const cells = line
            .split("|")
            .filter((c) => c.trim())
            .map((c) => c.trim());
          const isHeader = lines[lines.indexOf(rawLine) + 1]?.includes("---");
          newPageIfNeeded(14);
          const cellFont = isHeader ? boldFont : font;
          const cellSize = 8;
          const colWidth = maxTextWidth / Math.max(cells.length, 1);
          cells.forEach((cell, i) => {
            const cleanCell = cell.replace(/\*\*/g, "");
            let truncated = cleanCell;
            if (cellFont.widthOfTextAtSize(truncated, cellSize) > colWidth - 8) {
              while (
                truncated.length > 3 &&
                cellFont.widthOfTextAtSize(truncated + "...", cellSize) > colWidth - 8
              ) {
                truncated = truncated.substring(0, truncated.length - 1);
              }
              truncated += "...";
            }
            page.drawText(truncated, {
              x: margin + i * colWidth + 4,
              y,
              size: cellSize,
              font: cellFont,
              color: black,
            });
          });
          y -= 13;
        } else if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
          const indent = line.search(/\S/);
          const bulletIndent = Math.min(indent, 4) * 5;
          const text = line
            .trim()
            .substring(2)
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .replace(/`(.*?)`/g, "$1");
          newPageIfNeeded(14);
          page.drawText("-", { x: margin + bulletIndent, y, size: 9, font, color: black });
          wrapAndDraw(text, 9.5, font, black, bulletIndent + 12);
        } else if (/^\d+\.\s/.test(line.trim())) {
          const match = line.trim().match(/^(\d+)\.\s(.*)/);
          if (match) {
            const num = match[1];
            const text = match[2].replace(/\*\*(.*?)\*\*/g, "$1").replace(/`(.*?)`/g, "$1");
            newPageIfNeeded(14);
            page.drawText(`${num}.`, { x: margin, y, size: 9.5, font: boldFont, color: black });
            wrapAndDraw(text, 9.5, font, black, 16);
          }
        } else if (line.trim().startsWith("> ")) {
          const text = line
            .trim()
            .substring(2)
            .replace(/\*\*(.*?)\*\*/g, "$1");
          newPageIfNeeded(14);
          page.drawLine({
            start: { x: margin + 4, y: y + 4 },
            end: { x: margin + 4, y: y - 10 },
            thickness: 2,
            color: rgb(0.8, 0.8, 0.85),
          });
          wrapAndDraw(text, 9, font, lightGray, 14);
        } else {
          const text = line
            .replace(/\*\*(.*?)\*\*/g, "$1")
            .replace(/`(.*?)`/g, "$1")
            .replace(/\[(.*?)\]\(.*?\)/g, "$1");
          wrapAndDraw(text, 9.5, font, black);
        }
      }

      const pdfBytes = await pdfDoc.save();
      const filenameMap: Record<string, string> = {
        "user-manual": "SignSalesIQ_User_Manual.pdf",
        "super-admin-manual": "SignSalesIQ_Super_Admin_Manual.pdf",
        "owner-admin-manual": "SignSalesIQ_Owner_Admin_Manual.pdf",
        "sales-user-manual": "SignSalesIQ_Sales_User_Manual.pdf",
        "developer-guide": "SignSalesIQ_Developer_Guide.pdf",
      };
      const filename = filenameMap[req.params.docName as string] || "SignSalesIQ_Document.pdf";
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBytes.length.toString(),
      });
      res.send(Buffer.from(pdfBytes));
    } catch (err: any) {
      logger.error("Error generating doc PDF:", err);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  app.get("/api/templates/sample-pdf", async (_req: Request, res: Response) => {
    try {
      const { PDFDocument, rgb, StandardFonts } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      const italicFont = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

      const pageWidth = 612;
      const pageHeight = 792;
      const margin = 48;
      const contentW = pageWidth - margin * 2;

      const primary = rgb(0.11, 0.27, 0.53);
      const accent = rgb(0.0, 0.6, 0.53);
      const guideColor = rgb(0.78, 0.8, 0.84);
      const labelColor = rgb(0.45, 0.47, 0.52);
      const darkText = rgb(0.12, 0.14, 0.18);
      const bgLight = rgb(0.96, 0.97, 0.98);
      const white = rgb(1, 1, 1);

      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      page.drawRectangle({ x: 0, y: pageHeight - 6, width: pageWidth, height: 6, color: primary });
      page.drawRectangle({ x: 0, y: pageHeight - 8, width: pageWidth, height: 2, color: accent });

      let y = pageHeight - margin;

      page.drawRectangle({ x: margin, y: y - 60, width: contentW, height: 64, color: bgLight });

      const logoBoxW = 60;
      const logoBoxH = 44;
      const logoX = margin + 12;
      const logoY = y - 52;
      page.drawRectangle({
        x: logoX,
        y: logoY,
        width: logoBoxW,
        height: logoBoxH,
        borderColor: guideColor,
        borderWidth: 0.75,
        borderDashArray: [4, 3],
      });
      page.drawText("LOGO", {
        x: logoX + 17,
        y: logoY + 17,
        size: 10,
        font: boldFont,
        color: labelColor,
      });

      const textX = logoX + logoBoxW + 18;
      page.drawText("Your Company Name", {
        x: textX,
        y: y - 10,
        size: 18,
        font: boldFont,
        color: primary,
      });
      page.drawText("Address  ·  Phone  ·  Email  ·  Website", {
        x: textX,
        y: y - 26,
        size: 8.5,
        font,
        color: labelColor,
      });
      page.drawText("Custom Header Text Area", {
        x: textX,
        y: y - 40,
        size: 8,
        font: italicFont,
        color: labelColor,
      });
      y -= 70;

      page.drawRectangle({ x: margin, y: y - 1, width: contentW, height: 2, color: accent });
      y -= 14;

      page.drawRectangle({ x: margin, y: y - 38, width: contentW, height: 42, color: primary });
      page.drawText("SIGN CONCEPT RENDERING", {
        x: margin + 16,
        y: y - 26,
        size: 22,
        font: boldFont,
        color: white,
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

      page.drawRectangle({ x: margin, y: y - 52, width: contentW, height: 55, color: bgLight });
      const col1X = margin + 14;
      const col2X = margin + contentW / 2 + 10;
      page.drawText("CLIENT DETAILS", {
        x: col1X,
        y: y - 4,
        size: 7,
        font: boldFont,
        color: accent,
      });
      page.drawText("[Client Name]", {
        x: col1X,
        y: y - 18,
        size: 12,
        font: boldFont,
        color: darkText,
      });
      page.drawText("[Address]", { x: col1X, y: y - 32, size: 9, font, color: labelColor });
      page.drawText("CONTACT", { x: col2X, y: y - 4, size: 7, font: boldFont, color: accent });
      page.drawText("Phone: [Phone]", { x: col2X, y: y - 18, size: 9, font, color: labelColor });
      page.drawText("Email: [Email]", { x: col2X, y: y - 32, size: 9, font, color: labelColor });
      y -= 60;

      page.drawText(
        "Sign Type: [Type]  ·  Location: [Type]  ·  Budget: [Range]  ·  Duration: [Duration]",
        {
          x: margin,
          y,
          size: 9,
          font,
          color: labelColor,
        }
      );
      y -= 14;
      page.drawText("Prepared by: [Salesperson Name]  ·  [Email]  ·  [Phone]", {
        x: margin,
        y,
        size: 8.5,
        font: italicFont,
        color: labelColor,
      });
      y -= 12;
      page.drawLine({
        start: { x: margin, y },
        end: { x: pageWidth - margin, y },
        thickness: 0.75,
        color: guideColor,
      });
      y -= 16;

      const tierConfigs = [
        { label: "Good Option", color: rgb(0.13, 0.55, 0.42) },
        { label: "Better Option", color: primary },
        { label: "Best Option", color: rgb(0.58, 0.42, 0.08) },
      ];

      const mockupBoxH = 100;

      for (const tc of tierConfigs) {
        if (y - mockupBoxH - 60 < margin + 50) break;

        const badgeW = boldFont.widthOfTextAtSize(tc.label, 11) + 24;
        const badgeH = 22;
        page.drawRectangle({
          x: margin,
          y: y - badgeH + 6,
          width: badgeW,
          height: badgeH,
          color: tc.color,
        });
        page.drawText(tc.label, {
          x: margin + 12,
          y: y - badgeH + 12,
          size: 11,
          font: boldFont,
          color: white,
        });
        page.drawLine({
          start: { x: margin + badgeW, y: y - badgeH / 2 + 6 },
          end: { x: pageWidth - margin, y: y - badgeH / 2 + 6 },
          thickness: 0.5,
          color: guideColor,
        });
        y -= badgeH + 4;

        page.drawText("Products: [Selected Products]", {
          x: margin,
          y,
          size: 9,
          font,
          color: labelColor,
        });
        y -= 14;

        page.drawRectangle({
          x: margin,
          y: y - mockupBoxH,
          width: contentW,
          height: mockupBoxH,
          borderColor: guideColor,
          borderWidth: 0.75,
          borderDashArray: [6, 4],
          color: bgLight,
        });
        const centerX = margin + contentW / 2;
        const centerY = y - mockupBoxH / 2;
        page.drawText("Mockup Photo Area", {
          x: centerX - boldFont.widthOfTextAtSize("Mockup Photo Area", 12) / 2,
          y: centerY + 6,
          size: 12,
          font: boldFont,
          color: labelColor,
        });
        page.drawText(`(${contentW.toFixed(0)} x ${mockupBoxH} pts)`, {
          x:
            centerX - font.widthOfTextAtSize(`(${contentW.toFixed(0)} x ${mockupBoxH} pts)`, 8) / 2,
          y: centerY - 10,
          size: 8,
          font,
          color: labelColor,
        });
        y -= mockupBoxH + 6;

        page.drawRectangle({ x: margin, y: y - 1, width: 3, height: 2, color: tc.color });
        page.drawText("Project Notes: [Notes text]", {
          x: margin + 8,
          y,
          size: 8,
          font: italicFont,
          color: labelColor,
        });
        y -= 18;
      }

      page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: 6, color: primary });
      page.drawRectangle({ x: 0, y: 6, width: pageWidth, height: 2, color: accent });
      page.drawLine({
        start: { x: margin, y: 38 },
        end: { x: pageWidth - margin, y: 38 },
        thickness: 0.5,
        color: guideColor,
      });
      page.drawText("Footer Area: Custom footer text, company tagline, terms, or contact info", {
        x: margin,
        y: 44,
        size: 7,
        font,
        color: labelColor,
      });
      page.drawText("Required disclaimer text is always included automatically on every page.", {
        x: margin,
        y: 28,
        size: 6,
        font: italicFont,
        color: guideColor,
      });

      const pdfBytes = await pdfDoc.save();
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "attachment; filename=sample-template.pdf");
      res.send(Buffer.from(pdfBytes));
    } catch (err: any) {
      logger.error("Sample PDF generation error:", err);
      res.status(500).json({ message: "Failed to generate sample PDF" });
    }
  });
}
