/**
 * Predefined avatar models for virtual try-on.
 *
 * Each avatar has a public image URL (stored in Supabase bucket `avatars`)
 * and metadata describing the demographic segment.
 *
 * ── Setup ──────────────────────────────────────────────────────
 * 1. Create a Supabase storage bucket called `avatars` (public).
 * 2. Upload a full-body photo for each avatar named by its `id`
 *    (e.g. `f-1.png`, `m-3.png`). Photos should be:
 *      • Full-body, front-facing, neutral pose
 *      • Plain or solid-colour background
 *      • Wearing simple, fitted base clothing (tank + shorts/leggings)
 *      • At least 768 × 1024 px
 * 3. Update the `image` field below with the public URL.
 */

export interface Avatar {
  id: string;
  label: string;
  gender: "female" | "male" | "androgynous" | "custom";
  description: string;
  image: string;
  isCustom?: boolean;
}

const BUCKET_BASE =
  process.env.NEXT_PUBLIC_SUPABASE_URL + "/storage/v1/object/public/avatars";

export const AVATARS: Avatar[] = [
  // ── Female ──
  {
    id: "f-1",
    label: "Amara",
    gender: "female",
    description: "Young Black woman, slim build",
    image: `${BUCKET_BASE}/f-1.png`,
  },
  {
    id: "f-2",
    label: "Sofia",
    gender: "female",
    description: "Latina woman, mid-20s, medium build",
    image: `${BUCKET_BASE}/f-2.png`,
  },
  {
    id: "f-3",
    label: "Mei",
    gender: "female",
    description: "East Asian woman, petite build",
    image: `${BUCKET_BASE}/f-3.png`,
  },
  {
    id: "f-4",
    label: "Priya",
    gender: "female",
    description: "South Asian woman, curvy build",
    image: `${BUCKET_BASE}/f-4.png`,
  },

  // ── Male ──
  {
    id: "m-1",
    label: "James",
    gender: "male",
    description: "White man, athletic build, 30s",
    image: `${BUCKET_BASE}/m-1.png`,
  },
  {
    id: "m-2",
    label: "Kwame",
    gender: "male",
    description: "Black man, tall, lean build",
    image: `${BUCKET_BASE}/m-2.png`,
  },
  {
    id: "m-3",
    label: "Ravi",
    gender: "male",
    description: "South Asian man, medium build",
    image: `${BUCKET_BASE}/m-3.png`,
  },
  {
    id: "m-4",
    label: "Kenji",
    gender: "male",
    description: "East Asian man, slim build, 20s",
    image: `${BUCKET_BASE}/m-4.png`,
  },

  // ── Androgynous ──
  {
    id: "a-1",
    label: "River",
    gender: "androgynous",
    description: "Mixed-race, androgynous, lean build",
    image: `${BUCKET_BASE}/a-1.png`,
  },
  {
    id: "a-2",
    label: "Sam",
    gender: "androgynous",
    description: "White, androgynous, medium build, 40s",
    image: `${BUCKET_BASE}/a-2.png`,
  },
  {
    id: "a-3",
    label: "Jules",
    gender: "androgynous",
    description: "Black, androgynous, athletic build",
    image: `${BUCKET_BASE}/a-3.png`,
  },
  {
    id: "a-4",
    label: "Noor",
    gender: "androgynous",
    description: "Middle-Eastern, androgynous, slim build",
    image: `${BUCKET_BASE}/a-4.png`,
  },
];

/** Filter avatars by gender tab */
export function avatarsByGender(gender?: Avatar["gender"]) {
  if (!gender) return AVATARS;
  return AVATARS.filter((a) => a.gender === gender);
}
