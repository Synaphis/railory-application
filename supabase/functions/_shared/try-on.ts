/**
 * Shared try-on image generation logic.
 *
 * Used by both `try-on/index.ts` (user-triggered) and
 * `generate/index.ts` (auto-preview after outfit generation).
 */

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const GEMINI_MODEL = "gemini-2.5-flash-image";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export type Garment = { role: string; image: string; name: string };

export type BodyContext = {
  height_cm?: number | null;
  weight_kg?: number | null;
  body_type?: string | null;
  gender_presentation?: string | null;
  skin_tone?: string | null;
};

type TryOnResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

/* ─────────────────────────────────────────────────
   Main entry point
   ───────────────────────────────────────────────── */

/**
 * Generate a try-on image.
 *
 * Fetches all images (model + garments + optional reference),
 * builds the prompt, tries Gemini then OpenAI.
 */
export async function generateTryOnImage(opts: {
  modelImage: string;
  garments: Garment[];
  angle?: string;
  referenceImage?: string;
  bodyContext?: BodyContext;
  pose?: string;
  preview?: boolean;
}): Promise<TryOnResult> {
  if (!GEMINI_API_KEY && !OPENAI_API_KEY) {
    return { ok: false, error: "No AI provider configured" };
  }

  /* ── Fetch all URL-based images in parallel ── */
  const imageUrls = [opts.modelImage, ...opts.garments.map((g) => g.image)];
  const fetchResults = await Promise.all(imageUrls.map((url) => fetch(url)));

  const failedIdx = fetchResults.findIndex((r) => !r.ok);
  if (failedIdx !== -1) {
    return {
      ok: false,
      error: `Image fetch failed: ${imageUrls[failedIdx]} (${fetchResults[failedIdx].status})`,
    };
  }

  const buffers = await Promise.all(fetchResults.map((r) => r.arrayBuffer()));
  const mimeTypes = fetchResults.map(
    (r) => r.headers.get("content-type") || "image/jpeg"
  );

  /* ── Parse reference image if provided (data URL → buffer) ── */
  let refBuffer: ArrayBuffer | null = null;
  let refMime = "image/png";
  if (opts.referenceImage && opts.angle) {
    const match = opts.referenceImage.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      refMime = match[1];
      const binaryStr = atob(match[2]);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }
      refBuffer = bytes.buffer;
    }
  }

  /* ── Build prompt ── */
  const prompt = buildPrompt(
    opts.garments,
    opts.angle ?? null,
    !!refBuffer,
    opts.bodyContext,
    opts.pose
  );

  /* ── Assemble final image list ── */
  const allBuffers = [...buffers];
  const allMimes = [...mimeTypes];
  if (refBuffer) {
    allBuffers.push(refBuffer);
    allMimes.push(refMime);
  }

  /* ── Try Gemini first, fall back to OpenAI ── */
  const isPreview = opts.preview === true;

  if (GEMINI_API_KEY) {
    const result = await tryGemini(prompt, allBuffers, allMimes);
    if (result.ok) return result;
    console.warn("[try-on] Gemini failed, falling back to OpenAI:", result.error);
  }

  if (OPENAI_API_KEY) {
    return await tryOpenAI(prompt, allBuffers, allMimes, isPreview);
  }

  return { ok: false, error: "All AI providers failed" };
}

/* ─────────────────────────────────────────────────
   Prompt builder
   ───────────────────────────────────────────────── */

const ANGLE_DESCRIPTIONS: Record<string, string> = {
  front: "directly facing the camera (front view)",
  back: "facing AWAY from the camera, showing the back of the outfit",
  "left-side": "turned 90 degrees to show the LEFT side profile",
  "right-side": "turned 90 degrees to show the RIGHT side profile",
  "three-quarter":
    "turned at a 3/4 angle (45 degrees) toward the camera",
  "close-up-top":
    "a close-up shot from the waist up, focusing on the upper body and top garment details",
  "close-up-bottom":
    "a close-up shot from the waist down, focusing on the lower body, trousers/skirt, and shoes",
};

export { ANGLE_DESCRIPTIONS };

