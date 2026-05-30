/**
 * One-time script: generates 12 diverse 3D-rendered avatar images via Gemini
 * and uploads them to the Supabase `avatars` storage bucket.
 *
 * Usage:
 *   npx tsx scripts/generate-avatars.ts
 *
 * Prerequisites:
 *   - GEMINI_API_KEY in .env.local
 *   - SUPABASE_SERVICE_ROLE_KEY in .env.local
 *   - NEXT_PUBLIC_SUPABASE_URL in .env.local
 *   - A public `avatars` bucket in Supabase Storage (create it first)
 */

import * as dotenv from "dotenv";
import * as path from "path";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const GEMINI_MODEL = "gemini-2.5-flash-image";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface AvatarSpec {
  id: string;
  prompt: string;
}

const AVATAR_SPECS: AvatarSpec[] = [
  // Female
  {
    id: "f-1",
    prompt:
      "A photorealistic 3D-rendered full-body portrait of a young Black woman in her early 20s with a slim build and natural hair. She is standing in a neutral, relaxed A-pose facing the camera. She is wearing only minimal form-fitting light gray athletic underwear (sports bra and briefs). The background is a clean, solid light gray studio backdrop with soft, even studio lighting. No accessories, no shoes, no makeup. Full body visible from head to feet. Hyper-realistic skin texture, natural proportions. 3D render quality similar to Unreal Engine 5.",
  },
  {
    id: "f-2",
    prompt:
      "A photorealistic 3D-rendered full-body portrait of a Latina woman in her mid-20s with a medium build and straight dark brown hair at shoulder length. She is standing in a neutral, relaxed A-pose facing the camera. She is wearing only minimal form-fitting light gray athletic underwear (sports bra and briefs). The background is a clean, solid light gray studio backdrop with soft, even studio lighting. No accessories, no shoes, no makeup. Full body visible from head to feet. Hyper-realistic skin texture, natural proportions. 3D render quality similar to Unreal Engine 5.",
  },
  {
    id: "f-3",
    prompt:
      "A photorealistic 3D-rendered full-body portrait of an East Asian woman in her late 20s with a petite build and straight black hair. She is standing in a neutral, relaxed A-pose facing the camera. She is wearing only minimal form-fitting light gray athletic underwear (sports bra and briefs). The background is a clean, solid light gray studio backdrop with soft, even studio lighting. No accessories, no shoes, no makeup. Full body visible from head to feet. Hyper-realistic skin texture, natural proportions. 3D render quality similar to Unreal Engine 5.",
  },
  {
    id: "f-4",
    prompt:
      "A photorealistic 3D-rendered full-body portrait of a South Asian woman in her early 30s with a curvy build and long dark hair. She is standing in a neutral, relaxed A-pose facing the camera. She is wearing only minimal form-fitting light gray athletic underwear (sports bra and briefs). The background is a clean, solid light gray studio backdrop with soft, even studio lighting. No accessories, no shoes, no makeup. Full body visible from head to feet. Hyper-realistic skin texture, natural proportions. 3D render quality similar to Unreal Engine 5.",
  },

  // Male
  {
    id: "m-1",
    prompt:
      "A photorealistic 3D-rendered full-body portrait of a White man in his early 30s with an athletic build, short brown hair, and light stubble. He is standing in a neutral, relaxed A-pose facing the camera. He is wearing only minimal form-fitting light gray athletic underwear (boxer briefs). The background is a clean, solid light gray studio backdrop with soft, even studio lighting. No accessories, no shoes. Full body visible from head to feet. Hyper-realistic skin texture, natural proportions. 3D render quality similar to Unreal Engine 5.",
  },
  {
    id: "m-2",
    prompt:
      "A photorealistic 3D-rendered full-body portrait of a Black man in his late 20s with a tall, lean build and a short fade haircut. He is standing in a neutral, relaxed A-pose facing the camera. He is wearing only minimal form-fitting light gray athletic underwear (boxer briefs). The background is a clean, solid light gray studio backdrop with soft, even studio lighting. No accessories, no shoes. Full body visible from head to feet. Hyper-realistic skin texture, natural proportions. 3D render quality similar to Unreal Engine 5.",
  },
  {
    id: "m-3",
    prompt:
      "A photorealistic 3D-rendered full-body portrait of a South Asian man in his early 30s with a medium build and short black hair. He is standing in a neutral, relaxed A-pose facing the camera. He is wearing only minimal form-fitting light gray athletic underwear (boxer briefs). The background is a clean, solid light gray studio backdrop with soft, even studio lighting. No accessories, no shoes. Full body visible from head to feet. Hyper-realistic skin texture, natural proportions. 3D render quality similar to Unreal Engine 5.",
  },
  {
    id: "m-4",
    prompt:
      "A photorealistic 3D-rendered full-body portrait of an East Asian man in his early 20s with a slim build and medium-length black hair. He is standing in a neutral, relaxed A-pose facing the camera. He is wearing only minimal form-fitting light gray athletic underwear (boxer briefs). The background is a clean, solid light gray studio backdrop with soft, even studio lighting. No accessories, no shoes. Full body visible from head to feet. Hyper-realistic skin texture, natural proportions. 3D render quality similar to Unreal Engine 5.",
  },

  // Androgynous
  {
    id: "a-1",
    prompt:
      "A photorealistic 3D-rendered full-body portrait of a mixed-race androgynous person in their mid-20s with a lean build and short curly hair. They are standing in a neutral, relaxed A-pose facing the camera. They are wearing only minimal form-fitting light gray athletic underwear (compression shorts and fitted tank top). The background is a clean, solid light gray studio backdrop with soft, even studio lighting. No accessories, no shoes, no makeup. Full body visible from head to feet. Hyper-realistic skin texture, natural proportions. 3D render quality similar to Unreal Engine 5.",
  },
  {
    id: "a-2",
    prompt:
      "A photorealistic 3D-rendered full-body portrait of a White androgynous person in their early 40s with a medium build and short sandy hair. They are standing in a neutral, relaxed A-pose facing the camera. They are wearing only minimal form-fitting light gray athletic underwear (compression shorts and fitted tank top). The background is a clean, solid light gray studio backdrop with soft, even studio lighting. No accessories, no shoes, no makeup. Full body visible from head to feet. Hyper-realistic skin texture, natural proportions. 3D render quality similar to Unreal Engine 5.",
  },
  {
    id: "a-3",
    prompt:
      "A photorealistic 3D-rendered full-body portrait of a Black androgynous person in their late 20s with an athletic build and a very short natural haircut. They are standing in a neutral, relaxed A-pose facing the camera. They are wearing only minimal form-fitting light gray athletic underwear (compression shorts and fitted tank top). The background is a clean, solid light gray studio backdrop with soft, even studio lighting. No accessories, no shoes, no makeup. Full body visible from head to feet. Hyper-realistic skin texture, natural proportions. 3D render quality similar to Unreal Engine 5.",
  },
  {
    id: "a-4",
    prompt:
      "A photorealistic 3D-rendered full-body portrait of a Middle-Eastern androgynous person in their mid-20s with a slim build and medium-length dark wavy hair. They are standing in a neutral, relaxed A-pose facing the camera. They are wearing only minimal form-fitting light gray athletic underwear (compression shorts and fitted tank top). The background is a clean, solid light gray studio backdrop with soft, even studio lighting. No accessories, no shoes, no makeup. Full body visible from head to feet. Hyper-realistic skin texture, natural proportions. 3D render quality similar to Unreal Engine 5.",
  },
];

