"use client";

import { useRef, useEffect } from "react";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  placeholder?: string;
  submitLabel?: string;
}

export default function PromptInput({
  value,
  onChange,
  onSubmit,
  loading = false,
  placeholder = "Describe the vibe, occasion, or look you want…",
  submitLabel = "Generate",
}: PromptInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 200) + "px";
    }
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (!loading && value.trim()) onSubmit();
    }
  }

  return (
    <div className="space-y-2">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        placeholder={placeholder}
        disabled={loading}
        className="w-full bg-canvas border border-hairline px-4 py-3 text-sm text-ink placeholder-muted-slate focus:outline-none focus:border-near-black focus:ring-1 focus:ring-near-black resize-none leading-relaxed disabled:opacity-60"
      />
      <div className="flex items-center justify-between">
        <p className="text-muted-slate text-xs">⌘ + Enter</p>
        <button
          onClick={onSubmit}
          disabled={loading || !value.trim()}
          className="px-6 py-2.5 bg-near-black text-white text-sm font-medium hover:bg-ink disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Styling…
            </span>
          ) : (
            submitLabel
          )}
        </button>
      </div>
    </div>
  );
}
