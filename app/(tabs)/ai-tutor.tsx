import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import Markdown from "react-native-markdown-display";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, FontSize, FontWeight, Radius, Shadows, Spacing } from "@/constants/theme";
import {
  createConversation,
  getConversationMessages,
  listConversations,
  saveConversationMessage,
  type StoredConversation,
} from "@/lib/ai-chat";
import { streamChatReplyWithHuggingFace } from "@/lib/huggingface";
import { getSlideExtractText } from "@/lib/slides";
import { useAuth } from "@/providers/auth-provider";

type CodeToken = {
  text: string;
  color?: string;
  fontWeight?: "400" | "500" | "600" | "700";
  fontStyle?: "normal" | "italic";
};

const JS_KEYWORDS = new Set([
  "const",
  "let",
  "var",
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "break",
  "continue",
  "try",
  "catch",
  "finally",
  "throw",
  "new",
  "class",
  "extends",
  "super",
  "import",
  "from",
  "export",
  "default",
  "async",
  "await",
  "typeof",
  "instanceof",
  "in",
  "of",
  "true",
  "false",
  "null",
  "undefined",
]);

const PY_KEYWORDS = new Set([
  "def",
  "return",
  "if",
  "elif",
  "else",
  "for",
  "while",
  "break",
  "continue",
  "try",
  "except",
  "finally",
  "raise",
  "import",
  "from",
  "as",
  "class",
  "pass",
  "lambda",
  "with",
  "yield",
  "True",
  "False",
  "None",
]);

const DIAGRAM_KEYWORDS = new Set([
  "graph",
  "flowchart",
  "subgraph",
  "end",
  "classdiagram",
  "sequencediagram",
  "statediagram-v2",
  "erdiagram",
  "direction",
  "left",
  "right",
  "top",
  "bottom",
]);

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  thinking?: {
    model?: string;
    modelSource?: string;
    modelSourceReason?: string;
    responseTimeMs?: number;
    truncated?: boolean;
    reasoning?: string;
  };
};

type SlideAttachmentContext = {
  id: string;
  path: string;
  name: string;
  source: "local" | "remote";
  uri?: string;
  extractedText?: string;
  extractionError?: string;
};

const QUICK_PROMPTS = [
  "Explain Porters Five Forces with UPSA examples",
  "Summarize Financial Accounting lecture notes",
  "Create a quiz for IT governance concepts",
  "Break down Marketing mix in simple terms",
];

// Helper functions for chat history
function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
  const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInMinutes < 1) return "Just now";
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  if (diffInHours < 24) return `${diffInHours}h ago`;
  if (diffInDays === 1) return "Yesterday";
  if (diffInDays < 7) return `${diffInDays}d ago`;
  if (diffInDays < 30) return `${Math.floor(diffInDays / 7)}w ago`;
  return date.toLocaleDateString();
}

