"use client";

import { useState, useRef } from "react";
import { callEdgeFunction } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

interface ProfileData {
  full_name: string | null;
  email: string;
  custom_avatar_url: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  body_type: string | null;
  gender_presentation: string | null;
  skin_tone: string | null;
  hair_colour: string | null;
  hair_length: string | null;
  age_range: string | null;
  country: string | null;
  preferred_currency: string | null;
}

const BODY_TYPES = ["Slim", "Athletic", "Medium", "Curvy", "Plus"];
const SKIN_TONES = ["Light", "Fair", "Medium", "Olive", "Brown", "Dark"];
const HAIR_LENGTHS = ["Bald", "Short", "Medium", "Long"];
const AGE_RANGES = ["18-24", "25-34", "35-44", "45-54", "55+"];
const GENDER_PRESENTATIONS = ["Female", "Male", "Androgynous"];

const COUNTRIES = [
  { code: "PK", name: "Pakistan", currency: "PKR" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "US", name: "United States", currency: "USD" },
  { code: "AE", name: "UAE", currency: "AED" },
  { code: "SA", name: "Saudi Arabia", currency: "SAR" },
  { code: "IN", name: "India", currency: "INR" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "AU", name: "Australia", currency: "AUD" },
  { code: "TR", name: "Turkey", currency: "TRY" },
];

const CURRENCIES = [
  { code: "PKR", label: "PKR — Pakistani Rupee" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "AED", label: "AED — UAE Dirham" },
  { code: "SAR", label: "SAR — Saudi Riyal" },
  { code: "INR", label: "INR — Indian Rupee" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "CAD", label: "CAD — Canadian Dollar" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "TRY", label: "TRY — Turkish Lira" },
];

const PHOTO_TIPS = [
  "Full body visible — head to feet",
  "Face the camera with arms slightly away from body",
  "Wear fitted base clothing (tank top + shorts or leggings)",
  "Use a plain or solid-colour background",
  "Even lighting with no harsh shadows",
  "No accessories, hats, or sunglasses",
];