function buildPrompt(
  garments: Garment[],
  angle: string | null,
  hasReference: boolean,
  bodyContext?: BodyContext,
  pose?: string
): string {
  const garmentList = garments
    .map((g, i) => `  IMAGE ${i + 2}: ${g.role.toUpperCase()} — "${g.name}"`)
    .join("\n");

  const isSingle = garments.length === 1;
  const totalImages = garments.length + 1 + (hasReference ? 1 : 0);
  const refImageIdx = garments.length + 2;

  const angleDesc = angle ? ANGLE_DESCRIPTIONS[angle] || angle : null;

  const lines: string[] = [
    "You are a virtual fashion try-on assistant.",
    "",
    `I am giving you ${totalImages} images:`,
    "  IMAGE 1: A 3D-rendered avatar of a person (the model). This is who should wear the clothing.",
    garmentList,
  ];

  if (hasReference) {
    lines.push(
      `  IMAGE ${refImageIdx}: A REFERENCE photo — this is the SAME person already wearing this outfit from a previous generation. Use this as reference for the outfit appearance, fabric, and fit.`
    );
  }

  lines.push("");

  if (angleDesc && hasReference) {
    lines.push(
      `Generate a new image of the SAME person wearing the SAME outfit as shown in the reference image (Image ${refImageIdx}), but now ${angleDesc}.`
    );
  } else if (angleDesc) {
    lines.push(
      isSingle
        ? `Generate a photorealistic image of the person from Image 1 wearing the garment, posed ${angleDesc}.`
        : `Generate a photorealistic image of the person from Image 1 wearing ALL ${garments.length} garments as a complete outfit, posed ${angleDesc}.`
    );
  } else if (pose) {
    lines.push(
      isSingle
        ? `Generate a single photorealistic image of the SAME person from Image 1 wearing the garment from Image 2.`
        : `Generate a single photorealistic image of the SAME person from Image 1 wearing ALL ${garments.length} garments together as a complete outfit.`,
      "",
      `CRITICAL — The person MUST be in this EXACT pose (do NOT use the same pose as the input avatar):`,
      pose,
      "This pose is MANDATORY. The output MUST clearly show the person in this specific body position, NOT the default standing position from the input image."
    );
  } else {
    lines.push(
      isSingle
        ? "Generate a single photorealistic image of the SAME person from Image 1 wearing the garment from Image 2."
        : `Generate a single photorealistic image of the SAME person from Image 1 wearing ALL ${garments.length} garments together as a complete outfit.`
    );
  }

  if (bodyContext) {
    const details: string[] = [];
    if (bodyContext.height_cm)
      details.push(`height: ${bodyContext.height_cm}cm`);
    if (bodyContext.weight_kg)
      details.push(`weight: ${bodyContext.weight_kg}kg`);
    if (bodyContext.body_type)
      details.push(`body type: ${bodyContext.body_type}`);
    if (bodyContext.gender_presentation)
      details.push(`presents as: ${bodyContext.gender_presentation}`);
    if (bodyContext.skin_tone)
      details.push(`skin tone: ${bodyContext.skin_tone}`);
    if (details.length > 0) {
      lines.push(
        "",
        `Additional context about the person: ${details.join(", ")}. Use this to ensure the garment sizing and fit look realistic for their body proportions. The photo in Image 1 is the primary reference — these details are supplementary.`
      );
    }
  }

  lines.push(
    "",
    "Requirements:",
    "- Preserve the person's face, body shape, skin tone, hair exactly as shown in Image 1.",
    "- The person's identity and appearance must be IDENTICAL to Image 1.",
    isSingle
      ? "- The garment should look naturally worn with realistic draping, folds, shadows, and fit."
      : "- ALL garments must appear together in one cohesive outfit, layered correctly (e.g. jacket over top, shoes on feet).",
    "- Realistic fabric physics — proper draping, folds, wrinkles, and shadows where garments meet the body."
  );

  if (hasReference) {
    lines.push(
      `- The outfit must look IDENTICAL to the reference image (Image ${refImageIdx}) — same colours, patterns, fit, and styling. Only the viewing angle changes.`
    );
  }

  lines.push(
    "- Soft, even studio lighting on a clean neutral gray background."
  );

  if (angle?.startsWith("close-up")) {
    lines.push("- Frame the shot as described — waist-up or waist-down.");
  } else {
    lines.push(
      "- CRITICAL FRAMING: This MUST be a COMPLETE full-body shot showing the ENTIRE person from the TOP OF THE HEAD to the BOTTOM OF THE FEET including shoes/soles.",
      "- Leave at least 5-10% padding/margin of empty background ABOVE the head and BELOW the feet so nothing is cropped.",
      "- The person must be fully visible within the frame — absolutely NO cropping of the head, hair, forehead, chin, hands, legs, ankles, or feet.",
      "- Camera should be positioned at chest height, shooting the full body in a tall portrait composition.",
      "- If in doubt, zoom OUT rather than risk any cropping."
    );
  }

  lines.push(
    "- The result should look like a professional fashion e-commerce photo, not a composite or collage.",
    "- Do NOT add any text, watermarks, logos, or extra accessories not shown in the garment images.",
    "- Do NOT change the background — keep the clean studio backdrop."
  );

  return lines.join("\n");
}

