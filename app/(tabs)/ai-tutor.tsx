import { useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";

import { useMutation } from "@tanstack/react-query";

import { QuizEngine } from "@/components/ui/quiz-engine";
import { SmartSummaryCard } from "@/components/ui/smart-summary";
import { Colors, FontSize, FontWeight, Radius, Spacing } from "@/constants/theme";
import { generateQuizWithGroq, summarizeTextWithGroq } from "@/lib/groq";

export default function AITutorScreen() {
  const mode = useColorScheme() === "dark" ? "dark" : "light";
  const theme = Colors[mode];
  const [prompt, setPrompt] = useState(
    "Explain Porters Five Forces with UPSA-level examples.",
  );

  const summaryMutation = useMutation({
    mutationFn: summarizeTextWithGroq,
  });

  const quizMutation = useMutation({
    mutationFn: generateQuizWithGroq,
  });

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: theme.tint }]}> 
        AI Tutor
      </Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}> 
        All AI requests are routed through Supabase Edge Functions for security.
      </Text>

      <View
        style={[
          styles.card,
          { borderColor: theme.border, backgroundColor: theme.surface },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.text }]}> 
          Study Topic or Slide Text
        </Text>
        <TextInput
          multiline
          numberOfLines={6}
          style={[
            styles.input,
            {
              borderColor: theme.borderStrong,
              backgroundColor: theme.surfaceMuted,
              color: theme.text,
            },
          ]}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="Paste notes, chapter text, or ask a question"
          placeholderTextColor={theme.textSubtle}
        />

        <View style={styles.actionsRow}>
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: pressed ? theme.tintPressed : theme.tint },
            ]}
            onPress={async () => {
              try {
                await summaryMutation.mutateAsync(prompt);
              } catch (error) {
                Alert.alert(
                  "AI Tutor",
                  error instanceof Error
                    ? error.message
                    : "Unable to summarize this topic.",
                );
              }
            }}
          >
            <Text style={[styles.primaryButtonText, { color: theme.accent }]}>
              Generate Smart Summary
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: theme.tint,
                backgroundColor: pressed ? theme.surfaceMuted : "transparent",
              },
            ]}
            onPress={async () => {
              try {
                await quizMutation.mutateAsync(prompt);
              } catch (error) {
                Alert.alert(
                  "Quiz Error",
                  error instanceof Error
                    ? error.message
                    : "Unable to generate quiz.",
                );
              }
            }}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.tint }]}> 
              Create Quiz
            </Text>
          </Pressable>
        </View>
      </View>

      {summaryMutation.data ? (
        <SmartSummaryCard summary={summaryMutation.data} />
      ) : null}
      <QuizEngine questions={quizMutation.data ?? []} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  input: {
    marginTop: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.sm,
    textAlignVertical: "top",
  },
  actionsRow: {
    marginTop: Spacing.md,
    flexDirection: "row",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  primaryButton: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  primaryButtonText: {
    fontWeight: FontWeight.semibold,
  },
  secondaryButton: {
    borderRadius: Radius.pill,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  secondaryButtonText: {
    fontWeight: FontWeight.semibold,
  },
});