export default function ProfileForm({
  profile,
}: {
  profile: ProfileData | null;
}) {
  const [draft, setDraft] = useState<Partial<ProfileData>>(profile ?? {});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [avatarUrl, setAvatarUrl] = useState(profile?.custom_avatar_url ?? null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);
  const [emailMessage, setEmailMessage] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  async function handleEmailChange() {
    setChangingEmail(true);
    setEmailMessage(null);
    setEmailError(null);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent("/profile")}`;
      const { error } = await supabase.auth.updateUser(
        { email: newEmail },
        { emailRedirectTo: redirectTo }
      );

      if (error) throw error;
      setEmailMessage(`Confirmation sent to ${newEmail}. Click the link to complete the change.`);
      setNewEmail("");
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Failed to send confirmation");
    } finally {
      setChangingEmail(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError(null);

    try {
      const res = await callEdgeFunction("profile", {
        method: "PATCH",
        body: draft,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Save failed");
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const res = await callEdgeFunction("profile", {
        method: "POST",
        formData,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }

      const { custom_avatar_url } = await res.json();
      setAvatarUrl(custom_avatar_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleRemoveAvatar() {
    setAvatarUrl(null);
    // TODO: could also delete from storage + clear DB field
  }

  return (
    <div>
      <div className="px-8 py-6 max-w-3xl">
        <h1 className="font-display text-card-heading font-medium text-near-black mb-1">
          Profile
        </h1>
        <p className="text-sm text-muted-slate mb-8">
          Your details and try-on avatar settings.
        </p>

        {/* ── Section: Account ── */}
        <section className="mb-10">
          <h2 className="text-xs font-mono text-muted-slate uppercase tracking-wider mb-4 pb-2 border-b border-hairline">
            Account
          </h2>

          <div>
            <label className="text-xs font-mono text-muted-slate uppercase tracking-wider block mb-1.5">
              Email
            </label>
            <div className="flex gap-2 items-stretch">
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder={profile?.email ?? "you@example.com"}
                className="flex-1 min-w-0 bg-canvas border border-hairline px-3 py-2 text-sm text-ink placeholder-muted-slate focus:outline-none focus:border-near-black"
              />
              <button
                onClick={handleEmailChange}
                disabled={
                  changingEmail || !newEmail || newEmail === profile?.email
                }
                className="px-5 py-2 text-xs font-medium border border-near-black text-ink hover:bg-stone disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              >
                {changingEmail ? "Sending…" : "Change email"}
              </button>
            </div>
            {emailMessage && (
              <p className="text-xs text-deep-green mt-2">{emailMessage}</p>
            )}
            {emailError && (
              <p className="text-xs text-red-600 mt-2">{emailError}</p>
            )}
            <p className="text-[11px] text-muted-slate mt-2">
              We&rsquo;ll send a confirmation link to your new email. Until you confirm, the change won&rsquo;t take effect.
            </p>
          </div>
        </section>

        {/* ── Section: Try-On Avatar ── */}
        <section className="mb-10">
          <h2 className="text-xs font-mono text-muted-slate uppercase tracking-wider mb-4 pb-2 border-b border-hairline">
            Try-On Avatar
          </h2>

          <div className="flex gap-6 items-start">
            {/* Preview */}
            <div className="w-36 flex-shrink-0">
              {avatarUrl ? (
                <div className="relative border border-hairline">
                  <div className="aspect-[3/4] bg-stone overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarUrl}
                      alt="Your avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={handleRemoveAvatar}
                    className="absolute top-2 right-2 w-6 h-6 bg-canvas border border-hairline text-muted-slate hover:text-red-500 hover:border-red-200 text-xs flex items-center justify-center"
                    title="Remove"
                  >
                    x
                  </button>
                </div>
              ) : (
                <div className="aspect-[3/4] bg-stone border border-hairline flex flex-col items-center justify-center">
                  <span className="text-2xl text-muted-slate mb-1">👤</span>
                  <span className="text-[10px] text-muted-slate font-mono">
                    No photo
                  </span>
                </div>
              )}
            </div>

            {/* Upload + Tips */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-ink mb-3">
                {avatarUrl ? "Your try-on photo" : "Upload your photo"}
              </p>

              <div className="bg-stone px-4 py-3 mb-4">
                <p className="text-[10px] font-mono text-muted-slate uppercase tracking-wider mb-2">
                  Photo guidelines
                </p>
                <ul className="space-y-1">
                  {PHOTO_TIPS.map((tip) => (
                    <li
                      key={tip}
                      className="text-xs text-muted-slate flex items-start gap-2"
                    >
                      <span className="text-coral mt-0.5">·</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>

              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleUpload}
                className="hidden"
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="px-5 py-2.5 text-xs font-medium border border-near-black text-ink hover:bg-stone disabled:opacity-40 transition-colors"
              >
                {uploading
                  ? "Uploading…"
                  : avatarUrl
                    ? "Change Photo"
                    : "Upload Photo"}
              </button>
            </div>
          </div>
        </section>

        {/* ── Section: Body Details ── */}
        <section className="mb-10">
          <h2 className="text-xs font-mono text-muted-slate uppercase tracking-wider mb-4 pb-2 border-b border-hairline">
            Body Details
          </h2>
          <p className="text-xs text-muted-slate mb-5">
            Optional — helps the AI fit garments more realistically on your
            avatar. Your uploaded photo is always the primary reference.
          </p>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {/* Height */}
            <div>
              <label className="text-xs font-mono text-muted-slate uppercase tracking-wider block mb-1.5">
                Height (cm)
              </label>
              <input
                type="number"
                value={draft.height_cm ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    height_cm: e.target.value ? parseInt(e.target.value) : null,
                  }))
                }
                placeholder="170"
                className="w-full bg-canvas border border-hairline px-3 py-2 text-sm text-ink placeholder-muted-slate focus:outline-none focus:border-near-black"
              />
            </div>

            {/* Weight */}
            <div>
              <label className="text-xs font-mono text-muted-slate uppercase tracking-wider block mb-1.5">
                Weight (kg)
              </label>
              <input
                type="number"
                value={draft.weight_kg ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    weight_kg: e.target.value ? parseInt(e.target.value) : null,
                  }))
                }
                placeholder="65"
                className="w-full bg-canvas border border-hairline px-3 py-2 text-sm text-ink placeholder-muted-slate focus:outline-none focus:border-near-black"
              />
            </div>

            {/* Body Type */}
            <SelectField
              label="Body type"
              value={draft.body_type}
              options={BODY_TYPES}
              onChange={(v) => setDraft((d) => ({ ...d, body_type: v || null }))}
            />

            {/* Presentation */}
            <SelectField
              label="Gender presentation"
              value={draft.gender_presentation}
              options={GENDER_PRESENTATIONS}
              onChange={(v) =>
                setDraft((d) => ({ ...d, gender_presentation: v || null }))
              }
            />

            {/* Skin Tone */}
            <SelectField
              label="Skin tone"
              value={draft.skin_tone}
              options={SKIN_TONES}
              onChange={(v) => setDraft((d) => ({ ...d, skin_tone: v || null }))}
            />

            {/* Hair Length */}
            <SelectField
              label="Hair length"
              value={draft.hair_length}
              options={HAIR_LENGTHS}
              onChange={(v) =>
                setDraft((d) => ({ ...d, hair_length: v || null }))
              }
            />

            {/* Hair Colour */}
            <div>
              <label className="text-xs font-mono text-muted-slate uppercase tracking-wider block mb-1.5">
                Hair colour
              </label>
              <input
                type="text"
                value={draft.hair_colour ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    hair_colour: e.target.value || null,
                  }))
                }
                placeholder="Brown"
                className="w-full bg-canvas border border-hairline px-3 py-2 text-sm text-ink placeholder-muted-slate focus:outline-none focus:border-near-black"
              />
            </div>

            {/* Age Range */}
            <SelectField
              label="Age range"
              value={draft.age_range}
              options={AGE_RANGES}
              onChange={(v) => setDraft((d) => ({ ...d, age_range: v || null }))}
            />
          </div>
        </section>

        {/* ── Section: Location & Currency ── */}
        <section className="mb-10">
          <h2 className="text-xs font-mono text-muted-slate uppercase tracking-wider mb-4 pb-2 border-b border-hairline">
            Location & Currency
          </h2>
          <p className="text-xs text-muted-slate mb-5">
            Used to show prices in your currency and filter products that ship to you.
          </p>

          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            {/* Country */}
            <div>
              <label className="text-xs font-mono text-muted-slate uppercase tracking-wider block mb-1.5">
                Country
              </label>
              <select
                value={draft.country ?? ""}
                onChange={(e) => {
                  const country = e.target.value;
                  const match = COUNTRIES.find((c) => c.code === country);
                  setDraft((d) => ({
                    ...d,
                    country: country || null,
                    // Auto-set currency when country changes
                    preferred_currency: match?.currency ?? d.preferred_currency,
                  }));
                }}
                className="w-full bg-canvas border border-hairline px-3 py-2 text-sm text-ink focus:outline-none focus:border-near-black appearance-none"
              >
                <option value="">— Select country</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Preferred Currency */}
            <div>
              <label className="text-xs font-mono text-muted-slate uppercase tracking-wider block mb-1.5">
                Preferred currency
              </label>
              <select
                value={draft.preferred_currency ?? "USD"}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, preferred_currency: e.target.value }))
                }
                className="w-full bg-canvas border border-hairline px-3 py-2 text-sm text-ink focus:outline-none focus:border-near-black appearance-none"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {draft.country && (
            <p className="text-[11px] text-muted-slate mt-3">
              Outfits will only include brands that ship to {COUNTRIES.find(c => c.code === draft.country)?.name ?? draft.country}. Prices shown in {draft.preferred_currency ?? "USD"}.
            </p>
          )}
        </section>

        {/* ── Save ── */}
        <div className="flex items-center gap-4">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-near-black text-white text-sm font-medium hover:bg-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : "Save Profile"}
          </button>

          {saved && (
            <span className="text-xs text-deep-green font-medium">
              Saved
            </span>
          )}

          {error && (
            <span className="text-xs text-red-600">{error}</span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Reusable select ── */
function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null | undefined;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-xs font-mono text-muted-slate uppercase tracking-wider block mb-1.5">
        {label}
      </label>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-canvas border border-hairline px-3 py-2 text-sm text-ink focus:outline-none focus:border-near-black appearance-none"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o} value={o.toLowerCase()}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}
