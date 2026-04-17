import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase";
import type { QuizQuestion, SmartSummary } from "@/types/models";

const CLAUDE_EDGE_FUNCTION = "claude-bridge";
const CLAUDE_BRIDGE_URL = `${supabaseUrl}/functions/v1/${CLAUDE_EDGE_FUNCTION}`;

type ClaudeSummaryResponse = {
  summary: SmartSummary;
};

type ClaudeQuizResponse = {
  questions: QuizQuestion[];
};

type ParsedBullet = {
  title: string;
  bullets: string[];
};

function parseBulletsFromText(raw: string): ParsedBullet[] {
  const lines = raw.split("\n").map((line) => line.trim());
  const sections: ParsedBullet[] = [];
  let current: ParsedBullet | null = null;

  for (const line of lines) {
    if (!line) continue;

    const heading = line.match(/^#{1,4}\s+(.*)$/)?.[1];
    if (heading) {
      current = { title: heading, bullets: [] };
      sections.push(current);
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      if (!current) {
        current = { title: "Key Point", bullets: [] };
        sections.push(current);
      }
      current.bullets.push(line.replace(/^[-*]\s+/, ""));
      continue;
    }

    if (!current) {
      current = { title: "Overview", bullets: [] };
      sections.push(current);
    }
    current.bullets.push(line);
  }

  return sections;
}

function toSummary(raw: unknown): SmartSummary {
  if (typeof raw === "object" && raw && "summary" in raw) {
    const payload = (raw as ClaudeSummaryResponse).summary;
    if (payload?.items?.length) {
      return payload;
    }
  }

  if (typeof raw === "string") {
    try {
      const json = JSON.parse(raw) as ClaudeSummaryResponse;
      if (json?.summary?.items?.length) {
        return json.summary;
      }
    } catch {
      const parsed = parseBulletsFromText(raw);
      return {
        title: "Smart Summary",
        items: parsed.map((section) => ({
          title: section.title,
          bullets: section.bullets,
        })),
      };
    }
  }

  return {
    title: "Smart Summary",
    intro: "No structured summary returned by AI.",
    items: [],
  };
}

async function invokeClaudeBridge(payload: Record<string, unknown>) {
  const response = await fetch(CLAUDE_BRIDGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      typeof data === "object" && data && "error" in data
        ? String((data as { error: unknown }).error)
        : `Claude bridge failed (${response.status}).`;
    throw new Error(message);
  }

  return data;
}

export async function summarizeTextWithClaude(text: string) {
  const data = await invokeClaudeBridge({
    task: "summary",
    input: text,
    responseFormat: "json",
  });

  return toSummary(data);
}

function toQuiz(raw: unknown): QuizQuestion[] {
  if (typeof raw === "object" && raw && "questions" in raw) {
    return (raw as ClaudeQuizResponse).questions;
  }

  if (typeof raw === "string") {
    try {
      return (JSON.parse(raw) as ClaudeQuizResponse).questions;
    } catch {
      return [];
    }
  }

  return [];
}

export async function generateQuizWithClaude(topic: string) {
  const data = await invokeClaudeBridge({
    task: "quiz",
    input: topic,
    responseFormat: "json",
    questionCount: 5,
  });

  return toQuiz(data);
}
