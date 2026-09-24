import OpenAI, { toFile } from "openai";
import fs from "node:fs";
import { Buffer } from "node:buffer";

export const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function generateImageBuffer(
  prompt: string,
  size: "1024x1024" | "1024x1536" | "1536x1024" = "1024x1024"
): Promise<Buffer> {
  const response = await openai.images.generate({
    model: "gpt-image-1",
    prompt,
    size,
  });
  const base64 = (response.data?.[0] as any)?.b64_json ?? "";
  return Buffer.from(base64, "base64");
}

export async function editImageBuffer(imageFiles: string[], prompt: string): Promise<Buffer> {
  const images = await Promise.all(
    imageFiles.map((file) => toFile(fs.createReadStream(file), file, { type: "image/png" }))
  );

  const response = await openai.images.edit({
    model: "gpt-image-1",
    image: images,
    prompt,
  });

  const imageBase64 = (response.data?.[0] as any)?.b64_json ?? "";
  return Buffer.from(imageBase64, "base64");
}