async function generateAvatar(spec: AvatarSpec): Promise<Buffer | null> {
  console.log(`  Generating ${spec.id}...`);

  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: spec.prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        temperature: 0.8,
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`  FAILED ${spec.id}: ${res.status} ${err}`);
    return null;
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts ?? [];
  const imgPart = parts.find(
    (p: { inlineData?: { data: string } }) => p.inlineData
  );

  if (!imgPart?.inlineData?.data) {
    console.error(`  FAILED ${spec.id}: No image in response`);
    return null;
  }

  return Buffer.from(imgPart.inlineData.data, "base64");
}

async function uploadToSupabase(id: string, buffer: Buffer) {
  const filePath = `${id}.png`;

  const { error } = await supabase.storage
    .from("avatars")
    .upload(filePath, buffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) {
    console.error(`  Upload failed for ${id}:`, error.message);
    return;
  }

  const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
  console.log(`  Uploaded ${id} -> ${data.publicUrl}`);
}

async function main() {
  console.log("=== Avatar Generation ===\n");
  console.log(`Generating ${AVATAR_SPECS.length} avatars with Gemini...\n`);

  // Process sequentially to avoid rate limits
  for (const spec of AVATAR_SPECS) {
    const buffer = await generateAvatar(spec);
    if (buffer) {
      await uploadToSupabase(spec.id, buffer);
    }
    // Small delay between requests
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log("\nDone!");
}

main().catch(console.error);