function groupConversationsByDate(conversations: StoredConversation[]) {
  const groups: { [key: string]: StoredConversation[] } = {};
  const now = new Date();

  conversations.forEach((conv) => {
    const date = new Date(conv.updated_at);
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    let groupKey: string;
    if (diffInDays === 0) {
      groupKey = "Today";
    } else if (diffInDays === 1) {
      groupKey = "Yesterday";
    } else if (diffInDays < 7) {
      groupKey = "This Week";
    } else if (diffInDays < 30) {
      groupKey = "This Month";
    } else {
      groupKey = "Older";
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(conv);
  });

  // Sort groups by recency
  const groupOrder = ["Today", "Yesterday", "This Week", "This Month", "Older"];
  const sortedGroups: { [key: string]: StoredConversation[] } = {};

  groupOrder.forEach((key) => {
    if (groups[key]) {
      sortedGroups[key] = groups[key];
    }
  });

  return sortedGroups;
}

export default function AITutorScreen() {
  const params = useLocalSearchParams<{
    handoffId?: string;
    slidePath?: string;
    slideName?: string;
    slideSource?: "local" | "remote";
    slideUri?: string;
  }>();
  const mode = useColorScheme() === "dark" ? "dark" : "light";
  const theme = Colors[mode];
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const codePalette = useMemo(
    () =>
      mode === "dark"
        ? {
            plain: "#D4D4D4",
            keyword: "#C586C0",
            string: "#CE9178",
            number: "#B5CEA8",
            comment: "#6A9955",
            functionName: "#DCDCAA",
            typeName: "#4EC9B0",
            operator: "#D4D4D4",
            punctuation: "#808080",
            property: "#9CDCFE",
          }
        : {
            plain: "#24292F",
            keyword: "#8250DF",
            string: "#0A3069",
            number: "#0550AE",
            comment: "#6E7781",
            functionName: "#953800",
            typeName: "#116329",
            operator: "#57606A",
            punctuation: "#57606A",
            property: "#0550AE",
          },
    [mode],
  );

  const tokenizeCode = useMemo(() => {
    const keywordSetForLang = (lang: string) => {
      if (["py", "python"].includes(lang)) return PY_KEYWORDS;
      if (["mermaid", "plantuml", "graphviz", "dot", "d2"].includes(lang)) return DIAGRAM_KEYWORDS;
      return JS_KEYWORDS;
    };

    // RN-safe token highlighter with editor-like categories.
    return (code: string, lang: string): CodeToken[] => {
      const keywordSet = keywordSetForLang(lang);
      const tokens: CodeToken[] = [];

      // Pattern priority keeps larger syntactic units intact first.
      const pattern =
        /(\/\*[\s\S]*?\*\/|\/\/.*?$|#.*?$|`(?:\\.|[^`])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Z][A-Za-z0-9_]*\b|\b[A-Za-z_][A-Za-z0-9_]*(?=\s*\()\b|\b[A-Za-z_][A-Za-z0-9_]*\b|=>|->|-->|===|!==|==|!=|<=|>=|&&|\|\||[+\-*/%=<>!&|^~?:]+|[()[\]{}.,;])/gm;

      let lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(code)) !== null) {
        const start = match.index;
        const raw = match[0];
        const lowerRaw = raw.toLowerCase();

        if (start > lastIndex) {
          tokens.push({ text: code.slice(lastIndex, start), color: codePalette.plain });
        }

        const isComment = raw.startsWith("//") || raw.startsWith("/*") || raw.startsWith("#");
        const isString = raw.startsWith("\"") || raw.startsWith("'") || raw.startsWith("`");
        const isNumber = /^\d/.test(raw);
        const isTypeName = /^[A-Z][A-Za-z0-9_]*$/.test(raw);
        const nextNonSpaceChar = code.slice(start + raw.length).match(/^\s*(.)/)?.[1] ?? "";
        const isFunctionName = /^[A-Za-z_][A-Za-z0-9_]*$/.test(raw) && nextNonSpaceChar === "(";
        const isIdentifier = /^[A-Za-z_][A-Za-z0-9_]*$/.test(raw);
        const isOperator = /^(=>|->|-->|===|!==|==|!=|<=|>=|&&|\|\||[+\-*/%=<>!&|^~?:]+)$/.test(raw);
        const isPunctuation = /^[()[\]{}.,;]$/.test(raw);

        if (isComment) {
          tokens.push({ text: raw, color: codePalette.comment, fontStyle: "italic" });
        } else if (isString) {
          tokens.push({ text: raw, color: codePalette.string });
        } else if (isNumber) {
          tokens.push({ text: raw, color: codePalette.number });
        } else if (isTypeName && !keywordSet.has(lowerRaw) && !keywordSet.has(raw)) {
          tokens.push({ text: raw, color: codePalette.typeName });
        } else if (isFunctionName && !keywordSet.has(raw) && !keywordSet.has(lowerRaw)) {
          tokens.push({ text: raw, color: codePalette.functionName });
        } else if (isIdentifier && (keywordSet.has(raw) || keywordSet.has(lowerRaw))) {
          tokens.push({ text: raw, color: codePalette.keyword, fontWeight: "700" });
        } else if (isOperator) {
          tokens.push({ text: raw, color: codePalette.operator });
        } else if (isPunctuation) {
          tokens.push({ text: raw, color: codePalette.punctuation });
        } else if (isIdentifier) {
          tokens.push({ text: raw, color: codePalette.property });
        } else {
          tokens.push({ text: raw, color: codePalette.plain });
        }

        lastIndex = start + raw.length;
      }

      if (lastIndex < code.length) {
        tokens.push({ text: code.slice(lastIndex), color: codePalette.plain });
      }

      return tokens;
    };
  }, [codePalette]);

  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [composerHeight, setComposerHeight] = useState(88);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [keyboardShown, setKeyboardShown] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState<Record<string, boolean>>({});
  const [thinkingPulse, setThinkingPulse] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoadingConversationId, setHistoryLoadingConversationId] = useState<string | null>(null);
  const [historyItems, setHistoryItems] = useState<StoredConversation[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [slideAttachment, setSlideAttachment] = useState<SlideAttachmentContext | null>(null);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const lastSlideHandoffRef = useRef<string | null>(null);

  const mapStoredMessagesToChat = (
    rows: { id: string; role: "user" | "assistant"; content: string; thinking?: any }[],
  ): ChatMessage[] =>
    rows.map((row) => ({
      id: row.id,
      role: row.role,
      text: row.content,
      thinking: row.thinking ?? undefined,
    }));

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    const getKeyboardOverlap = (screenY: number) => {
      const windowHeight = Dimensions.get("window").height;
      return Math.max(0, windowHeight - screenY);
    };

    if (Platform.OS === "ios") {
      const frameChangeSub = Keyboard.addListener("keyboardWillChangeFrame", (event) => {
        setKeyboardOffset(getKeyboardOverlap(event.endCoordinates.screenY));
        setKeyboardShown(event.endCoordinates.screenY < Dimensions.get("window").height);
      });

      const hideSub = Keyboard.addListener("keyboardWillHide", () => {
        setKeyboardOffset(0);
        setKeyboardShown(false);
      });

      return () => {
        frameChangeSub.remove();
        hideSub.remove();
      };
    }

    const showSub = Keyboard.addListener("keyboardDidShow", (event) => {
      setKeyboardOffset(event.endCoordinates.height);
      setKeyboardShown(true);
    });

    const hideSub = Keyboard.addListener("keyboardDidHide", () => {
      setKeyboardOffset(0);
      setKeyboardShown(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    setHistoryOpen(false);
    setHistoryError(null);
    setHistoryItems([]);
    setHistoryLoaded(false);
    setHistoryLoading(false);
    setHistoryLoadingConversationId(null);
    setSlideAttachment(null);
    setAttachmentLoading(false);
  }, [user?.id]);

  useEffect(() => {
    const handoffId = Array.isArray(params.handoffId) ? params.handoffId[0] : params.handoffId;
    const slidePath = Array.isArray(params.slidePath) ? params.slidePath[0] : params.slidePath;
    const slideName = Array.isArray(params.slideName) ? params.slideName[0] : params.slideName;
    const slideSource = Array.isArray(params.slideSource) ? params.slideSource[0] : params.slideSource;
    const slideUri = Array.isArray(params.slideUri) ? params.slideUri[0] : params.slideUri;

    if (!handoffId || !slidePath || !slideName || !slideSource) return;
    if (lastSlideHandoffRef.current === handoffId) return;

    lastSlideHandoffRef.current = handoffId;
    setAttachmentLoading(true);
    setSlideAttachment({
      id: handoffId,
      path: slidePath,
      name: slideName,
      source: slideSource,
      uri: slideUri,
    });

    let cancelled = false;

    const hydrateAttachmentFromSlide = async () => {
      let extractedText = "";
      let extractionError: string | undefined;

      try {
        extractedText = await getSlideExtractText(slidePath);
      } catch (error) {
        console.warn("Unable to preload extracted slide text", error);
        extractionError =
          error instanceof Error
            ? error.message
            : "Unable to extract text from this file.";
      }

      if (cancelled) return;

      const snippet = extractedText.trim().slice(0, 4500);
      setSlideAttachment({
        id: handoffId,
        path: slidePath,
        name: slideName,
        source: slideSource,
        uri: slideUri,
        extractedText: snippet || undefined,
        extractionError: snippet ? undefined : extractionError,
      });

      setPrompt((previous) => {
        if (previous.trim().length > 0) {
          return previous;
        }

        return `Help me study this file: ${slideName}. Summarize it and create revision questions.`;
      });
      setAttachmentLoading(false);
    };

    void hydrateAttachmentFromSlide();

    return () => {
      cancelled = true;
    };
  }, [params.handoffId, params.slideName, params.slidePath, params.slideSource, params.slideUri]);

  useEffect(() => {
    if (!busy) {
      setThinkingPulse(0);
      return;
    }

    const timer = setInterval(() => {
      setThinkingPulse((value) => (value + 1) % 4);
    }, 300);

    return () => clearInterval(timer);
  }, [busy]);

  const markdownStyles = useMemo(
    () => ({
      body: {
        color: theme.text,
        fontSize: FontSize.sm,
        lineHeight: 20,
      },
      paragraph: {
        color: theme.text,
        marginTop: 0,
        marginBottom: 8,
      },
      strong: {
        color: theme.cta,
        fontWeight: FontWeight.bold,
      },
      em: {
        color: theme.textMuted,
      },
      heading1: {
        color: theme.tint,
        fontSize: FontSize.xl,
        fontWeight: FontWeight.bold,
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
      },
      heading2: {
        color: theme.cta,
        fontSize: FontSize.lg,
        fontWeight: FontWeight.bold,
        marginTop: Spacing.md,
        marginBottom: Spacing.sm,
      },
      heading3: {
        color: theme.textSubtle,
        fontSize: FontSize.md,
        fontWeight: FontWeight.bold,
        marginTop: Spacing.sm,
        marginBottom: Spacing.sm,
      },
      bullet_list: {
        color: theme.text,
      },
      ordered_list: {
        color: theme.text,
      },
      list_item: {
        color: theme.text,
      },
      code_inline: {
        color: theme.cta,
        backgroundColor: theme.surfaceMuted,
        borderRadius: Radius.sm,
        paddingHorizontal: 4,
        paddingVertical: 1,
      },
      blockquote: {
        borderLeftColor: theme.borderStrong,
        borderLeftWidth: 3,
        paddingLeft: Spacing.sm,
        paddingVertical: Spacing.sm,
        paddingRight: Spacing.sm,
        borderRadius: Radius.md,
        backgroundColor: theme.surfaceElevated,
        color: theme.text,
        fontStyle: "italic",
      },
      link: {
        color: theme.tint,
        textDecorationLine: "underline" as const,
      },
      table: {
        borderWidth: 1,
        borderColor: theme.borderStrong,
        borderRadius: Radius.md,
        overflow: "hidden",
        marginBottom: Spacing.sm,
      },
      thead: {
        backgroundColor: theme.surfaceElevated,
      },
      tbody: {
        backgroundColor: theme.surface,
      },
      th: {
        color: theme.tint,
        fontWeight: FontWeight.bold,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: theme.borderStrong,
      },
      tr: {
        borderBottomWidth: 1,
        borderBottomColor: theme.border,
      },
      td: {
        color: theme.text,
        paddingVertical: 8,
        paddingHorizontal: 10,
      },
      hr: {
        backgroundColor: theme.border,
        height: 1,
        marginVertical: Spacing.sm,
      },
    }),
    [theme],
  );

  const markdownRules = useMemo(
    () => {
      const renderCodeLikeBlock = (node: any) => {
        const language = String(node?.lang || node?.sourceInfo || "text").toLowerCase();
        const content = node?.content || "";
        const isDiagram = ["mermaid", "plantuml", "graphviz", "dot", "d2"].includes(language);

        if (isDiagram) {
          const diagramTokens = tokenizeCode(content, language);
          return (
            <View
              style={[
                styles.diagramCard,
                {
                  backgroundColor: theme.surfaceMuted,
                  borderColor: theme.borderStrong,
                },
              ]}
            >
              <Text style={[styles.diagramLabel, { color: theme.tint }]}>Diagram ({language})</Text>
              <Text style={[styles.diagramSource, { color: theme.text }]}>
                {diagramTokens.map((token, index) => (
                  <Text
                    key={`${index}-${token.text.length}`}
                    style={{
                      color: token.color ?? theme.text,
                      fontWeight: token.fontWeight,
                      fontStyle: token.fontStyle,
                    }}
                  >
                    {token.text}
                  </Text>
                ))}
              </Text>
            </View>
          );
        }

        const codeTokens = tokenizeCode(content, language);
        return (
          <View
            style={[
              styles.codeBlock,
              {
                backgroundColor: theme.surfaceMuted,
                borderColor: theme.border,
              },
            ]}
          >
            <Text style={[styles.codeBlockText, { color: theme.text }]}>
              {codeTokens.map((token, index) => (
                <Text
                  key={`${index}-${token.text.length}`}
                  style={{
                    color: token.color ?? theme.text,
                    fontWeight: token.fontWeight,
                    fontStyle: token.fontStyle,
                  }}
                >
                  {token.text}
                </Text>
              ))}
            </Text>
          </View>
        );
      };

      return {
        blockquote: (node: any, children: any) => {
          const textSample = String(node?.children?.[0]?.children?.[0]?.content || "").toLowerCase();
          const isTip = textSample.includes("tip");
          const isWarning = textSample.includes("warning") || textSample.includes("caution");
          const isNote = textSample.includes("note");

          const blockBg = isWarning
            ? mode === "dark"
              ? "#3A2516"
              : "#FFF4E5"
            : isTip
              ? mode === "dark"
                ? "#123427"
                : "#E7F8EE"
              : isNote
                ? mode === "dark"
                  ? "#102944"
                  : "#EAF2FA"
                : theme.surfaceElevated;

          const blockBorder = isWarning ? theme.accent : isTip ? theme.tint : theme.borderStrong;

          return (
            <View key={node.key} style={[styles.quoteCard, { backgroundColor: blockBg, borderColor: blockBorder }]}> 
              {children}
            </View>
          );
        },
        code_block: renderCodeLikeBlock,
        fence: renderCodeLikeBlock,
      };
    },
    [mode, theme, tokenizeCode],
  );

  const groupedHistoryItems = useMemo(() => {
    const filtered = historyItems.filter((item) =>
      historySearchQuery === "" ||
      (item.title?.toLowerCase().includes(historySearchQuery.toLowerCase()) ?? false)
    );
    return groupConversationsByDate(filtered);
  }, [historyItems, historySearchQuery]);

  const pushMessage = (message: ChatMessage) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setMessages((previous) => [...previous, message]);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
  };

  const replaceMessage = (id: string, updater: (message: ChatMessage) => ChatMessage) => {
    setMessages((previous) => previous.map((message) => (message.id === id ? updater(message) : message)));
  };

  const getConversationId = async (seedPrompt: string) => {
    if (conversationId) return conversationId;

    if (user?.id) {
      try {
        const created = await createConversation(user.id, seedPrompt.slice(0, 90));
        setConversationId(created.id);
        return created.id;
      } catch (error) {
        console.warn("Unable to create Supabase conversation; using local draft id.", error);
      }
    }

    const localId = `local-${Date.now()}`;
    setConversationId(localId);
    return localId;
  };

  const saveMessageIfAuthenticated = async (input: {
    conversationIdValue: string;
    role: "user" | "assistant";
    content: string;
    model?: string;
    thinking?: any;
  }) => {
    if (!user?.id) return;
    if (!input.conversationIdValue || input.conversationIdValue.startsWith("local-")) return;

    try {
      await saveConversationMessage({
        conversationId: input.conversationIdValue,
        userId: user.id,
        role: input.role,
        content: input.content,
        model: input.model,
        thinking: input.thinking,
      });
    } catch (error) {
      console.warn("Failed to save chat message to Supabase", error);
    }
  };

  const handleNewConversation = () => {
    if (busy) return;

    setMessages([]);
    setPrompt("");
    setTypingMessageId(null);
    setThinkingExpanded({});
    setConversationId(null);
    setSlideAttachment(null);
    setAttachmentLoading(false);
  };

  const handleOpenHistory = async () => {
    if (!user?.id) {
      Alert.alert("AI Tutor", "Sign in to view conversation history.");
      return;
    }

    setHistoryOpen(true);

    // Only load history if not already loaded
    if (!historyLoaded) {
      setHistoryLoading(true);
      setHistoryError(null);

      try {
        const conversations = await listConversations(user.id, 60);
        setHistoryItems(conversations);
        setHistoryLoaded(true);
      } catch (error) {
        console.warn("Failed to load conversation history", error);
        setHistoryError("Unable to load conversation history.");
      } finally {
        setHistoryLoading(false);
      }
    }
  };

  const handleHistoryConversationPress = async (selectedConversationId: string) => {
    if (busy) {
      Alert.alert("AI Tutor", "Please wait for the current response to finish.");
      return;
    }

    setHistoryLoadingConversationId(selectedConversationId);
    try {
      const storedMessages = await getConversationMessages(selectedConversationId);
      setMessages(mapStoredMessagesToChat(storedMessages));
      setConversationId(selectedConversationId);
      setPrompt("");
      setTypingMessageId(null);
      setThinkingExpanded({});
      setSlideAttachment(null);
      setAttachmentLoading(false);
      setHistoryOpen(false);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollToEnd({ animated: false });
      });
    } catch (error) {
      console.warn("Failed to load selected conversation", error);
      Alert.alert("AI Tutor", "Unable to open this conversation right now.");
    } finally {
      setHistoryLoadingConversationId(null);
    }
  };

  const toggleThinking = (messageId: string) => {
    setThinkingExpanded((previous) => ({
      ...previous,
      [messageId]: !previous[messageId],
    }));
  };

  const getPromptValue = () => {
    const value = prompt.trim();
    if (!value) {
      Alert.alert("AI Tutor", "Enter a prompt first.");
      return null;
    }
    return value;
  };

  const handleSend = async () => {
    const value = getPromptValue();
    if (!value) return;

    const attachmentContext = slideAttachment
      ? [
          `Attached file: ${slideAttachment.name}`,
          slideAttachment.path ? `Slide path: ${slideAttachment.path}` : null,
          slideAttachment.uri ? `Local URI: ${slideAttachment.uri}` : null,
          slideAttachment.extractedText
            ? `Extracted file content:\n${slideAttachment.extractedText}`
            : slideAttachment.extractionError
              ? `Extraction note: ${slideAttachment.extractionError}`
              : "Extraction note: file content extraction is unavailable for this file.",
        ]
          .filter(Boolean)
          .join("\n\n")
      : "";

    const valueForModel = attachmentContext ? `${value}\n\n${attachmentContext}` : value;
    const displayValue = slideAttachment
      ? `${value}\n\n[Attached file: ${slideAttachment.name}]`
      : value;

    const sentAt = Date.now();
    const assistantMessageId = `assistant-${Date.now()}`;
    setPrompt("");
    setBusy(true);

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: displayValue,
    };
    pushMessage(userMessage);

    try {
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        text: "",
        thinking: {
          model: "Hugging Face",
          modelSource: "stream",
        },
      };
      pushMessage(assistantMessage);
      setTypingMessageId(assistantMessage.id);

      const conversationIdValue = await getConversationId(value);
      await saveMessageIfAuthenticated({
        conversationIdValue,
        role: "user",
        content: valueForModel,
      });

      const baseHistory = [
        ...messages.map((message) => ({
          role: message.role,
          content: message.text,
        })),
        {
          role: "user" as const,
          content: valueForModel,
        },
      ];

      const streamPrompt = valueForModel;

      const normalizedHistory = baseHistory.map((message) => ({
        role: message.role,
        content: message.content,
      }));

      let streamingText = "";
      let streamingThinking = "";

      const appendChunk = (chunk: string) => {
        if (!chunk) return;
        streamingText += chunk;
        replaceMessage(assistantMessageId, (message) => ({
          ...message,
          text: streamingText,
        }));
        requestAnimationFrame(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        });
      };

      const appendThinkingChunk = (chunk: string) => {
        if (!chunk) return;
        streamingThinking += chunk;
        replaceMessage(assistantMessageId, (message) => ({
          ...message,
          thinking: {
            ...message.thinking,
            reasoning: streamingThinking,
          },
        }));
      };

      const firstPass = await streamChatReplyWithHuggingFace(streamPrompt, normalizedHistory, {
        onDelta: appendChunk,
        onThinkingDelta: appendThinkingChunk,
        maxTokens: 2000,
      });

      let finalThinking = firstPass.thinking ?? streamingThinking;
      let finalModel = firstPass.model;
      let finalModelSource = firstPass.modelSource;
      let finalModelSourceReason = firstPass.modelSourceReason;
      let truncated = Boolean(firstPass.truncated);

      if (truncated) {
        const continuationPrompt = "Continue exactly from where you stopped. Do not repeat previous text.";
        const continuationHistory = [
          ...baseHistory,
          { role: "assistant" as const, content: streamingText },
        ];

        const continuation = await streamChatReplyWithHuggingFace(
          continuationPrompt,
          continuationHistory,
          {
            onDelta: appendChunk,
            onThinkingDelta: appendThinkingChunk,
            maxTokens: 1600,
          },
        );

        finalThinking = [finalThinking, continuation.thinking].filter(Boolean).join("\n");
        finalModel = continuation.model ?? finalModel;
        finalModelSource = continuation.modelSource ?? finalModelSource;
        finalModelSourceReason = continuation.modelSourceReason ?? finalModelSourceReason;
        truncated = Boolean(continuation.truncated);
      }

      const responseTimeMs = Date.now() - sentAt;
      replaceMessage(assistantMessageId, (message) => ({
        ...message,
        text: streamingText,
        thinking: {
          model: finalModel,
          modelSource: finalModelSource,
          modelSourceReason: finalModelSourceReason,
          responseTimeMs,
          truncated,
          reasoning: finalThinking || undefined,
        },
      }));

      await saveMessageIfAuthenticated({
        conversationIdValue,
        role: "assistant",
        content: streamingText,
        model: finalModel,
        thinking: {
          model: finalModel,
          modelSource: finalModelSource,
          modelSourceReason: finalModelSourceReason,
          responseTimeMs,
          truncated,
          reasoning: finalThinking || undefined,
        },
      });
    } catch (error) {
      replaceMessage(assistantMessageId, (message) => ({
        ...message,
        text:
          message.text?.trim() ||
          "I could not complete this response. Please try again.",
      }));
      setTypingMessageId(null);
      Alert.alert(
        "AI Tutor",
        error instanceof Error ? error.message : "Unable to get a response from Hugging Face.",
      );
    } finally {
      setTypingMessageId(null);
      setBusy(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <View style={[styles.promptToolbar, { paddingTop: insets.top + Spacing.sm }]}>
        <View style={styles.promptToolbarLeft}>
          <Pressable
            onPress={handleOpenHistory}
            accessibilityRole="button"
            accessibilityLabel="Open conversation history"
            style={({ pressed }) => [
              styles.historyButton,
              {
                borderColor: theme.border,
                backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
              },
            ]}
          >
           <View style={[styles.historyPanelIcon, { backgroundColor: theme.tint + "20" }]}>
                  <Ionicons name="menu" size={18} color={theme.tint} />
                </View>
          </Pressable>
          <Text style={[styles.promptToolbarTitle, { color: theme.textMuted }]}>Professional AI</Text>
        </View>
        <Pressable
          onPress={handleNewConversation}
          accessibilityRole="button"
          accessibilityLabel="Start new conversation"
          style={({ pressed }) => [
            styles.newChatButton,
            {
              backgroundColor: pressed ? theme.ctaPressed : theme.cta,
              opacity: 1,
            },
          ]}
        >
          <Ionicons name="create-sharp" size={25} color={theme.tint} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: Spacing.sm,
            paddingBottom: composerHeight + Math.max(insets.bottom, Spacing.sm) + Spacing.lg + (keyboardShown ? keyboardOffset : 0),
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.quickPromptsLabel, { color: theme.textMuted }]}>Quick prompts</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.promptRow}
        >
          {QUICK_PROMPTS.map((item) => (
            <Pressable
              key={item}
              onPress={() => setPrompt(item)}
              style={[styles.promptChip, { borderColor: theme.border, backgroundColor: theme.surface }]}
            >
              <Text style={[styles.promptChipText, { color: theme.text }]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {slideAttachment ? (
          <View
            style={[
              styles.attachmentCard,
              {
                borderColor: theme.border,
                backgroundColor: theme.surface,
              },
            ]}
          >
            <View style={styles.attachmentCardLeft}>
              <View style={[styles.attachmentIcon, { borderColor: theme.border, backgroundColor: theme.surfaceMuted }]}> 
                <Ionicons name="document-text-outline" size={16} color={theme.tint} />
              </View>
              <View style={styles.attachmentCopy}>
                <Text numberOfLines={1} style={[styles.attachmentTitle, { color: theme.text }]}>
                  {slideAttachment.name}
                </Text>
                <Text numberOfLines={1} style={[styles.attachmentMeta, { color: theme.textMuted }]}>
                  {attachmentLoading
                    ? "Extracting file content..."
                    : slideAttachment.extractedText
                      ? "File attached and extracted for AI"
                      : "File attached (metadata only)"}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => {
                setSlideAttachment(null);
                setAttachmentLoading(false);
              }}
              accessibilityRole="button"
              accessibilityLabel="Remove attached file"
              style={({ pressed }) => [
                styles.attachmentRemoveButton,
                {
                  borderColor: theme.border,
                  backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
                },
              ]}
            >
              <Ionicons name="close" size={14} color={theme.textSubtle} />
            </Pressable>
          </View>
        ) : null}

        <View style={styles.chatThread}>
          {messages.length === 0 ? (
            <View
              style={[
                styles.emptyState,
                { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow },
              ]}
            >
              <View style={[styles.emptyIcon, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                <Ionicons name="sparkles" size={18} color={theme.tint} />
              </View>
              <View style={styles.emptyCopy}>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>AI Tutor</Text>
                <Text style={[styles.emptyText, { color: theme.textMuted }]}>
                  Ask for explanations, summaries, examples, or quizzes. Responses are markdown formatted.
                </Text>
              </View>
            </View>
          ) : null}

          {messages.map((message) => {
            const isUser = message.role === "user";
            const isThinkingOpen = Boolean(thinkingExpanded[message.id]);
            const sourceReason =
              message.thinking?.modelSource === "secret-fallback" && message.thinking?.modelSourceReason
                ? `Reason: ${message.thinking.modelSourceReason}`
                : null;
            const collapsedSummary = [
              message.thinking?.modelSource ? `Source: ${message.thinking.modelSource}` : null,
              typeof message.thinking?.responseTimeMs === "number"
                ? `Latency: ${message.thinking.responseTimeMs} ms`
                : null,
              sourceReason,
            ]
              .filter(Boolean)
              .join(" | ");
            const liveThinking = typingMessageId === message.id && busy;

            if (isUser) {
              return (
                <View key={message.id} style={styles.userMessageRow}>
                  <View
                    style={[styles.messageCard, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}
                  >
                    <View style={[styles.messageIcon, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                      <Ionicons name="person-outline" size={18} color={theme.tint} />
                    </View>
                    <View style={styles.messageCopy}>
                      <Markdown style={markdownStyles as any} rules={markdownRules}>{message.text}</Markdown>
                    </View>
                  </View>
                </View>
              );
            } else {
              return (
                <View
                  key={message.id}
                  style={[styles.messageCard, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}
                >
                  <View style={[styles.messageIcon, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                    <Ionicons name="sparkles" size={18} color={theme.tint} />
                  </View>
                  <View style={styles.messageCopy}>
                    {!isUser && message.thinking ? (
                      <View
                        style={[
                          styles.thinkingPanel,
                          {
                            borderColor: theme.border,
                            backgroundColor: theme.surfaceMuted,
                          },
                        ]}
                      >
                        <Pressable
                          onPress={() => toggleThinking(message.id)}
                          accessibilityRole="button"
                          accessibilityLabel="Toggle model thinking"
                          style={styles.thinkingPanelHeader}
                        >
                          <View style={styles.thinkingPanelHeaderLeft}>
                            <Text style={[styles.thinkingPanelTitle, { color: theme.text }]}>Model thinking</Text>
                            {collapsedSummary ? (
                              <Text style={[styles.thinkingPanelSummary, { color: theme.textMuted }]}>{collapsedSummary}</Text>
                            ) : null}
                          </View>
                          <View style={styles.thinkingPanelHeaderRight}>
                            {liveThinking ? (
                              <Text style={[styles.thinkingAnimationText, { color: theme.tint }]}>
                                Thinking{".".repeat(Math.max(1, thinkingPulse))}
                              </Text>
                            ) : null}
                            <Ionicons
                              name={isThinkingOpen ? "chevron-up" : "chevron-down"}
                              size={14}
                              color={theme.textSubtle}
                            />
                          </View>
                        </Pressable>

                        {isThinkingOpen ? (
                          <View style={styles.thinkingPanelBody}>
                            {message.thinking.model ? (
                              <Text style={[styles.thinkingMetaText, { color: theme.textMuted }]}>Model: {message.thinking.model}</Text>
                            ) : null}
                            {message.thinking.modelSource ? (
                              <Text style={[styles.thinkingMetaText, { color: theme.textMuted }]}>Source: {message.thinking.modelSource}</Text>
                            ) : null}
                            {message.thinking.modelSourceReason ? (
                              <Text style={[styles.thinkingMetaText, { color: theme.textMuted }]}>Source reason: {message.thinking.modelSourceReason}</Text>
                            ) : null}
                            {typeof message.thinking.responseTimeMs === "number" ? (
                              <Text style={[styles.thinkingMetaText, { color: theme.textMuted }]}>Latency: {message.thinking.responseTimeMs} ms</Text>
                            ) : null}
                            {message.thinking.truncated ? (
                              <Text style={[styles.thinkingWarningText, { color: theme.accent }]}>Long response detected. Auto-continuation was applied.</Text>
                            ) : null}
                            {message.thinking.reasoning ? (
                              <Text style={[styles.thinkingReasoningText, { color: theme.textSubtle }]}>{message.thinking.reasoning}</Text>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    ) : null}

                    <Markdown style={markdownStyles as any} rules={markdownRules}>{message.text}</Markdown>
                  </View>
                </View>
              );
            }
          })}

          {busy && !typingMessageId ? (
            <View style={[styles.messageCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, shadowColor: theme.shadow }]}>
              <View style={[styles.messageIcon, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
                <Ionicons name="sparkles" size={18} color={theme.tint} />
              </View>
              <View style={styles.messageCopy}>
                <View style={styles.thinkingRow}>
                  <ActivityIndicator size="small" color={theme.tint} />
                  <Text style={[styles.thinkingText, { color: theme.textMuted }]}>Thinking…</Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <View
        style={[
          styles.composerWrap,
          {
            borderTopColor: theme.border,
            backgroundColor: theme.background,
            paddingBottom: Math.max(insets.bottom, Spacing.sm),
            bottom: keyboardOffset,
          },
        ]}
        onLayout={(event) => {
          setComposerHeight(event.nativeEvent.layout.height);
        }}
      >
        <View
          style={[
            styles.composerCard,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              shadowColor: theme.shadow,
            },
          ]}
        >
          <View style={[styles.composerLeading, { backgroundColor: theme.surfaceMuted, borderColor: theme.border }]}>
            <Ionicons name="sparkles-outline" size={18} color={theme.tint} />
          </View>

          <TextInput
            value={prompt}
            onChangeText={setPrompt}
            placeholder="Ask about a topic, lecture, or assignment"
            placeholderTextColor={theme.textSubtle}
            multiline
            style={[styles.composerInput, { color: theme.text }]}
            textAlignVertical="top"
          />

          <Pressable
            onPress={handleSend}
            disabled={busy || !prompt.trim()}
            accessibilityRole="button"
            accessibilityLabel={busy ? "Sending" : "Send"}
            style={({ pressed }) => [
              styles.sendButton,
              {
                backgroundColor:
                  busy || !prompt.trim()
                    ? mode === "light"
                      ? theme.surface
                      : theme.surfaceGlass
                    : pressed
                      ? theme.ctaPressed
                      : theme.cta,
                borderColor:
                  busy || !prompt.trim()
                    ? mode === "light"
                      ? theme.border
                      : theme.border
                    : mode === "light"
                      ? theme.ctaPressed
                      : theme.cta,
                borderWidth: busy || !prompt.trim() ? 1 : 0,
                opacity: prompt.trim() ? 0 : 1,
                shadowColor: theme.shadow,
              },
            ]}
          >
            <Ionicons
              name={busy ? "time-outline" : "paper-plane"}
              size={25}
              color={busy || !prompt.trim() ? theme.textSubtle : prompt.trim() ? theme.tint : theme.ctaText}
              style={{ transform: [{ rotate: '45deg' }] }}
            />
          </Pressable>
        </View>
      </View>

      {historyOpen ? (
        <View style={styles.historyOverlay}>
          <View
            style={[
              styles.historyPanel,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                paddingTop: insets.top + Spacing.md,
              },
            ]}
          >
            <View style={styles.historyPanelHeader}>
              <View style={styles.historyPanelHeaderLeft}>
                <View style={[styles.historyPanelIcon, { backgroundColor: theme.tint + "20" }]}>
                  <Ionicons name="chatbubbles" size={18} color={theme.tint} />
                </View>
                <Text style={[styles.historyPanelTitle, { color: theme.text }]}>Chat History</Text>
              </View>
              <Pressable
                onPress={() => setHistoryOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close history panel"
                style={({ pressed }) => [
                  styles.historyCloseButton,
                  {
                    borderColor: theme.border,
                    backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
                  },
                ]}
              >
                <Ionicons name="close" size={16} color={theme.textSubtle} />
              </Pressable>
            </View>

            <View style={styles.historySearchContainer}>
              <View style={[styles.historySearchInputContainer, { borderColor: theme.border }]}>
                <Ionicons name="search" size={16} color={theme.textMuted} />
                <TextInput
                  style={[styles.historySearchInput, { color: theme.text }]}
                  placeholder="Search conversations..."
                  placeholderTextColor={theme.textMuted}
                  value={historySearchQuery}
                  onChangeText={setHistorySearchQuery}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                />
                {historySearchQuery.length > 0 && (
                  <Pressable onPress={() => setHistorySearchQuery("")}>
                    <Ionicons name="close-circle" size={16} color={theme.textMuted} />
                  </Pressable>
                )}
              </View>
            </View>

            {historyLoading ? (
              <View style={styles.historyStateBlock}>
                <ActivityIndicator size="small" color={theme.tint} />
                <Text style={[styles.historyStateText, { color: theme.textMuted }]}>Loading conversations…</Text>
              </View>
            ) : historyError ? (
              <View style={styles.historyStateBlock}>
                <Text style={[styles.historyStateText, { color: theme.accent }]}>{historyError}</Text>
              </View>
            ) : Object.keys(groupedHistoryItems).length === 0 ? (
              <View style={styles.historyStateBlock}>
                <View style={[styles.historyEmptyIcon, { backgroundColor: theme.surfaceMuted }]}>
                  <Ionicons name="chatbubbles-outline" size={32} color={theme.textMuted} />
                </View>
                <Text style={[styles.historyStateText, { color: theme.textMuted }]}>
                  {historySearchQuery ? "No conversations found" : "No saved conversations yet"}
                </Text>
                <Text style={[styles.historyStateSubtext, { color: theme.textMuted }]}>
                  {historySearchQuery ? "Try a different search term" : "Start a conversation to see it here"}
                </Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.historyList} showsVerticalScrollIndicator={false}>
                {Object.entries(groupedHistoryItems).map(([groupName, conversations]) => (
                  <View key={groupName} style={styles.historyGroup}>
                    <Text style={[styles.historyGroupTitle, { color: theme.textMuted }]}>
                      {groupName}
                    </Text>
                    {conversations.map((item) => {
                      const isActive = conversationId === item.id;
                      const isLoadingItem = historyLoadingConversationId === item.id;
                      const itemTitle = item.title?.trim() || "Untitled chat";
                      const relativeTime = getRelativeTime(new Date(item.updated_at));

                      return (
                        <Pressable
                          key={item.id}
                          onPress={() => handleHistoryConversationPress(item.id)}
                          disabled={isLoadingItem}
                          accessibilityRole="button"
                          accessibilityLabel={`Open ${itemTitle}`}
                          style={({ pressed }) => [
                            styles.historyListItem,
                            {
                              borderColor: isActive ? theme.tint : theme.border,
                              backgroundColor: isActive
                                ? theme.tint + "15"
                                : pressed
                                  ? theme.surfaceMuted
                                  : theme.surface,
                              opacity: isLoadingItem ? 0.7 : 1,
                            },
                          ]}
                        >
                          <View style={styles.historyListItemContent}>
                            <View style={styles.historyListItemTextWrap}>
                              <Text numberOfLines={2} style={[styles.historyListItemTitle, { color: theme.text }]}>
                                {itemTitle}
                              </Text>
                              <Text numberOfLines={1} style={[styles.historyListItemMeta, { color: theme.textMuted }]}>
                                {relativeTime}
                              </Text>
                            </View>
                            {isLoadingItem ? (
                              <ActivityIndicator size="small" color={theme.tint} />
                            ) : (
                              <View style={[styles.historyListItemArrow, { backgroundColor: theme.surfaceMuted }]}>
                                <Ionicons name="chevron-forward" size={12} color={theme.textSubtle} />
                              </View>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
          <Pressable
            onPress={() => setHistoryOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Close conversation history"
            style={[
              styles.historyBackdrop,
              { backgroundColor: mode === "dark" ? "rgba(0,0,0,0.48)" : "rgba(15,23,42,0.22)" },
            ]}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 0,
    paddingTop: 0,
    paddingBottom: 0,
    gap: 0,
  },
  promptRow: {
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  promptToolbar: {
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  promptToolbarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  promptToolbarTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  quickPromptsLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  historyButton: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  newChatButton: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  newChatButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  promptChip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    maxWidth: 280,
  },
  promptChipText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  attachmentCard: {
    marginHorizontal: Spacing.sm,
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  attachmentCardLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  attachmentIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  attachmentCopy: {
    flex: 1,
    gap: 2,
  },
  attachmentTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  attachmentMeta: {
    fontSize: FontSize.xs,
  },
  attachmentRemoveButton: {
    width: 28,
    height: 28,
    borderRadius: Radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  chatThread: {
    gap: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },

  emptyState: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    flexDirection: "row",
    gap: Spacing.md,
    ...Shadows.card,
  },
  emptyIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCopy: {
    flex: 1,
    gap: 2,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  emptyText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },

  messageCard: {
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing.md,
    flexDirection: "row",
    gap: Spacing.md,
    ...Shadows.card,
  },
  messageIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  messageCopy: {
    flex: 1,
    gap: 2,
  },

  diagramCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: 6,
  },
  diagramLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  diagramSource: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },

  codeBlock: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  codeBlockText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" }),
  },

  quoteCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
  },

  thinkingPanel: {
    borderWidth: 1,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  thinkingPanelHeader: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  thinkingPanelHeaderLeft: {
    flex: 1,
    gap: 2,
  },
  thinkingPanelHeaderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  thinkingPanelTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  thinkingPanelSummary: {
    fontSize: FontSize.xs,
    lineHeight: 16,
  },
  thinkingAnimationText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  thinkingPanelBody: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm,
    gap: 4,
  },
  thinkingMetaText: {
    fontSize: FontSize.xs,
  },
  thinkingWarningText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  thinkingReasoningText: {
    fontSize: FontSize.xs,
    lineHeight: 18,
  },

  userMessageRow: {
    alignItems: "flex-end",
  },

  thinkingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  thinkingText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  composerWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingTop: Spacing.sm,
  },
  composerCard: {
    borderWidth: 1,
    borderRadius: Radius.xxl,
    padding: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    ...Shadows.card,
  },
  composerLeading: {
    width: 36,
    height: 36,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  composerInput: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    paddingVertical: 8,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  sendButton: {
    borderRadius: Radius.pill,
    width: 48,
    height: 48,
    paddingHorizontal: 0,
    flexDirection: "row",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.card,
  },
  historyOverlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    zIndex: 12,
  },
  historyBackdrop: {
    flex: 1,
  },
  historyPanel: {
    width: "82%",
    maxWidth: 360,
    borderLeftWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  historyPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: Spacing.sm,
  },
  historyPanelHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  historyPanelIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  historyPanelTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  historyCloseButton: {
    width: 32,
    height: 32,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  historySearchContainer: {
    paddingBottom: Spacing.sm,
  },
  historySearchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.lg,
    backgroundColor: "transparent",
  },
  historySearchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    paddingVertical: 0,
  },
  historyStateBlock: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
    gap: Spacing.sm,
  },
  historyEmptyIcon: {
    width: 64,
    height: 64,
    borderRadius: Radius.xl,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  historyStateText: {
    fontSize: FontSize.sm,
    textAlign: "center",
    fontWeight: FontWeight.medium,
  },
  historyStateSubtext: {
    fontSize: FontSize.xs,
    textAlign: "center",
    opacity: 0.8,
  },
  historyList: {
    gap: Spacing.sm,
    paddingBottom: Spacing.lg,
  },
  historyGroup: {
    gap: Spacing.xs,
  },
  historyGroupTitle: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.xs,
    paddingVertical: Spacing.xxl,
  },
  historyListItem: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    marginHorizontal: Spacing.xxl,
    overflow: "hidden",
  },
  historyListItemContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    gap: Spacing.sm,
  },
  historyListItemTextWrap: {
    flex: 1,
    gap: 2,
  },
  historyListItemTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    lineHeight: 18,
  },
  historyListItemMeta: {
    fontSize: FontSize.xs,
  },
  historyListItemArrow: {
    width: 24,
    height: 24,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});