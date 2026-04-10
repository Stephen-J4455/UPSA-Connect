import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { SmartSummaryCard } from "@/components/ui/smart-summary";
import { Colors, FontSize, FontWeight, Radius, Shadows, Spacing } from "@/constants/theme";
import { summarizeTextWithGroq } from "@/lib/groq";
import {
  downloadSlideForOffline,
  fetchSlides,
  getSlideExtractText,
  openSlide,
} from "@/lib/slides";
import type { SlideFile } from "@/types/models";

export default function SlidesScreen() {
  const mode = useColorScheme() === "dark" ? "dark" : "light";
  const theme = Colors[mode];
  const queryClient = useQueryClient();
  const [selectedSlide, setSelectedSlide] = useState<SlideFile | null>(null);

  const { data: slides = [], isLoading } = useQuery({
    queryKey: ["slides"],
    queryFn: fetchSlides,
  });

  const summaryMutation = useMutation({
    mutationFn: async (slide: SlideFile) => {
      const extractedText = await getSlideExtractText(slide.path);
      if (!extractedText.trim()) {
        throw new Error("No extractable text found for this slide.");
      }
      return summarizeTextWithGroq(extractedText);
    },
  });

  const selectedSummary = useMemo(
    () => summaryMutation.data ?? null,
    [summaryMutation.data],
  );

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}> 
      <ScrollView
        contentContainerStyle={styles.content}
      >
        <Text style={[styles.title, { color: theme.tint }]}> 
          My Slides
        </Text>

        {isLoading ? (
          <ActivityIndicator style={styles.loader} size="large" color={theme.tint} />
        ) : null}

        {slides.map((slide) => (
          <View
            key={slide.id}
            style={[
              styles.slideCard,
              { borderColor: theme.border, backgroundColor: theme.surface },
            ]}
          >
            <Text style={[styles.slideTitle, { color: theme.text }]}> 
              {slide.name}
            </Text>
            <Text style={[styles.slideStatus, { color: theme.textSubtle }]}> 
              {slide.localPath ? "Available offline" : "Online only"}
            </Text>

            <View style={styles.actionsRow}>
              <Pressable
                style={({ pressed }) => [
                  styles.primaryButton,
                  { backgroundColor: pressed ? theme.tintPressed : theme.tint },
                ]}
                onPress={async () => {
                  await openSlide(slide.path);
                  setSelectedSlide(slide);
                }}
              >
                <Text style={[styles.primaryButtonText, { color: theme.accent }]}>Open</Text>
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
                    await downloadSlideForOffline(slide);
                    await queryClient.invalidateQueries({
                      queryKey: ["slides"],
                    });
                    Alert.alert(
                      "Offline ready",
                      `${slide.name} is available offline.`,
                    );
                  } catch (error) {
                    Alert.alert(
                      "Download failed",
                      error instanceof Error
                        ? error.message
                        : "Unable to download slide.",
                    );
                  }
                }}
              >
                <Text style={[styles.secondaryButtonText, { color: theme.tint }]}> 
                  Download for Offline Use
                </Text>
              </Pressable>
            </View>
          </View>
        ))}

        {selectedSummary ? (
          <SmartSummaryCard summary={selectedSummary} />
        ) : null}
      </ScrollView>

      <Pressable
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: theme.accent,
            shadowColor: theme.shadow,
            opacity: pressed ? 0.9 : 1,
          },
        ]}
        onPress={async () => {
          if (!selectedSlide) {
            Alert.alert(
              "Select a slide",
              "Open any slide first, then summarize it.",
            );
            return;
          }

          try {
            await summaryMutation.mutateAsync(selectedSlide);
          } catch (error) {
            Alert.alert(
              "Summary error",
              error instanceof Error ? error.message : "Failed to summarize.",
            );
          }
        }}
      >
        <Text style={[styles.fabText, { color: theme.accentText }]}> 
          {summaryMutation.isPending ? "Summarizing..." : "Summarize with AI"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: 120,
    gap: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
  },
  loader: {
    marginTop: Spacing.xxxl,
  },
  slideCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  slideTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  slideStatus: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xs,
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
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  secondaryButtonText: {
    fontWeight: FontWeight.semibold,
  },
  fab: {
    position: "absolute",
    right: Spacing.xxl,
    bottom: Spacing.xxl,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    ...Shadows.card,
  },
  fabText: {
    fontWeight: FontWeight.bold,
  },
});