/* ─────────────────────────────────────────────────
   Gemini provider
   ───────────────────────────────────────────────── */

export function toB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function tryGemini(
  prompt: string,
  buffers: ArrayBuffer[],
  mimeTypes: string[]
): Promise<TryOnResult> {
  const parts: Record<string, unknown>[] = [{ text: prompt }];

  for (let i = 0; i < buffers.length; i++) {
    parts.push({
      inline_data: { mime_type: mimeTypes[i], data: toB64(buffers[i]) },
    });
  }

  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
        temperature: 0.4,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, error: `Gemini ${res.status}: ${text.slice(0, 200)}` };
  }

  const data = await res.json();
  const resParts = data.candidates?.[0]?.content?.parts ?? [];
  const imgPart = resParts.find(
    (p: { inlineData?: unknown }) => p.inlineData
  );

  if (!imgPart?.inlineData?.data) {
    const textPart = resParts.find((p: { text?: string }) => p.text);
    return {
      ok: false,
      error: textPart?.text?.slice(0, 200) || "No image in response",
    };
  }

  const mime = imgPart.inlineData.mimeType || "image/png";
  return { ok: true, url: `data:${mime};base64,${imgPart.inlineData.data}` };
}

/* ─────────────────────────────────────────────────
   OpenAI provider (gpt-image-1)
   ───────────────────────────────────────────────── */

async function tryOpenAI(
  prompt: string,
  buffers: ArrayBuffer[],
  mimeTypes: string[],
  isPreview = false
): Promise<TryOnResult> {
  const formData = new FormData();
  formData.append("model", "gpt-image-1");
  formData.append("prompt", prompt);
  formData.append("size", "1024x1536");
  formData.append("quality", "low");

  for (let i = 0; i < buffers.length; i++) {
    const ext = mimeTypes[i].includes("png") ? "png" : "jpg";
    const blob = new Blob([buffers[i]], { type: mimeTypes[i] });
    formData.append("image[]", blob, `image-${i}.${ext}`);
  }

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[try-on] OpenAI error:", res.status, text);
    return {
      ok: false,
      error: `OpenAI ${res.status}: ${text.slice(0, 200)}`,
    };
  }

  const data = await res.json();

  const outputUrl = data.data?.[0]?.url;
  const b64 = data.data?.[0]?.b64_json;

  if (outputUrl) {
    try {
      const imgRes = await fetch(outputUrl);
      if (imgRes.ok) {
        const imgBuf = await imgRes.arrayBuffer();
        const imgB64 = toB64(imgBuf);
        const mime = imgRes.headers.get("content-type") || "image/png";
        return { ok: true, url: `data:${mime};base64,${imgB64}` };
      }
    } catch {
      // fall through to b64 check
    }
  }

  if (b64) {
    return { ok: true, url: `data:image/png;base64,${b64}` };
  }

  return { ok: false, error: "No image in OpenAI response" };
}
