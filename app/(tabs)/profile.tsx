import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { fetchOnboardingCatalog, getScopedClassOptions } from "@/lib/catalog";
import {
  getResolvedStudentProfile,
  saveStudentProfile,
  type StudentOnboardingProfile,
} from "@/lib/student-profile";
import { useAuth } from "@/providers/auth-provider";

const YEAR_OPTIONS = [1, 2, 3, 4];
const SEMESTER_OPTIONS = [1, 2];
const PROFILE_EXTRA_KEY_PREFIX = "upsa.profile.extra";

type ProfileExtra = {
  displayName: string;
  learningGoal: string;
  studyFocus: string;
};

function extraStorageKey(userId: string) {
  return `${PROFILE_EXTRA_KEY_PREFIX}.${userId}`;
}

function SelectChips<T extends string | number>({
  options,
  selected,
  onSelect,
  theme,
}: {
  options: T[];
  selected: T | null;
  onSelect: (value: T) => void;
  theme: (typeof Colors)["light"] | (typeof Colors)["dark"];
}) {
  return (
    <View style={styles.chipWrap}>
      {options.map((option) => {
        const active = option === selected;
        return (
          <Pressable
            key={String(option)}
            onPress={() => onSelect(option)}
            style={[
              styles.chip,
              {
                borderColor: active ? theme.chipActive : theme.border,
                backgroundColor: active ? theme.chipActive : theme.surfaceMuted,
              },
            ]}
          >
            <Text style={[styles.chipText, { color: active ? theme.chipTextOnActive : theme.text }]}>
              {String(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const mode = useColorScheme() === "dark" ? "dark" : "light";
  const theme = Colors[mode];
  const insets = useSafeAreaInsets();

  const [department, setDepartment] = useState<string | null>(null);
  const [program, setProgram] = useState<string | null>(null);
  const [className, setClassName] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [semester, setSemester] = useState<number | null>(null);

  const [displayName, setDisplayName] = useState("");
  const [learningGoal, setLearningGoal] = useState("");
  const [studyFocus, setStudyFocus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { data: catalog, isLoading: catalogLoading } = useQuery({
    queryKey: ["onboarding-catalog"],
    queryFn: fetchOnboardingCatalog,
  });

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["student-profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) return null;
      return getResolvedStudentProfile(user.id);
    },
  });

  useEffect(() => {
    if (!profile) return;

    setDepartment(profile.department || null);
    setProgram(profile.program || null);
    setClassName(profile.className || null);
    setYear(profile.year || null);
    setSemester(profile.semester || null);
  }, [profile]);

  useEffect(() => {
    let mounted = true;

    const loadExtra = async () => {
      if (!user) return;
      const raw = await AsyncStorage.getItem(extraStorageKey(user.id));
      if (!raw) return;

      try {
        const parsed = JSON.parse(raw) as Partial<ProfileExtra>;
        if (!mounted) return;
        setDisplayName(String(parsed.displayName ?? ""));
        setLearningGoal(String(parsed.learningGoal ?? ""));
        setStudyFocus(String(parsed.studyFocus ?? ""));
      } catch {
        // Ignore invalid local extra profile payload.
      }
    };

    void loadExtra();

    return () => {
      mounted = false;
    };
  }, [user]);

  const programOptions = useMemo(() => {
    if (!catalog || !department) return [];
    return catalog.programsByDepartment[department] ?? [];
  }, [catalog, department]);

  const classOptions = useMemo(() => {
    if (!catalog) return [];
    return getScopedClassOptions(catalog, department, program);
  }, [catalog, department, program]);

  if (!user) {
    return null;
  }

  if (catalogLoading || profileLoading || !catalog) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.tint} />
      </View>
    );
  }

  const saveProfile = async () => {
    if (!department || !program || !className || !year || !semester) {
      Alert.alert("Profile", "Please complete all academic fields.");
      return;
    }

    setIsSaving(true);
    try {
      const payload: StudentOnboardingProfile = {
        department,
        program,
        className,
        year,
        semester,
      };

      await saveStudentProfile(user.id, payload);

      const extraPayload: ProfileExtra = {
        displayName: displayName.trim(),
        learningGoal: learningGoal.trim(),
        studyFocus: studyFocus.trim(),
      };

      await AsyncStorage.setItem(
        extraStorageKey(user.id),
        JSON.stringify(extraPayload),
      );

      Alert.alert("Saved", "Your profile has been updated.");
    } catch (error) {
      Alert.alert(
        "Save failed",
        error instanceof Error ? error.message : "Unable to update profile.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const fallbackDisplayName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split("@")[0] ??
    "UPSA Student";

  const heroName = (displayName.trim() || String(fallbackDisplayName)).trim();
  const avatarLetter = heroName.slice(0, 1).toUpperCase() || "U";

  const academicLine = department
    ? [
        department,
        program,
        className,
        year && semester ? `Y${year} • S${semester}` : null,
      ]
        .filter(Boolean)
        .join(" • ")
    : "Set your academic profile to personalize UPSA Connect.";

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
    >
      <ScrollView
        style={[styles.screen, { backgroundColor: theme.background }]}
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
            { backgroundColor: theme.heroBackground, paddingTop: insets.top + Spacing.md },
          ]}
        >
          <View style={[styles.heroOrbOne, { backgroundColor: theme.heroOrbOne }]} />
          <View style={[styles.heroOrbTwo, { backgroundColor: theme.heroOrbTwo }]} />

          <Text style={[styles.heroEyebrow, { color: theme.textOnHero }]}>UPSA Connect</Text>

          <View style={styles.heroHeaderRow}>
            <View style={[styles.avatarCircle, { borderColor: theme.borderStrong }]}>
              <Text style={[styles.avatarLetter, { color: theme.textOnHero }]}>{avatarLetter}</Text>
            </View>

            <View style={styles.heroHeaderText}>
              <Text style={[styles.heroName, { color: theme.textOnHero }]} numberOfLines={1}>
                {heroName}
              </Text>
              {user.email ? (
                <Text style={[styles.heroEmail, { color: theme.textMuted }]} numberOfLines={1}>
                  {user.email}
                </Text>
              ) : null}
            </View>
          </View>

          <Text style={[styles.heroSubtitle, { color: theme.textMuted }]} numberOfLines={2}>
            {academicLine}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            {
              borderColor: theme.border,
              backgroundColor: theme.surface,
              shadowColor: theme.shadow,
              ...Shadows.card,
            },
          ]}
        >
          <View style={styles.sectionHeader}>
            <Ionicons name="school-outline" size={18} color={theme.tint} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Academic Setup</Text>
          </View>

        <Text style={[styles.label, { color: theme.textSubtle }]}>Department</Text>
        <SelectChips
          options={catalog.departments}
          selected={department}
          onSelect={(value) => {
            setDepartment(value);
            setProgram(null);
            setClassName(null);
          }}
          theme={theme}
        />

        <Text style={[styles.label, { color: theme.textSubtle }]}>Program</Text>
        <SelectChips
          options={programOptions}
          selected={program}
          onSelect={(value) => {
            setProgram(value);
            setClassName(null);
          }}
          theme={theme}
        />

        <Text style={[styles.label, { color: theme.textSubtle }]}>Class</Text>
        <SelectChips
          options={classOptions}
          selected={className}
          onSelect={setClassName}
          theme={theme}
        />

        <Text style={[styles.label, { color: theme.textSubtle }]}>Year</Text>
        <SelectChips options={YEAR_OPTIONS} selected={year} onSelect={setYear} theme={theme} />

        <Text style={[styles.label, { color: theme.textSubtle }]}>Semester</Text>
        <SelectChips
          options={SEMESTER_OPTIONS}
          selected={semester}
          onSelect={setSemester}
          theme={theme}
        />
      </View>

      <View
        style={[
          styles.card,
          {
            borderColor: theme.border,
            backgroundColor: theme.surface,
            shadowColor: theme.shadow,
            ...Shadows.card,
          },
        ]}
      >
        <View style={styles.sectionHeader}>
          <Ionicons name="person-outline" size={18} color={theme.tint} />
          <Text style={[styles.sectionTitle, { color: theme.text }]}>More About You</Text>
        </View>

        <Text style={[styles.label, { color: theme.textSubtle }]}>Display Name</Text>
        <TextInput
          value={displayName}
          onChangeText={setDisplayName}
          placeholder="How should we address you?"
          placeholderTextColor={theme.textSubtle}
          style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surfaceMuted }]}
        />

        <Text style={[styles.label, { color: theme.textSubtle }]}>Learning Goal</Text>
        <TextInput
          value={learningGoal}
          onChangeText={setLearningGoal}
          placeholder="What are you focusing on this semester?"
          placeholderTextColor={theme.textSubtle}
          style={[styles.input, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surfaceMuted }]}
        />

        <Text style={[styles.label, { color: theme.textSubtle }]}>Study Focus</Text>
        <TextInput
          value={studyFocus}
          onChangeText={setStudyFocus}
          multiline
          numberOfLines={3}
          placeholder="Add study rhythm, preferred AI style, exam priorities..."
          placeholderTextColor={theme.textSubtle}
          style={[styles.input, styles.multilineInput, { borderColor: theme.border, color: theme.text, backgroundColor: theme.surfaceMuted }]}
        />
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={saveProfile}
          disabled={isSaving}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: pressed ? theme.tintPressed : theme.tint,
              opacity: isSaving ? 0.7 : 1,
            },
          ]}
        >
          <Text style={[styles.primaryButtonText, { color: theme.accent }]}>
            {isSaving ? "Saving..." : "Save Profile"}
          </Text>
        </Pressable>

        <Pressable
          onPress={async () => {
            await signOut();
          }}
          style={({ pressed }) => [
            styles.secondaryButton,
            {
              borderColor: theme.danger,
              backgroundColor: pressed ? theme.surfaceMuted : "transparent",
            },
          ]}
        >
          <Text style={[styles.secondaryButtonText, { color: theme.danger }]}>Sign Out</Text>
        </Pressable>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
  heroHeaderRow: {
    marginTop: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.10)",
  },
  avatarLetter: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.extrabold,
  },
  heroHeaderText: {
    flex: 1,
  },
  heroName: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
  },
  heroEmail: {
    marginTop: 2,
    fontSize: FontSize.sm,
  },
  heroSubtitle: {
    marginTop: Spacing.md,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: Spacing.sm,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  chipText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.3,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
  },
  multilineInput: {
    minHeight: 84,
    textAlignVertical: "top",
  },
  actionRow: {
    gap: Spacing.sm,
  },
  primaryButton: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  secondaryButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
});