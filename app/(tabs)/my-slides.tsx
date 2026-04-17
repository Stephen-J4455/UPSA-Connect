import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as DocumentPicker from "expo-document-picker";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
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

import {
  Colors,
  FontSize,
  FontWeight,
  Radius,
  Shadows,
  Spacing,
} from "@/constants/theme";
import {
  addLocalSlide,
  createSlideFolder,
  deleteSlide,
  downloadSlideForOffline,
  fetchSlideFolders,
  fetchSlides,
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
  const [activeSlideMenu, setActiveSlideMenu] = useState<SlideFile | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

  const { data: slides = [], isLoading } = useQuery({
    queryKey: ["slides"],
    queryFn: fetchSlides,
  });

  const { data: savedFolders = [] } = useQuery({
    queryKey: ["slide-folders"],
    queryFn: fetchSlideFolders,
  });

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

  const openSlideInAITutor = async (slide: SlideFile, handoffPrompt: string) => {
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
          handoffPrompt,
        },
      });
    } catch (error) {
      Alert.alert(
        "AI handoff failed",
        error instanceof Error ? error.message : "Unable to prepare this file for AI.",
      );
    }
  };

  const handleSyncSlide = async (slide: SlideFile) => {
    try {
      await downloadSlideForOffline(slide);
      await queryClient.invalidateQueries({ queryKey: ["slides"] });

      if (slide.source === "local") {
        Alert.alert("Synced", `${slide.name} is stored locally and ready.`);
        return;
      }

      Alert.alert("Synced", `${slide.name} is now available offline.`);
    } catch (error) {
      Alert.alert("Sync failed", error instanceof Error ? error.message : "Unable to sync this file.");
    }
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

        <Modal
          transparent
          visible={Boolean(activeSlideMenu && menuPosition)}
          animationType="none"
          onRequestClose={() => {
            setActiveSlideMenu(null);
            setMenuPosition(null);
          }}
        >
          <View style={styles.actionSheetBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => {
              setActiveSlideMenu(null);
              setMenuPosition(null);
            }} />

            {menuPosition ? (
              (() => {
                const { width: windowWidth, height: windowHeight } = Dimensions.get("window");
                const popoverWidth = 340;
                let left = menuPosition.x - popoverWidth / 2;
                if (left + popoverWidth > windowWidth - 16) left = windowWidth - popoverWidth - 16;
                if (left < 16) left = 16;
                const top = menuPosition.y > windowHeight / 2 ? menuPosition.y - 240 : menuPosition.y + 12;

                return (
                  <View style={[styles.popoverContainer, { left, top }]}>
                    <View
                      style={[
                        styles.popoverCard,
                        {
                          borderColor: theme.border,
                          backgroundColor: theme.surface,
                          shadowColor: theme.shadow,
                          ...Shadows.card,
                        },
                      ]}
                    >
                      <View style={[styles.popoverHeader, { borderBottomColor: theme.border }]}>
                        <Text style={[styles.popoverTitle, { color: theme.text }]} numberOfLines={1}>
                          {activeSlideMenu?.name ?? "Actions"}
                        </Text>
                        <Pressable
                          onPress={() => {
                            setActiveSlideMenu(null);
                            setMenuPosition(null);
                          }}
                          style={({ pressed }) => [
                            styles.popoverCloseBtn,
                            {
                              backgroundColor: pressed ? theme.surfaceMuted : "transparent",
                              borderColor: theme.border,
                            },
                          ]}
                        >
                          <Ionicons name="close" size={16} color={theme.textSubtle} />
                        </Pressable>
                      </View>

                      <View style={styles.popoverGrid}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.popoverGridItem,
                            { backgroundColor: pressed ? theme.surfaceMuted : theme.surfaceElevated },
                          ]}
                          onPress={() => {
                            const target = activeSlideMenu;
                            setActiveSlideMenu(null);
                            setMenuPosition(null);
                            if (!target) return;
                            void openSlideInAITutor(
                              target,
                              `Summarize this file for UPSA revision. Give a concise overview, key concepts, and exam-focused study points.`,
                            );
                          }}
                        >
                          <View style={[styles.popoverIconBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                            <Ionicons name="sparkles-outline" size={24} color={theme.tint} />
                          </View>
                          <Text style={[styles.popoverGridLabel, { color: theme.text }]}>Summarize</Text>
                        </Pressable>

                        <Pressable
                          style={({ pressed }) => [
                            styles.popoverGridItem,
                            { backgroundColor: pressed ? theme.surfaceMuted : theme.surfaceElevated },
                          ]}
                          onPress={() => {
                            const target = activeSlideMenu;
                            setActiveSlideMenu(null);
                            setMenuPosition(null);
                            if (!target) return;
                            void handleSyncSlide(target);
                          }}
                        >
                          <View style={[styles.popoverIconBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                            <Ionicons name="sync-outline" size={24} color={theme.tint} />
                          </View>
                          <Text style={[styles.popoverGridLabel, { color: theme.text }]}>Sync</Text>
                        </Pressable>

                        <Pressable
                          style={({ pressed }) => [
                            styles.popoverGridItem,
                            { backgroundColor: pressed ? theme.surfaceMuted : theme.surfaceElevated },
                          ]}
                          onPress={() => {
                            const target = activeSlideMenu;
                            setActiveSlideMenu(null);
                            setMenuPosition(null);
                            if (!target) return;
                            void openSlideInAITutor(
                              target,
                              `Use this file to solve likely exam questions step by step. Show methods, reasoning, and final answers in a clear study format.`,
                            );
                          }}
                        >
                          <View style={[styles.popoverIconBox, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                            <Ionicons name="bulb-outline" size={24} color={theme.tint} />
                          </View>
                          <Text style={[styles.popoverGridLabel, { color: theme.text }]}>Solve</Text>
                        </Pressable>

                        <Pressable
                          style={({ pressed }) => [
                            styles.popoverGridItem,
                            { backgroundColor: pressed ? "rgba(239, 68, 68, 0.12)" : theme.surfaceElevated },
                          ]}
                          onPress={() => {
                            const target = activeSlideMenu;
                            setActiveSlideMenu(null);
                            setMenuPosition(null);
                            if (!target) return;
                            handleDeleteSlide(target);
                          }}
                        >
                          <View style={[styles.popoverIconBox, { backgroundColor: "transparent", borderColor: theme.danger }]}>
                            <Ionicons name="trash-outline" size={24} color={theme.danger} />
                          </View>
                          <Text style={[styles.popoverGridLabel, { color: theme.danger }]}>Delete</Text>
                        </Pressable>
                      </View>
                    </View>
                  </View>
                );
              })()
            ) : null}
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
                          backgroundColor: theme.surfaceElevated,
                          shadowColor: theme.shadow,
                          ...Shadows.card,
                        },
                      ]}
                    >
                      <View style={styles.slideHeaderRow}>
                        <View
                          style={[
                            styles.slideFileTypeIcon,
                            {
                              borderColor: theme.border,
                              backgroundColor: theme.surface,
                            },
                          ]}
                        >
                          <Ionicons
                            name={slide.name.toLowerCase().endsWith(".pdf") ? "document-text-outline" : "document-outline"}
                            size={18}
                            color={theme.tint}
                          />
                        </View>

                        <View style={styles.slideTextWrap}>
                          <Text style={[styles.slideTitle, { color: theme.text }]} numberOfLines={2}>
                            {slide.name}
                          </Text>

                          <View style={styles.slideMetaRow}>
                            <View
                              style={[
                                styles.slideBadge,
                                {
                                  borderColor: theme.border,
                                  backgroundColor: theme.surface,
                                },
                              ]}
                            >
                              <Ionicons
                                name={slide.localPath ? "cloud-done-outline" : slide.source === "local" ? "phone-portrait-outline" : "cloud-outline"}
                                size={12}
                                color={theme.tint}
                              />
                              <Text style={[styles.slideBadgeText, { color: theme.textSubtle }]}>
                                {slide.localPath
                                  ? "Offline ready"
                                  : slide.source === "local"
                                    ? "Local import"
                                    : "Cloud only"}
                              </Text>
                            </View>

                            {slide.courseCode ? (
                              <View
                                style={[
                                  styles.slideBadge,
                                  {
                                    borderColor: theme.border,
                                    backgroundColor: theme.surface,
                                  },
                                ]}
                              >
                                <Text style={[styles.slideBadgeCodeText, { color: theme.tint }]}>{slide.courseCode}</Text>
                              </View>
                            ) : null}
                          </View>
                        </View>

                        <Pressable
                          style={({ pressed }) => [
                            styles.slideMenuButton,
                            {
                              borderColor: theme.border,
                              backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
                            },
                          ]}
                          onPress={(event) => {
                            setMenuPosition({
                              x: event.nativeEvent.pageX,
                              y: event.nativeEvent.pageY,
                            });
                            setActiveSlideMenu(slide);
                          }}
                        >
                          <Ionicons name="ellipsis-vertical" size={18} color={theme.textSubtle} />
                        </Pressable>
                      </View>

                      <View style={styles.actionsRow}>
                        <Pressable
                          style={({ pressed }) => [
                            styles.primaryButton,
                            { backgroundColor: pressed ? theme.tintPressed : theme.tint },
                          ]}
                          onPress={async () => {
                            try {
                              await openSlideInDeviceViewer(slide);
                            } catch (error) {
                              Alert.alert("Open failed", error instanceof Error ? error.message : "Unable to open file.");
                            }
                          }}
                        >
                          <Ionicons name="open-outline" size={16} color={theme.accent} />
                          <Text style={[styles.primaryButtonText, { color: theme.accent }]}>Open</Text>
                        </Pressable>

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
                          <Text style={[styles.secondaryButtonText, { color: theme.tint }]}>Ask P-AI</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })}
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
  heroPillText: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
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
    borderRadius: Radius.lg,
    padding: Spacing.md,
  },
  slideHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  slideFileTypeIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  slideTextWrap: {
    flex: 1,
    gap: Spacing.xs,
  },
  slideTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    lineHeight: 20,
  },
  slideMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  slideBadge: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  slideBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  slideBadgeCodeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  slideMenuButton: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  actionsRow: {
    marginTop: Spacing.md,
    flexDirection: "row",
    gap: Spacing.sm,
  },
  primaryButton: {
    flex: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  primaryButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  secondaryButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  actionSheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(3, 10, 18, 0.45)",
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  actionSheetSheet: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    gap: Spacing.sm,
  },
  actionSheetHandle: {
    width: 52,
    height: 5,
    borderRadius: Radius.pill,
    alignSelf: "center",
    opacity: 0.9,
  },
  actionSheetCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: "hidden",
  },
  actionSheetHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    borderBottomWidth: 1,
  },
  actionSheetTitle: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  actionSheetClose: {
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionSheetItem: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  actionSheetIconWrap: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionSheetText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  actionSheetDivider: {
    height: 1,
    opacity: 0.9,
    marginLeft: Spacing.lg + 36 + Spacing.sm,
  },
  popoverContainer: {
    position: "absolute",
    zIndex: 1000,
  },
  popoverCard: {
    width: 340,
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: "hidden",
  },
  popoverHeader: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  popoverTitle: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  popoverCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  popoverGrid: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    justifyContent: "space-between",
  },
  popoverGridItem: {
    width: "48%",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  popoverIconBox: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  popoverGridLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textAlign: "center",
  },
});