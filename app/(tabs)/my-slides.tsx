import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SmartSummaryCard } from "@/components/ui/smart-summary";
import {
  Colors,
  FontSize,
  FontWeight,
  Radius,
  Shadows,
  Spacing,
} from "@/constants/theme";
import { summarizeTextWithGroq } from "@/lib/groq";
import {
  addLocalSlide,
  createSlideFolder,
  deleteSlide,
  downloadSlideForOffline,
  fetchSlideFolders,
  fetchSlides,
  getSlideExtractText,
  getSlideLocalUri,
  openSlideInDeviceViewer,
} from "@/lib/slides";
import type { SlideFile } from "@/types/models";

type SlideFolder = {
  key: string;
  label: string;
  slides: SlideFile[];
};

const SUPPORTED_PICKER_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
];

function inferCourseCodeFromName(name: string) {
  const baseName = name.replace(/\.(pdf|doc|docx|ppt|pptx)$/i, "");
  const match = baseName.match(/([A-Za-z]{2,6}\s?\d{2,4}[A-Za-z]?)/);
  if (!match?.[1]) return null;
  return match[1].replace(/\s+/g, "").toUpperCase();
}

function getSlideGroupLabel(slide: SlideFile) {
  if (slide.folderName?.trim()) {
    return slide.folderName.trim();
  }

  if (slide.courseCode?.trim()) {
    return slide.courseCode.trim().toUpperCase();
  }

  return inferCourseCodeFromName(slide.name) ?? "GENERAL";
}

