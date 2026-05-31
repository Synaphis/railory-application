import Link from "next/link";

export default function OutfitNotFound() {
  return (
    <main className="min-h-screen bg-canvas flex flex-col items-center justify-center px-6 text-center">
      <div className="max-w-md">
        <p className="text-xs font-mono text-muted-slate uppercase tracking-wider mb-3">
          404
        </p>
        <h1 className="font-display text-3xl font-medium text-near-black mb-3 tracking-tight">
          Outfit not found
        </h1>
        <p className="text-sm text-muted-slate mb-8">
          This link doesn&rsquo;t lead anywhere we recognise. The outfit may have been removed,
          or the URL is incomplete.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/"
            className="px-6 py-2.5 bg-near-black text-white text-sm font-medium hover:bg-ink transition-colors"
          >
            Back to Railory
          </Link>
          <Link
            href="https://app.railory.io/signup"
            className="text-sm text-action-blue hover:underline"
          >
            Sign up
          </Link>
        </div>
      </div>
    </main>
  );
}
