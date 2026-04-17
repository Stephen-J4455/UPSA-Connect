// Supabase Edge Function: claude-bridge
// - Expects secrets: ANTHROPIC_API_KEY (required), ANTHROPIC_MODEL (optional)

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Task = "summary" | "quiz";

type SummaryResponse = {
  summary: {
    title: string;
    intro?: string;
    items: Array<{ title: string; bullets: string[] }>;
  };
};

type QuizResponse = {
  questions: Array<{
    id: string;
    question: string;
    options: string[];
    answerIndex: number;
    explanation?: string;
  }>;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractJson(text: string): unknown | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  const maybe = text.slice(start, end + 1);
  try {
    return JSON.parse(maybe);
  } catch {
    return null;
  }
}

async function callClaude(prompt: string) {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return { ok: false as const, error: "Missing ANTHROPIC_API_KEY secret." };
  }

  const model = Deno.env.get("ANTHROPIC_MODEL") ?? "claude-3-5-sonnet-20240620";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const payload = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      typeof payload === "object" && payload && "error" in payload
        ? JSON.stringify((payload as Record<string, unknown>).error)
        : "Claude request failed.";
    return { ok: false as const, error: message };
  }

  const text =
    typeof payload === "object" &&
    payload &&
    "content" in payload &&
    Array.isArray((payload as { content?: unknown }).content)
      ? (payload as { content: Array<{ type?: string; text?: string }> }).content
          .map((c) => (c?.type === "text" ? c.text ?? "" : ""))
          .join("")
          .trim()
      : "";

  return { ok: true as const, text };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const task = body?.task as Task | undefined;
  const input = typeof body?.input === "string" ? body.input.trim() : "";
  const questionCount =
    typeof body?.questionCount === "number" && Number.isFinite(body.questionCount)
      ? Math.max(3, Math.min(10, Math.floor(body.questionCount)))
      : 5;

  if (!task || (task !== "summary" && task !== "quiz")) {
    return jsonResponse({ error: "Unsupported task" }, 400);
  }

  if (!input) {
    return jsonResponse({ error: "Missing input" }, 400);
  }

  const prompt =
    task === "summary"
      ? `Return ONLY valid JSON (no markdown, no backticks) matching this shape:\n\n${JSON.stringify(
          {
            summary: {
              title: "Smart Summary",
              intro: "",
              items: [{ title: "", bullets: [""] }],
            },
          },
          null,
          2,
        )}\n\nTask: Create a concise study summary for a UPSA student. Use short bullet points.\nInput:\n${input}`
      : `Return ONLY valid JSON (no markdown, no backticks) matching this shape:\n\n${JSON.stringify(
          {
            questions: [
              {
                id: "q1",
                question: "",
                options: ["", "", "", ""],
                answerIndex: 0,
                explanation: "",
              },
            ],
          },
          null,
          2,
        )}\n\nTask: Create ${questionCount} multiple-choice questions. Each question must have exactly 4 options and a single correct answerIndex (0-3).\nInput topic:\n${input}`;

  const result = await callClaude(prompt);
  if (!result.ok) {
    return jsonResponse({ error: result.error }, 502);
  }

  const parsed = extractJson(result.text);
  if (parsed) {
    return jsonResponse(parsed);
  }

  // If Claude returned non-JSON, return as a string (client can fall back parsing).
  return jsonResponse(result.text);
});
