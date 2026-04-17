import { supabase } from "@/lib/supabase";

export type StoredConversation = {
  id: string;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type StoredConversationMessage = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  model: string | null;
  thinking: any; // jsonb
  created_at: string;
};

function normalizeThinkingValue(value: unknown) {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return { reasoning: value };
    }
  }
  return value;
}

export async function listConversations(userId: string, limit = 40) {
  const safeLimit = Math.max(1, Math.min(100, limit));
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, user_id, title, created_at, updated_at")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false })
    .limit(safeLimit)
    .returns<StoredConversation[]>();

  if (error) throw error;
  return data ?? [];
}

export async function getLatestConversation(userId: string) {
  const { data, error } = await supabase
    .from("ai_conversations")
    .select("id, user_id, title, created_at, updated_at")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<StoredConversation>();

  if (error) throw error;
  return data;
}

export async function createConversation(userId: string, title: string | null = null) {
  const { data, error } = await supabase
    .from("ai_conversations")
    .insert({ user_id: userId, title })
    .select("id, user_id, title, created_at, updated_at")
    .single<StoredConversation>();

  if (error) throw error;
  return data;
}

export async function touchConversation(conversationId: string) {
  const { error } = await supabase
    .from("ai_conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (error) throw error;
}

export async function getConversationMessages(conversationId: string) {
  const { data, error } = await supabase
    .from("ai_conversation_messages")
    .select("id, conversation_id, user_id, role, content, model, thinking, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .returns<StoredConversationMessage[]>();

  if (error) throw error;

  return (data ?? []).map((msg) => ({
    ...msg,
    thinking: normalizeThinkingValue(msg.thinking),
  }));
}

export async function saveConversationMessage(input: {
  conversationId: string;
  userId: string;
  role: "user" | "assistant";
  content: string;
  model?: string;
  thinking?: any;
}) {
  const { data, error } = await supabase
    .from("ai_conversation_messages")
    .insert({
      conversation_id: input.conversationId,
      user_id: input.userId,
      role: input.role,
      content: input.content,
      model: input.model ?? null,
      thinking: input.thinking ?? null,
    })
    .select("id, conversation_id, user_id, role, content, model, thinking, created_at")
    .single<StoredConversationMessage>();

  if (error) throw error;

  await touchConversation(input.conversationId);
  return data;
}
