"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { AVATARS, Avatar, avatarsByGender } from "@/lib/avatars";
import { OutfitCardItem, BodyProfile } from "@/lib/types";
import { callEdgeFunction } from "@/lib/api";
import { parseLimitError, type LimitError } from "@/lib/billing";
import UpgradeBanner from "@/components/UpgradeBanner";

interface TryOnModalProps {
  items: OutfitCardItem[];
  outfitId?: string;
  onClose: () => void;
}

type GenderTab = "all" | "female" | "male" | "androgynous" | "you";

const GENDER_TABS: { key: GenderTab; label: string }[] = [
  { key: "you", label: "You" },
  { key: "all", label: "All" },
  { key: "female", label: "Female" },
  { key: "male", label: "Male" },
  { key: "androgynous", label: "Androgynous" },
];

const ANGLES = [
  { key: "front", label: "Front", icon: "⬆" },
  { key: "back", label: "Back", icon: "⬇" },
  { key: "left-side", label: "Left", icon: "⬅" },
  { key: "right-side", label: "Right", icon: "➡" },
  { key: "three-quarter", label: "3/4", icon: "↗" },
  { key: "close-up-top", label: "Top Detail", icon: "⤒" },
  { key: "close-up-bottom", label: "Bottom Detail", icon: "⤓" },
];

