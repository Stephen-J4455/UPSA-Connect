// Supabase Edge Function: huggingface-bridge
// Required secret: HUGGINGFACE_API_KEY
// Optional fallback model secret: HUGGINGFACE_MODEL
// Optional DB secrets (for dynamic model lookup): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Expose-Headers": "x-model-id, x-model-source, x-model-source-reason",
};

const HF_CHAT_URL = "https://router.huggingface.co/v1/chat/completions";
const DEFAULT_MODEL = "meta-llama/Llama-3.1-8B-Instruct";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type RequestBody = {
  task?: "chat";
  prompt?: string;
  history?: ChatMessage[];
  stream?: boolean;
  maxTokens?: number;
};

type ModelRow = {
  model_id: string;
};

type ActiveModelLookup = {
  modelId: string | null;
  reason: string;
};

async function requireAuthenticatedUser(req: Request) {
  const apikeyHeader = (req.headers.get("apikey") ?? "").trim();

  const authorization = req.headers.get("authorization") ?? "";
  const bearerToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";

  // Treat requests that are authenticated only by the project `apikey` as anon.
  // This is the common mobile pattern: `apikey: <anon_jwt>` and optionally `Authorization: Bearer <anon_jwt>`.
  if (apikeyHeader && (!bearerToken || bearerToken === apikeyHeader)) {
    return { ok: true as const, userId: null, role: "anon" as const };
  }

  if (!bearerToken) {
    return { ok: false as const, error: "Missing bearer token." };
  }

  const supabaseUrlFromEnv = (Deno.env.get("SUPABASE_URL") ?? "").trim();
  const supabaseAnonKeyFromEnv = (Deno.env.get("SUPABASE_ANON_KEY") ?? "").trim();

  const supabaseUrl = supabaseUrlFromEnv || (() => {
    try {
      return new URL(req.url).origin;
    } catch {
      return "";
    }
  })();

  // Prefer the deployed env, but fall back to the request's apikey header.
  const supabaseAnonKey = supabaseAnonKeyFromEnv || apikeyHeader;

  if (!supabaseUrl || !supabaseAnonKey) {
    return { ok: false as const, error: "Missing Supabase auth env for token validation." };
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${bearerToken}` } },
  });

  const { data, error } = await authClient.auth.getUser(bearerToken);
  if (error || !data.user) {
    // If the caller at least has a valid project API key, allow as anon.
    if (apikeyHeader) {
      return { ok: true as const, userId: null, role: "anon" as const };
    }

    return { ok: false as const, error: "Invalid or expired auth token." };
  }

  return { ok: true as const, userId: data.user.id, role: "authenticated" as const };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getActiveModelFromDb(): Promise<ActiveModelLookup> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey) {
    return { modelId: null, reason: "missing-supabase-env" };
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase
    .from("ai_models")
    .select("model_id")
    .eq("provider", "huggingface")
    .eq("is_active", true)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<ModelRow>();

  if (error) {
    return { modelId: null, reason: `db-query-error:${error.code ?? "unknown"}` };
  }

  const modelId = data?.model_id?.trim();
  if (!modelId) {
    return { modelId: null, reason: "no-active-db-model" };
  }

  return { modelId, reason: "db-active-model" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const auth = await requireAuthenticatedUser(req);
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, 401);
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (body.task !== "chat") {
    return jsonResponse({ error: "Unsupported task" }, 400);
  }

  const prompt = (body.prompt ?? "").trim();
  if (!prompt) {
    return jsonResponse({ error: "Missing prompt" }, 400);
  }

  const apiKey = Deno.env.get("HUGGINGFACE_API_KEY");
  if (!apiKey) {
    return jsonResponse({ error: "Missing HUGGINGFACE_API_KEY secret." }, 500);
  }

  const fallbackModel = Deno.env.get("HUGGINGFACE_MODEL") ?? DEFAULT_MODEL;
  const activeModelLookup = await getActiveModelFromDb();
  const activeModel = activeModelLookup.modelId;
  const model = activeModel ?? fallbackModel;
  const modelSource = activeModel ? "db-active" : "secret-fallback";
  const modelSourceReason = activeModel ? "db-active-model" : activeModelLookup.reason;
  const stream = Boolean(body.stream);
  const maxTokens = Math.max(256, Math.min(4000, Number(body.maxTokens ?? 2000) || 2000));

  const history = Array.isArray(body.history)
    ? body.history
        .filter(
          (item): item is ChatMessage =>
            (item?.role === "user" || item?.role === "assistant") &&
            typeof item?.content === "string" &&
            item.content.trim().length > 0,
        )
        .slice(-20)
    : [];

  const response = await fetch(HF_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.5,
      max_tokens: maxTokens,
      stream,
      messages: [
        {
          role: "system",
          content:
            "You are an academic AI tutor for UPSA students. Give concise, accurate help and format all answers in markdown.",
        },
        ...history,
        { role: "user", content: prompt },
      ],
    }),
  });

  if (stream) {
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
      const fallback = `Hugging Face stream request failed (${response.status}).`;
      const detailed = payload?.error ? String(payload.error) : fallback;
      return jsonResponse({ error: detailed }, 502);
    }

    return new Response(response.body, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "x-model-id": model,
        "x-model-source": modelSource,
        "x-model-source-reason": modelSourceReason,
      },
    });
  }

  const payload = (await response.json().catch(() => null)) as
    | {
        choices?: Array<{
          message?: { content?: string; reasoning?: string; reasoning_content?: string };
          finish_reason?: string | null;
        }>;
        error?: unknown;
        model?: string;
      }
    | null;

  if (!response.ok) {
    const fallback = `Hugging Face request failed (${response.status}).`;
    const detailed = payload?.error ? String(payload.error) : fallback;
    return jsonResponse({ error: detailed }, 502);
  }

  const reply = payload?.choices?.[0]?.message?.content?.trim();
  if (!reply) {
    return jsonResponse({ error: "Hugging Face returned an empty response." }, 502);
  }

  const thinking = payload?.choices?.[0]?.message?.reasoning_content ?? payload?.choices?.[0]?.message?.reasoning;
  const finishReason = payload?.choices?.[0]?.finish_reason ?? null;

  return jsonResponse({
    reply,
    model: payload?.model ?? model,
    modelSource,
    modelSourceReason,
    truncated: finishReason === "length",
    thinking: typeof thinking === "string" ? thinking : undefined,
  });
});
