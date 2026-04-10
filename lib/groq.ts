import { supabase } from "@/lib/supabase";
import type {
  GroqQuizResponse,
  GroqSummaryResponse,
  QuizQuestion,
  SmartSummary,
} from "@/types/models";

const GROQ_EDGE_FUNCTION = "groq-bridge";

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
    const payload = (raw as GroqSummaryResponse).summary;
    if (payload?.items?.length) {
      return payload;
    }
  }

  if (typeof raw === "string") {
    try {
      const json = JSON.parse(raw) as GroqSummaryResponse;
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

export async function summarizeTextWithGroq(text: string) {
  const { data, error } = await supabase.functions.invoke(GROQ_EDGE_FUNCTION, {
    body: {
      task: "summary",
      input: text,
      responseFormat: "json",
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return toSummary(data);
}

function toQuiz(raw: unknown): QuizQuestion[] {
  if (typeof raw === "object" && raw && "questions" in raw) {
    return (raw as GroqQuizResponse).questions;
  }

  if (typeof raw === "string") {
    try {
      return (JSON.parse(raw) as GroqQuizResponse).questions;
    } catch {
      return [];
    }
  }

  return [];
}

export async function generateQuizWithGroq(topic: string) {
  const { data, error } = await supabase.functions.invoke(GROQ_EDGE_FUNCTION, {
    body: {
      task: "quiz",
      input: topic,
      responseFormat: "json",
      questionCount: 5,
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return toQuiz(data);
}

export async function transcribeSnapshotWithGroq(
  imageBase64: string,
  course: string,
) {
  const { data, error } = await supabase.functions.invoke(GROQ_EDGE_FUNCTION, {
    body: {
      task: "vision-transcribe",
      input: {
        imageBase64,
        course,
      },
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (typeof data === "object" && data && "transcript" in data) {
    return String((data as { transcript: string }).transcript);
  }

  return typeof data === "string" ? data : "No transcript returned.";
}
