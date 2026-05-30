import { createClient } from "@/lib/supabase/client";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

/**
 * Call a Supabase Edge Function with the current user's auth token.
 * Replaces direct `/api/*` fetch calls — the same Edge Functions
 * are callable from iOS / Android / web.
 */
export async function callEdgeFunction(
  functionName: string,
  options: {
    method?: string;
    body?: unknown;
    formData?: FormData;
    searchParams?: Record<string, string>;
  } = {}
): Promise<Response> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return new Response(JSON.stringify({ error: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(`${SUPABASE_URL}/functions/v1/${functionName}`);
  if (options.searchParams) {
    for (const [key, value] of Object.entries(options.searchParams)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${session.access_token}`,
  };

  let body: BodyInit | undefined;

  if (options.formData) {
    // FormData — don't set Content-Type, browser adds multipart boundary
    body = options.formData;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  return fetch(url.toString(), {
    method: options.method ?? (body ? "POST" : "GET"),
    headers,
    body,
  });
}