export default function TryOnModal({ items, outfitId, onClose }: TryOnModalProps) {
  const [selectedAvatar, setSelectedAvatar] = useState<Avatar | null>(null);
  const [genderTab, setGenderTab] = useState<GenderTab>("all");

  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(items.map((i) => i.product.id))
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [activeAngle, setActiveAngle] = useState<string | null>(null);
  const [angleLoading, setAngleLoading] = useState<string | null>(null);

  const [avatarErrors, setAvatarErrors] = useState<Set<string>>(new Set());
  const [limitError, setLimitError] = useState<LimitError | null>(null);

  // Custom avatar from profile
  const [customAvatar, setCustomAvatar] = useState<Avatar | null>(null);
  const [bodyContext, setBodyContext] = useState<Partial<BodyProfile> | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await callEdgeFunction("profile", { method: "GET" });
        if (res.ok) {
          const data = await res.json();
          if (data.custom_avatar_url) {
            const avatar: Avatar = {
              id: "custom",
              label: "You",
              gender: "custom",
              description: "Your photo",
              image: data.custom_avatar_url,
              isCustom: true,
            };
            setCustomAvatar(avatar);
          }
          setBodyContext(data);
        }
      } catch {
        // Profile is optional
      } finally {
        setProfileLoading(false);
      }
    }
    loadProfile();
  }, []);

  const filteredAvatars =
    genderTab === "all"
      ? AVATARS
      : genderTab === "you"
        ? []
        : avatarsByGender(genderTab as Avatar["gender"]);

  const selectedItems = items.filter((i) => selectedIds.has(i.product.id));
  const allSelected = selectedIds.size === items.length;

  function toggleItem(productId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        if (next.size <= 1) return prev;
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
    setResultUrl(null);
    setActiveAngle(null);
  }

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set([items[0].product.id]));
    } else {
      setSelectedIds(new Set(items.map((i) => i.product.id)));
    }
    setResultUrl(null);
    setActiveAngle(null);
  }

  function getGarments() {
    return selectedItems
      .filter((i) => i.product.images?.[0])
      .map((i) => ({
        role: i.role,
        image: i.product.images[0],
        name: i.product.name,
      }));
  }

  async function handleTryOn() {
    if (!selectedAvatar || selectedItems.length === 0) return;

    const garments = getGarments();
    if (garments.length === 0) {
      setError("No product images available");
      return;
    }

    setLoading(true);
    setError(null);
    setLimitError(null);
    setResultUrl(null);
    setActiveAngle(null);

    const body_context_payload =
      selectedAvatar.isCustom && bodyContext
        ? {
            height_cm: bodyContext.height_cm,
            weight_kg: bodyContext.weight_kg,
            body_type: bodyContext.body_type,
            gender_presentation: bodyContext.gender_presentation,
            skin_tone: bodyContext.skin_tone,
          }
        : undefined;

    try {
      const res = await callEdgeFunction("try-on", {
        body: {
          model_image: selectedAvatar.image,
          garments,
          body_context: body_context_payload,
          outfit_id: outfitId,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const limit = parseLimitError(res.status, data);
        if (limit) {
          setLimitError(limit);
          return;
        }
        throw new Error(data.error || "Try-on failed");
      }

      const data = await res.json();
      setResultUrl(data.output_url);
      setActiveAngle("front");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleAngle(angleKey: string) {
    if (!selectedAvatar || !resultUrl || angleKey === activeAngle) return;

    const garments = getGarments();
    if (garments.length === 0) return;

    setAngleLoading(angleKey);
    setError(null);
    setLimitError(null);

    try {
      const res = await callEdgeFunction("try-on", {
        body: {
          model_image: selectedAvatar.image,
          garments,
          angle: angleKey,
          reference_image: resultUrl,
          outfit_id: outfitId,
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const limit = parseLimitError(res.status, data);
        if (limit) {
          setLimitError(limit);
          return;
        }
        throw new Error(data.error || "Angle generation failed");
      }

      const data = await res.json();
      setResultUrl(data.output_url);
      setActiveAngle(angleKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setAngleLoading(null);
    }
  }

  const isAngleLoading = angleLoading !== null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-canvas w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-hairline">
          <div>
            <h2 className="font-display text-lg font-medium text-near-black">
              Virtual Try-On
            </h2>
            <p className="text-xs text-muted-slate mt-0.5">
              Choose an avatar or use your own photo
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-muted-slate hover:text-ink text-xl"
          >
            &times;
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col lg:flex-row">
            {/* ── Left: Avatar + Garments ── */}
            <div className="lg:w-1/2 border-b lg:border-b-0 lg:border-r border-hairline flex flex-col">
              {/* Avatar picker */}
              <div className="p-5 border-b border-hairline">
                <p className="text-xs font-mono text-muted-slate uppercase tracking-wider mb-3">
                  1 — Choose avatar
                </p>

                <div className="flex gap-1 mb-4 flex-wrap">
                  {GENDER_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setGenderTab(tab.key)}
                      className={`px-3 py-1.5 text-xs font-medium border transition-colors ${
                        genderTab === tab.key
                          ? "border-near-black text-ink bg-stone"
                          : "border-hairline text-muted-slate hover:border-ink hover:text-ink"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* ── "You" tab ── */}
                {genderTab === "you" && (
                  <div>
                    {profileLoading ? (
                      <div className="py-8 text-center">
                        <p className="text-xs text-muted-slate">Loading profile…</p>
                      </div>
                    ) : customAvatar ? (
                      <div className="flex gap-4 items-start">
                        <button
                          onClick={() => {
                            setSelectedAvatar(customAvatar);
                            setResultUrl(null);
                            setActiveAngle(null);
                          }}
                          className={`w-28 flex-shrink-0 border transition-colors ${
                            selectedAvatar?.id === "custom"
                              ? "border-near-black"
                              : "border-hairline hover:border-ink"
                          }`}
                        >
                          <div className="aspect-[3/4] bg-stone overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={customAvatar.image}
                              alt="Your avatar"
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <p className="text-[10px] font-medium text-ink py-1.5 text-center">
                            Your photo
                          </p>
                        </button>

                        <div className="flex-1 min-w-0 pt-1">
                          <p className="text-sm font-medium text-ink mb-1">
                            Your try-on avatar
                          </p>
                          <p className="text-xs text-muted-slate mb-3">
                            {selectedAvatar?.id === "custom"
                              ? "Selected — choose garments and generate."
                              : "Click your photo to select it."}
                          </p>
                          <Link
                            href="/profile"
                            onClick={onClose}
                            className="text-xs text-action-blue hover:underline"
                          >
                            Update photo or body details →
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="py-8 text-center">
                        <div className="w-14 h-14 bg-stone flex items-center justify-center mx-auto mb-3">
                          <span className="text-2xl text-muted-slate">👤</span>
                        </div>
                        <p className="text-sm font-medium text-ink mb-1">
                          No avatar uploaded yet
                        </p>
                        <p className="text-xs text-muted-slate mb-4">
                          Upload your photo and body details on the profile page.
                        </p>
                        <Link
                          href="/profile"
                          onClick={onClose}
                          className="inline-block px-5 py-2.5 text-xs font-medium border border-near-black text-ink hover:bg-stone transition-colors"
                        >
                          Go to Profile →
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Predefined avatar grid ── */}
                {genderTab !== "you" && (
                  <div className="grid grid-cols-4 gap-2">
                    {filteredAvatars.map((avatar) => (
                      <button
                        key={avatar.id}
                        onClick={() => {
                          setSelectedAvatar(avatar);
                          setResultUrl(null);
                          setActiveAngle(null);
                        }}
                        className={`flex flex-col items-center gap-1.5 p-2 border transition-colors ${
                          selectedAvatar?.id === avatar.id
                            ? "border-near-black bg-stone"
                            : "border-transparent hover:border-hairline"
                        }`}
                      >
                        <div className="relative w-full aspect-[3/4] bg-stone overflow-hidden">
                          {!avatarErrors.has(avatar.id) ? (
                            <Image
                              src={avatar.image}
                              alt={avatar.label}
                              fill
                              className="object-cover"
                              sizes="80px"
                              onError={() =>
                                setAvatarErrors((prev) =>
                                  new Set(prev).add(avatar.id)
                                )
                              }
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <span className="text-muted-slate text-[10px] font-mono">
                                {avatar.label[0]}
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="text-center">
                          <p className="text-[11px] font-medium text-ink leading-tight">
                            {avatar.label}
                          </p>
                          <p className="text-[9px] text-muted-slate leading-tight">
                            {avatar.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Garment selection */}
              <div className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-mono text-muted-slate uppercase tracking-wider">
                    2 — Select garments
                  </p>
                  <button
                    onClick={toggleAll}
                    className="text-[10px] font-medium text-action-blue hover:underline"
                  >
                    {allSelected ? "Deselect all" : "Select all (full outfit)"}
                  </button>
                </div>

                <div className="space-y-2">
                  {items.map((item) => {
                    const isSelected = selectedIds.has(item.product.id);
                    return (
                      <button
                        key={item.product.id}
                        onClick={() => toggleItem(item.product.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 border text-left transition-colors ${
                          isSelected
                            ? "border-near-black bg-stone"
                            : "border-hairline text-muted-slate hover:border-ink"
                        }`}
                      >
                        <div
                          className={`w-4 h-4 border flex items-center justify-center flex-shrink-0 ${
                            isSelected
                              ? "border-near-black bg-near-black"
                              : "border-muted-slate"
                          }`}
                        >
                          {isSelected && (
                            <svg
                              width="10"
                              height="8"
                              viewBox="0 0 10 8"
                              fill="none"
                              className="text-white"
                            >
                              <path
                                d="M1 4L3.5 6.5L9 1"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="square"
                              />
                            </svg>
                          )}
                        </div>

                        {item.product.images?.[0] && (
                          <div className="relative w-10 h-10 bg-stone overflow-hidden flex-shrink-0">
                            <Image
                              src={item.product.images[0]}
                              alt={item.product.name}
                              fill
                              className="object-contain"
                              sizes="40px"
                            />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] font-mono text-coral uppercase tracking-wider">
                            {item.role}
                          </span>
                          <p
                            className={`text-xs truncate ${
                              isSelected ? "text-ink font-medium" : "text-muted-slate"
                            }`}
                          >
                            {item.product.name}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <p className="text-[10px] text-muted-slate mt-2">
                  {selectedItems.length} of {items.length} items selected
                  {allSelected && " — full outfit"}
                </p>
              </div>
            </div>

            {/* ── Right: Generate + Angles + Result ── */}
            <div className="lg:w-1/2 p-5 flex flex-col">
              <p className="text-xs font-mono text-muted-slate uppercase tracking-wider mb-4">
                3 — Generate
              </p>

              {/* Summary */}
              <div className="bg-stone px-4 py-3 mb-4">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-slate">Avatar</span>
                  <span className="text-ink font-medium">
                    {selectedAvatar?.isCustom
                      ? "Your photo"
                      : selectedAvatar?.label ?? "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs mt-1">
                  <span className="text-muted-slate">Garments</span>
                  <span className="text-ink font-medium">
                    {selectedItems.length === items.length
                      ? `Full outfit (${items.length} items)`
                      : `${selectedItems.length} item${selectedItems.length !== 1 ? "s" : ""}`}
                  </span>
                </div>
              </div>

              <button
                onClick={handleTryOn}
                disabled={!selectedAvatar || selectedItems.length === 0 || loading}
                className="w-full py-3 bg-near-black text-white text-sm font-medium hover:bg-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors mb-5"
              >
                {loading
                  ? "Generating…"
                  : allSelected
                    ? "Try On Full Outfit"
                    : `Try On ${selectedItems.length} Item${selectedItems.length !== 1 ? "s" : ""}`}
              </button>

              {loading && (
                <div className="flex-1 flex flex-col items-center justify-center py-12">
                  <div className="w-10 h-10 border-2 border-hairline border-t-near-black animate-spin mb-4" />
                  <p className="text-xs text-muted-slate">Generating virtual try-on…</p>
                  <p className="text-[10px] text-muted-slate mt-1">
                    This usually takes 5–15 seconds
                  </p>
                </div>
              )}

              {limitError && (
                <div className="mb-4">
                  <UpgradeBanner
                    error={limitError}
                    onDismiss={() => setLimitError(null)}
                  />
                </div>
              )}

              {error && (
                <div className="px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-xs mb-4">
                  {error}
                </div>
              )}

              {resultUrl && !loading && (
                <div className="flex-1">
                  <div className="mb-3">
                    <p className="text-xs font-mono text-muted-slate uppercase tracking-wider mb-2">
                      View angle
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {ANGLES.map((a) => {
                        const isActive = activeAngle === a.key;
                        const isLoading = angleLoading === a.key;
                        return (
                          <button
                            key={a.key}
                            onClick={() => handleAngle(a.key)}
                            disabled={isAngleLoading}
                            className={`px-3 py-1.5 text-xs border transition-colors disabled:opacity-50 ${
                              isActive
                                ? "border-near-black bg-near-black text-white"
                                : "border-hairline text-muted-slate hover:border-ink hover:text-ink"
                            }`}
                          >
                            <span className="mr-1">{a.icon}</span>
                            {isLoading ? "…" : a.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="relative">
                    <div className="relative w-full bg-stone overflow-hidden flex items-center justify-center" style={{ minHeight: "300px" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resultUrl}
                        alt="Virtual try-on result"
                        className={`w-full h-auto max-h-[60vh] object-contain transition-opacity ${
                          isAngleLoading ? "opacity-40" : "opacity-100"
                        }`}
                      />
                      {isAngleLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <div className="w-8 h-8 border-2 border-hairline border-t-near-black animate-spin mb-2" />
                          <p className="text-xs text-muted-slate">
                            Generating{" "}
                            {ANGLES.find((a) => a.key === angleLoading)?.label?.toLowerCase()}{" "}
                            view…
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Download / share */}
                    {!isAngleLoading && (
                      <div className="mt-2 flex gap-2">
                        <a
                          href={resultUrl}
                          download={`railory-tryon-${activeAngle ?? "front"}.png`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 py-2 text-center text-xs font-medium border border-hairline text-ink hover:border-ink transition-colors"
                        >
                          Download Image
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!resultUrl && !loading && !error && (
                <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-14 h-14 bg-stone flex items-center justify-center mb-4">
                    <span className="text-2xl text-muted-slate">👤</span>
                  </div>
                  <p className="text-xs text-muted-slate">
                    Select an avatar and garments, then hit generate
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
