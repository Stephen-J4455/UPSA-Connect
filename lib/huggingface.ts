type HuggingFaceMessage = {
  role: "user" | "assistant";
  content: string;
};

type HuggingFaceChatResult = {
  reply: string;
  model?: string;
  modelSource?: string;
  modelSourceReason?: string;
  truncated?: boolean;
  thinking?: string;
};

type StreamChatOptions = {
  onDelta: (chunk: string) => void;
  onThinkingDelta?: (chunk: string) => void;
  maxTokens?: number;
};

import { supabase } from "@/lib/supabase";
import { supabaseAnonKey } from "@/lib/supabase";
import { supabaseUrl } from "@/lib/supabase";

const HUGGING_FACE_EDGE_FUNCTION = "huggingface-bridge";

function buildBridgeUrl() {
  return `${supabaseUrl}/functions/v1/${HUGGING_FACE_EDGE_FUNCTION}`;
}

function bridgeHeaders() {
  return {
    "Content-Type": "application/json",
    apikey: supabaseAnonKey,
    Authorization: `Bearer ${supabaseAnonKey}`,
  };
}

function extractReply(payload: any): string {
  const raw = payload?.reply;
  if (typeof raw === "string") return raw.trim();
  return "";
}

export async function generateDetailedChatReplyWithHuggingFace(
  prompt: string,
  history: HuggingFaceMessage[],
  maxTokens = 2000,
): Promise<HuggingFaceChatResult> {
  const response = await fetch(buildBridgeUrl(), {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify({
      task: "chat",
      prompt,
      history,
      maxTokens,
    }),
  });

  const data = (await response.json().catch(() => null)) as
    | {
        reply?: unknown;
        model?: unknown;
        modelSource?: unknown;
        modelSourceReason?: unknown;
        truncated?: unknown;
        thinking?: unknown;
        error?: unknown;
      }
    | null;

  if (!response.ok) {
    const fallback = `Hugging Face bridge failed (${response.status}).`;
    const detailed = data?.error ? String(data.error) : fallback;
    throw new Error(detailed);
  }

  const reply = extractReply(data);
  if (!reply) {
    throw new Error("Hugging Face bridge returned an empty response.");
  }

  return {
    reply,
    model: typeof data?.model === "string" ? data.model : undefined,
    modelSource: typeof data?.modelSource === "string" ? data.modelSource : undefined,
    modelSourceReason:
      typeof data?.modelSourceReason === "string" ? data.modelSourceReason : undefined,
    truncated: Boolean(data?.truncated),
    thinking: typeof data?.thinking === "string" ? data.thinking : undefined,
  };
}

export async function generateChatReplyWithHuggingFace(
  prompt: string,
  history: HuggingFaceMessage[],
) {
  const result = await generateDetailedChatReplyWithHuggingFace(prompt, history);
  return result.reply;
}

export async function streamChatReplyWithHuggingFace(
  prompt: string,
  history: HuggingFaceMessage[],
  options: StreamChatOptions,
): Promise<HuggingFaceChatResult> {
  const response = await fetch(buildBridgeUrl(), {
    method: "POST",
    headers: bridgeHeaders(),
    body: JSON.stringify({
      task: "chat",
      prompt,
      history,
      stream: true,
      maxTokens: options.maxTokens ?? 2000,
    }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: unknown } | null;
    const fallback = `Hugging Face stream failed (${response.status}).`;
    const detailed = data?.error ? String(data.error) : fallback;
    throw new Error(detailed);
  }

  if (!response.body) {
    // Streaming not available in this runtime; fall back to non-streaming.
    const fallback = await generateDetailedChatReplyWithHuggingFace(
      prompt,
      history,
      options.maxTokens,
    );
    options.onDelta(fallback.reply);
    return fallback;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullReply = "";
  let fullThinking = "";
  let model: string | undefined = response.headers.get("x-model-id") ?? undefined;
  let modelSource: string | undefined =
    response.headers.get("x-model-source") ?? undefined;
  let modelSourceReason: string | undefined =
    response.headers.get("x-model-source-reason") ?? undefined;
  let finishReason: string | null = null;
  let isDone = false;

  while (!isDone) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || !line.startsWith("data:")) continue;

      const payload = line.slice(5).trim();
      if (payload === "[DONE]") {
        isDone = true;
        break;
      }

      let parsed: any;
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }

      if (typeof parsed?.model === "string") {
        model = parsed.model;
      }

      if (typeof parsed?.modelSource === "string") {
        modelSource = parsed.modelSource;
      }

      if (typeof parsed?.modelSourceReason === "string") {
        modelSourceReason = parsed.modelSourceReason;
      }

      const choice = parsed?.choices?.[0];
      const delta = choice?.delta ?? {};
      const chunk = typeof delta?.content === "string" ? delta.content : "";
      const thinkingChunk =
        typeof delta?.reasoning_content === "string"
          ? delta.reasoning_content
          : typeof delta?.reasoning === "string"
            ? delta.reasoning
            : "";

      if (chunk) {
        fullReply += chunk;
        options.onDelta(chunk);
      }

      if (thinkingChunk) {
        fullThinking += thinkingChunk;
        options.onThinkingDelta?.(thinkingChunk);
      }

      if (choice?.finish_reason) {
        finishReason = String(choice.finish_reason);
        isDone = true;
        break;
      }
    }
  }

  const reply = fullReply.trim();
  if (!reply) {
    throw new Error("Hugging Face stream returned an empty response.");
  }

  return {
    reply,
    model,
    modelSource,
    modelSourceReason,
    truncated: finishReason === "length",
    thinking: fullThinking.trim() || undefined,
  };
}