export default function SlidesScreen() {
  const mode = useColorScheme() === "dark" ? "dark" : "light";
  const theme = Colors[mode];
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [selectedFolderName, setSelectedFolderName] = useState("GENERAL");
  const [newFolderName, setNewFolderName] = useState("");
  const [folderMenuOpen, setFolderMenuOpen] = useState(false);
  const [createFolderModalVisible, setCreateFolderModalVisible] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  const { data: slides = [], isLoading } = useQuery({
    queryKey: ["slides"],
    queryFn: fetchSlides,
  });

  const { data: savedFolders = [] } = useQuery({
    queryKey: ["slide-folders"],
    queryFn: fetchSlideFolders,
  });

  const summaryMutation = useMutation({
    mutationFn: async (slide: SlideFile) => {
      if (slide.source === "local") {
        throw new Error("AI summary currently supports cloud slides only.");
      }

      const extractedText = await getSlideExtractText(slide.path);
      if (!extractedText.trim()) {
        throw new Error("No extractable text found for this slide.");
      }

      return summarizeTextWithGroq(extractedText);
    },
  });

  const selectedSummary = useMemo(() => summaryMutation.data ?? null, [summaryMutation.data]);

  const offlineCount = useMemo(
    () => slides.filter((slide) => Boolean(slide.localPath)).length,
    [slides],
  );

  const localImportCount = useMemo(
    () => slides.filter((slide) => slide.source === "local").length,
    [slides],
  );

  const cloudCount = slides.length - localImportCount;

  const groupedSlides = useMemo<SlideFolder[]>(() => {
    const map = new Map<string, SlideFile[]>();

    for (const slide of slides) {
      const label = getSlideGroupLabel(slide);
      const key = label.toLowerCase();
      const existing = map.get(key) ?? [];
      existing.push(slide);
      map.set(key, existing);
    }

    return [...map.entries()]
      .map(([key, groupSlides]) => ({
        key,
        label: getSlideGroupLabel(groupSlides[0]),
        slides: groupSlides.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [slides]);

  const selectableFolders = useMemo(() => {
    const set = new Set<string>(["GENERAL"]);

    for (const folder of savedFolders) {
      if (folder.trim()) set.add(folder.trim());
    }

    for (const grouped of groupedSlides) {
      if (grouped.label.trim()) set.add(grouped.label.trim());
    }

    return [...set].sort((a, b) => {
      if (a === "GENERAL") return -1;
      if (b === "GENERAL") return 1;
      return a.localeCompare(b);
    });
  }, [groupedSlides, savedFolders]);

  const visibleFolders = useMemo(() => {
    if (selectedFolderName === "GENERAL") {
      return groupedSlides;
    }

    return groupedSlides.filter(
      (folder) => folder.label.toLowerCase() === selectedFolderName.toLowerCase(),
    );
  }, [groupedSlides, selectedFolderName]);

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) {
      Alert.alert("Folder", "Enter a folder name first.");
      return false;
    }

    try {
      await createSlideFolder(name);
      await queryClient.invalidateQueries({ queryKey: ["slide-folders"] });
      setSelectedFolderName(name);
      setNewFolderName("");
      setFolderMenuOpen(false);
      Alert.alert("Folder created", `${name} is ready.`);
      return true;
    } catch (error) {
      Alert.alert("Folder", error instanceof Error ? error.message : "Unable to create folder.");
      return false;
    }
  };

  const pickAndAddLocalSlides = async () => {
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: SUPPORTED_PICKER_TYPES,
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (picked.canceled) {
        return;
      }

      const selectedFolder = selectedFolderName === "GENERAL" ? undefined : selectedFolderName;

      await Promise.all(
        picked.assets.map((asset) => {
          const fallbackCode = inferCourseCodeFromName(asset.name ?? "");

          return addLocalSlide({
            name: asset.name ?? "Untitled Slide",
            uri: asset.uri,
            folderName: selectedFolder,
            courseCode: fallbackCode ?? undefined,
          });
        }),
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["slides"] }),
        queryClient.invalidateQueries({ queryKey: ["slide-folders"] }),
      ]);
      Alert.alert("Slides added", `${picked.assets.length} slide file(s) added.`);
    } catch (error) {
      Alert.alert(
        "Add failed",
        error instanceof Error ? error.message : "Unable to add local slide files.",
      );
    }
  };

  const handleDeleteSlide = (slide: SlideFile) => {
    Alert.alert("Delete slide", `Delete ${slide.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const result = await deleteSlide(slide);
            await queryClient.invalidateQueries({ queryKey: ["slides"] });

            if (result.kind === "offline-removed") {
              Alert.alert("Removed", "Offline copy removed. Published slide remains available online.");
            }
          } catch (error) {
            Alert.alert(
              "Delete failed",
              error instanceof Error ? error.message : "Unable to delete this slide.",
            );
          }
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
    >
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        bounces={false}
        alwaysBounceVertical={false}
        overScrollMode="never"
      >
        <View
          style={[
            styles.hero,
            {
              backgroundColor: theme.heroBackground,
              paddingTop: insets.top + Spacing.md,
            },
          ]}
        >
          <View style={[styles.heroOrbOne, { backgroundColor: theme.heroOrbOne }]} />
          <View style={[styles.heroOrbTwo, { backgroundColor: theme.heroOrbTwo }]} />

          <Text style={[styles.heroEyebrow, { color: theme.textOnHero }]}>UPSA Connect</Text>
          <Text style={[styles.heroTitle, { color: theme.textOnHero }]}>My Slides</Text>
          <Text style={[styles.heroSubtitle, { color: theme.textMuted }]}> 
            {slides.length
              ? `${slides.length} files • ${offlineCount} offline • ${cloudCount} cloud`
              : "No slides available yet."}
          </Text>

          <View style={styles.heroRow}>
            <View style={[styles.heroPill, { borderColor: theme.borderStrong }]}>
              <Ionicons name="folder-outline" size={14} color={theme.accent} />
              <Text style={[styles.heroPillText, { color: theme.textOnHero }]}> 
                {groupedSlides.length} folder{groupedSlides.length === 1 ? "" : "s"}
              </Text>
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.heroIconButton,
                {
                  borderColor: theme.borderStrong,
                  backgroundColor: pressed ? "rgba(255, 255, 255, 0.20)" : "rgba(255, 255, 255, 0.10)",
                },
              ]}
              onPress={() => {
                setFolderMenuOpen(false);
                setCreateFolderModalVisible(true);
              }}
            >
              <Ionicons name="folder-open-outline" size={16} color={theme.textOnHero} />
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.heroIconButton,
                {
                  borderColor: theme.borderStrong,
                  backgroundColor: pressed ? "rgba(255, 255, 255, 0.20)" : "rgba(255, 255, 255, 0.10)",
                },
              ]}
              onPress={pickAndAddLocalSlides}
            >
              <Ionicons name="add-outline" size={18} color={theme.textOnHero} />
            </Pressable>
          </View>

          <View style={styles.menuWrap}>
            <Pressable
              style={[styles.menuTrigger, { borderColor: theme.borderStrong }]}
              onPress={() => setFolderMenuOpen((value) => !value)}
            >
              <Text style={[styles.menuTriggerText, { color: theme.textOnHero }]}>
                Folder: {selectedFolderName}
              </Text>
              <Ionicons
                name={folderMenuOpen ? "chevron-up" : "chevron-down"}
                size={16}
                color={theme.textOnHero}
              />
            </Pressable>

            {folderMenuOpen ? (
              <View style={[styles.menuDropdown, { borderColor: theme.borderStrong }]}>
                {selectableFolders.map((folder) => {
                  const active = folder === selectedFolderName;
                  return (
                    <Pressable
                      key={folder}
                      style={[
                        styles.menuItem,
                        { backgroundColor: active ? "rgba(255,255,255,0.16)" : "transparent" },
                      ]}
                      onPress={() => {
                        setSelectedFolderName(folder);
                        setFolderMenuOpen(false);
                      }}
                    >
                      <Text style={[styles.menuItemText, { color: theme.textOnHero }]}>{folder}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </View>
        </View>

        <Modal
          transparent
          visible={createFolderModalVisible}
          animationType="fade"
          onRequestClose={() => setCreateFolderModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View
              style={[
                styles.modalCard,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.surface,
                },
              ]}
            >
              <Text style={[styles.modalTitle, { color: theme.text }]}>Create Folder</Text>
              <Text style={[styles.modalBody, { color: theme.textMuted }]}>Name your folder to organize slides.</Text>

              <TextInput
                value={newFolderName}
                onChangeText={setNewFolderName}
                placeholder="Folder name"
                placeholderTextColor={theme.textSubtle}
                autoFocus
                style={[
                  styles.modalInput,
                  {
                    borderColor: theme.border,
                    backgroundColor: theme.surfaceMuted,
                    color: theme.text,
                  },
                ]}
              />

              <View style={styles.modalActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.modalButtonSecondary,
                    {
                      borderColor: theme.border,
                      backgroundColor: pressed ? theme.surfaceMuted : "transparent",
                    },
                  ]}
                  onPress={() => {
                    setCreateFolderModalVisible(false);
                    setNewFolderName("");
                  }}
                >
                  <Text style={[styles.modalButtonSecondaryText, { color: theme.text }]}>Cancel</Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.modalButtonPrimary,
                    { backgroundColor: pressed ? theme.tintPressed : theme.tint },
                  ]}
                  onPress={async () => {
                    const created = await handleCreateFolder();
                    if (created) {
                      setCreateFolderModalVisible(false);
                    }
                  }}
                >
                  <Text style={[styles.modalButtonPrimaryText, { color: theme.accent }]}>Create</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>

        {isLoading ? <ActivityIndicator style={styles.loader} size="large" color={theme.tint} /> : null}

        {!isLoading && groupedSlides.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              {
                borderColor: theme.border,
                backgroundColor: theme.surface,
                shadowColor: theme.shadow,
                ...Shadows.card,
              },
            ]}
          >
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No slides yet</Text>
            <Text style={[styles.emptyBody, { color: theme.textSubtle }]}>Import local files or wait for published course slides.</Text>
          </View>
        ) : null}

        {visibleFolders.map((folder) => {
          const isOpen = expandedFolders[folder.key] ?? true;

          return (
            <View
              key={folder.key}
              style={[
                styles.folderCard,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.surface,
                  shadowColor: theme.shadow,
                  ...Shadows.card,
                },
              ]}
            >
              <Pressable
                onPress={() => {
                  setExpandedFolders((previous) => ({ ...previous, [folder.key]: !isOpen }));
                }}
                style={styles.folderHeader}
              >
                <View style={styles.folderTitleRow}>
                  <Ionicons name="folder-open-outline" size={20} color={theme.tint} />
                  <Text style={[styles.folderTitle, { color: theme.text }]}>{folder.label}</Text>
                  <Text style={[styles.folderCount, { color: theme.textSubtle }]}>
                    {folder.slides.length} file{folder.slides.length === 1 ? "" : "s"}
                  </Text>
                </View>

                <Ionicons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={theme.textSubtle} />
              </Pressable>

              {isOpen ? (
                <View style={styles.folderContent}>
                  {folder.slides.map((slide) => (
                    <View
                      key={slide.id}
                      style={[
                        styles.slideCard,
                        {
                          borderColor: theme.border,
                          backgroundColor: theme.surfaceMuted,
                        },
                      ]}
                    >
                      <View style={styles.slideHeader}>
                        <View style={styles.slideTextWrap}>
                          <Text style={[styles.slideTitle, { color: theme.text }]} numberOfLines={1}>{slide.name}</Text>
                          <Text style={[styles.slideStatus, { color: theme.textSubtle }]}>
                            {slide.localPath ? "Available offline" : slide.source === "local" ? "Local import" : "Online only"}
                          </Text>
                        </View>

                        <View style={styles.iconActionRow}>
                          <Pressable
                            style={({ pressed }) => [
                              styles.iconButton,
                              {
                                borderColor: theme.tint,
                                backgroundColor: pressed ? theme.surface : "transparent",
                              },
                            ]}
                            onPress={async () => {
                              try {
                                const slideUri = await getSlideLocalUri(slide);
                                router.push({
                                  pathname: "/(tabs)/ai-tutor",
                                  params: {
                                    handoffId: String(Date.now()),
                                    slidePath: slide.path,
                                    slideName: slide.name,
                                    slideSource: slide.source,
                                    slideUri,
                                  },
                                });
                              } catch (error) {
                                Alert.alert(
                                  "AI handoff failed",
                                  error instanceof Error
                                    ? error.message
                                    : "Unable to prepare this file for AI.",
                                );
                              }
                            }}
                          >
                            <Ionicons name="sparkles-outline" size={16} color={theme.tint} />
                          </Pressable>

                          <Pressable
                            style={({ pressed }) => [
                              styles.iconButton,
                              {
                                borderColor: theme.danger,
                                backgroundColor: pressed ? theme.surface : "transparent",
                              },
                            ]}
                            onPress={() => handleDeleteSlide(slide)}
                          >
                            <Ionicons name="trash-outline" size={16} color={theme.danger} />
                          </Pressable>
                        </View>
                      </View>

                      <View style={styles.actionsRow}>
                        <Pressable
                          style={({ pressed }) => [styles.primaryButton, { backgroundColor: pressed ? theme.tintPressed : theme.tint }]}
                          onPress={async () => {
                            try {
                              await openSlideInDeviceViewer(slide);
                            } catch (error) {
                              Alert.alert("Open failed", error instanceof Error ? error.message : "Unable to open file.");
                            }
                          }}
                        >
                          <Text style={[styles.primaryButtonText, { color: theme.accent }]}>Open in Viewer</Text>
                        </Pressable>

                        <Pressable
                          style={({ pressed }) => [
                            styles.secondaryButton,
                            {
                              borderColor: theme.tint,
                              backgroundColor: pressed ? theme.surface : "transparent",
                              opacity: summaryMutation.isPending ? 0.65 : 1,
                            },
                          ]}
                          disabled={summaryMutation.isPending}
                          onPress={async () => {
                            try {
                              await summaryMutation.mutateAsync(slide);
                            } catch (error) {
                              Alert.alert("Summary error", error instanceof Error ? error.message : "Failed to summarize.");
                            }
                          }}
                        >
                          <Text style={[styles.secondaryButtonText, { color: theme.tint }]}>Summarize</Text>
                        </Pressable>

                        {slide.source !== "local" ? (
                          <Pressable
                            style={({ pressed }) => [
                              styles.secondaryButton,
                              {
                                borderColor: theme.tint,
                                backgroundColor: pressed ? theme.surface : "transparent",
                              },
                            ]}
                            onPress={async () => {
                              try {
                                await downloadSlideForOffline(slide);
                                await queryClient.invalidateQueries({ queryKey: ["slides"] });
                                Alert.alert("Offline ready", `${slide.name} is available offline.`);
                              } catch (error) {
                                Alert.alert("Download failed", error instanceof Error ? error.message : "Unable to download slide.");
                              }
                            }}
                          >
                            <Text style={[styles.secondaryButtonText, { color: theme.tint }]}>Save Offline</Text>
                          </Pressable>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}

        {selectedSummary ? <SmartSummaryCard summary={selectedSummary} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 80,
    gap: Spacing.md,
  },
  hero: {
    marginHorizontal: -Spacing.lg,
    borderBottomLeftRadius: Radius.xxl,
    borderBottomRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    overflow: "hidden",
  },
  heroOrbOne: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 99,
    right: -52,
    top: -40,
    opacity: 0.32,
  },
  heroOrbTwo: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 99,
    left: -58,
    bottom: -58,
    opacity: 0.22,
  },
  heroEyebrow: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 1.8,
    textTransform: "uppercase",
  },
  heroTitle: {
    marginTop: Spacing.sm,
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
  },
  heroSubtitle: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  heroRow: {
    marginTop: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  heroPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    overflow: "hidden",
    backgroundColor: "rgba(255, 255, 255, 0.10)",
  },
  heroIconButton: {
    width: 38,
    height: 38,
    borderWidth: 1,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  menuWrap: {
    marginTop: Spacing.sm,
  },
  menuTrigger: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  menuTriggerText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  menuDropdown: {
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    backgroundColor: "rgba(10, 30, 52, 0.95)",
    overflow: "hidden",
  },
  menuItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  menuItemText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  heroPillText: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  loader: {
    marginTop: Spacing.xxxl,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(3, 10, 18, 0.56)",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  modalBody: {
    fontSize: FontSize.sm,
  },
  modalInput: {
    marginTop: Spacing.xs,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
  },
  modalActions: {
    marginTop: Spacing.sm,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: Spacing.sm,
  },
  modalButtonSecondary: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  modalButtonSecondaryText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  modalButtonPrimary: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  modalButtonPrimaryText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  emptyBody: {
    marginTop: Spacing.xs,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  folderCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  folderHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.sm,
  },
  folderTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flex: 1,
  },
  folderTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  folderCount: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  folderContent: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  slideCard: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  slideHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  slideTextWrap: {
    flex: 1,
  },
  slideTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  slideStatus: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xs,
  },
  iconActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderWidth: 1,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
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
});