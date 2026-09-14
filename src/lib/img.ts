import sharp from "sharp";
import { CONFIG, PLACEHOLDER_GIF } from "./config";
import type { GatewaySettings } from "@/db/schema";

export interface ImageOut {
  body: Buffer;
  contentType: string;
  note: string;
}

/**
 * Old WebKit (iOS 9) understands: JPEG, PNG, GIF, SVG, TIFF, BMP.
 * It does NOT understand: WebP, AVIF, ICO cur variants beyond 16px... and
 * it will happily OOM on a 24MP progressive JPEG on a 512/1024MB device.
 *
 * So every bitmap is decoded server-side and re-encoded to JPEG/PNG capped
 * at a sane width. Animated GIFs and SVGs pass through untouched.
 */
export async function processImage(
  buf: Buffer,
  contentType: string,
  settings: GatewaySettings,
): Promise<ImageOut> {
  if (contentType.includes("svg")) {
    return { body: buf, contentType: "image/svg+xml", note: "svg-passthrough" };
  }
  if (contentType.includes("gif")) {
    return { body: buf, contentType: "image/gif", note: "gif-passthrough" };
  }
  if (buf.length > CONFIG.maxImageBytes) {
    return { body: PLACEHOLDER_GIF, contentType: "image/gif", note: "too-large-placeholder" };
  }
  try {
    const img = sharp(buf, { failOn: "none", animated: false });
    const meta = await img.metadata();
    let pipeline = img.rotate();
    const width = meta.width || settings.imw;
    if (width > settings.imw) {
      pipeline = pipeline.resize({ width: settings.imw, withoutEnlargement: true });
    }
    if (meta.hasAlpha) {
      const out = await pipeline.png({ compressionLevel: 6 }).toBuffer();
      return { body: out, contentType: "image/png", note: "png-recoded" };
    }
    const out = await pipeline
      .jpeg({ quality: settings.quality, mozjpeg: true })
      .toBuffer();
    return { body: out, contentType: "image/jpeg", note: "jpeg-recoded" };
  } catch {
    // Unknown/corrupt image. If it's already legacy-safe, pass it; else placeholder.
    if (/image\/(jpeg|png|gif)/.test(contentType)) {
      return { body: buf, contentType, note: "unparsed-passthrough" };
    }
    return { body: PLACEHOLDER_GIF, contentType: "image/gif", note: "error-placeholder" };
  }
}
