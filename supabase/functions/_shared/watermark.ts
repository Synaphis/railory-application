/**
 * Watermark helper — composites the Railory brand mark onto an image buffer.
 *
 * - Pure-TS via imagescript (no native deps, runs in Supabase Edge runtime)
 * - Fetches the mark from the public `brand` Supabase Storage bucket
 * - Cached across warm invocations of the same function instance
 * - Subtle bottom-right placement: ~10% of width, ~45% opacity, 3% padding
 *
 * If watermarking fails for any reason, the original image bytes are returned
 * unchanged — we never want a watermark glitch to break a try-on.
 */

import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const WATERMARK_URL = `${SUPABASE_URL}/storage/v1/object/public/brand/railory_watermark.png`;

// Cached across warm function invocations — the watermark image never changes
// during a function's lifetime, so we only download + decode it once per
// container.
let cachedWatermark: Image | null = null;

async function loadWatermark(): Promise<Image> {
  if (cachedWatermark) return cachedWatermark;
  const res = await fetch(WATERMARK_URL);
  if (!res.ok) {
    throw new Error(`Watermark fetch failed: HTTP ${res.status}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  cachedWatermark = await Image.decode(buf);
  return cachedWatermark;
}

/**
 * Composite the Railory watermark onto an image. Returns PNG bytes.
 *
 * If anything goes wrong (network blip, decode error), returns the original
 * input bytes — fail-open so a watermark glitch can never break try-on.
 */
export async function applyWatermark(
  imageBytes: Uint8Array
): Promise<Uint8Array> {
  try {
    const base = await Image.decode(imageBytes);
    const watermark = await loadWatermark();

    // Scale watermark to ~10% of base width, preserving aspect ratio
    const targetWidth = Math.max(48, Math.round(base.width * 0.1));
    const aspectRatio = watermark.height / watermark.width;
    const targetHeight = Math.round(targetWidth * aspectRatio);

    // Clone before mutating — the cached watermark must stay pristine
    const scaled = watermark.clone().resize(targetWidth, targetHeight);

    // Subtle opacity — visible enough to brand, faint enough not to distract
    scaled.opacity(0.45);

    // Bottom-right with 3% padding
    const padding = Math.max(16, Math.round(base.width * 0.03));
    const x = base.width - scaled.width - padding;
    const y = base.height - scaled.height - padding;

    base.composite(scaled, x, y);

    return await base.encode();
  } catch (err) {
    console.warn("[watermark] applyWatermark failed, returning original:", err);
    return imageBytes;
  }
}

/** Convenience: decode a base64 data URL → bytes → watermark → bytes. */
export async function watermarkBase64(dataUrl: string): Promise<Uint8Array> {
  const commaIdx = dataUrl.indexOf(",");
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  return await applyWatermark(bytes);
}

/** Convenience: watermark + return a base64 data URL (image/png). */
export async function watermarkToBase64(dataUrl: string): Promise<string> {
  const watermarked = await watermarkBase64(dataUrl);
  // Convert Uint8Array → base64 string
  let binary = "";
  for (let i = 0; i < watermarked.length; i++) {
    binary += String.fromCharCode(watermarked[i]);
  }
  return `data:image/png;base64,${btoa(binary)}`;
}
