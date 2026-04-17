import { useEffect, useMemo, useRef, useState, type ComponentProps } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
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
import { Ionicons } from "@expo/vector-icons";
import { Redirect, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Colors,
  FontSize,
  FontWeight,
  Radius,
  Spacing,
} from "@/constants/theme";
import {
  DEFAULT_CLASS_OPTIONS,
  DEFAULT_PROGRAMS_BY_DEPARTMENT,
  fetchOnboardingCatalog,
  getScopedClassOptions,
  type OnboardingCatalog,
} from "@/lib/catalog";
import {
  getStudentProfile,
  isProfileComplete,
  saveStudentProfile,
  type StudentOnboardingProfile,
} from "@/lib/student-profile";
import { useAuth } from "@/providers/auth-provider";

const YEAR_OPTIONS = [1, 2, 3, 4];
const SEMESTER_OPTIONS = [1, 2];

const TOTAL_STEPS = 6;

type StepKey =
  | "welcome"
  | "department"
  | "program"
  | "class"
  | "year"
  | "semester";

const STEPS: { key: StepKey; title: string; subtitle: string }[] = [
  {
    key: "welcome",
    title: "Welcome to UPSA Connect",
    subtitle: "A quick setup personalizes your classes, slides, timetable, and AI tutor.",
  },
  {
    key: "department",
    title: "Which department are you in?",
    subtitle: "Pick your school or academic department.",
  },
  {
    key: "program",
    title: "Select your program",
    subtitle: "We use this to tailor your course stream.",
  },
  {
    key: "class",
    title: "Choose your class",
    subtitle: "Use a preset or type your own class label.",
  },
  {
    key: "year",
    title: "What year are you in?",
    subtitle: "Your year helps us sequence class materials correctly.",
  },
  {
    key: "semester",
    title: "Final step",
    subtitle: "Set semester and finish setup.",
  },
];

type SelectionKind = "department" | "program" | "class" | "year" | "semester";
type SelectionLayout = "row" | "tile";
type IconName = ComponentProps<typeof Ionicons>["name"];

const DEPARTMENT_ICONS: Record<string, IconName> = {
  Accounting: "calculator-outline",
  Marketing: "megaphone-outline",
  "Information Technology": "hardware-chip-outline",
  Economics: "pie-chart-outline",
  Law: "document-text-outline",
};

const CLASS_ICONS: Record<string, IconName> = {
  "Class A": "people-outline",
  "Class B": "layers-outline",
  "Class C": "grid-outline",
  Weekend: "calendar-outline",
};

const YEAR_ICONS: Record<number, IconName> = {
  1: "leaf-outline",
  2: "flash-outline",
  3: "rocket-outline",
  4: "ribbon-outline",
};

const SEMESTER_ICONS: Record<number, IconName> = {
  1: "sunny-outline",
  2: "moon-outline",
};

function getSelectionIcon(kind: SelectionKind, option: string | number): IconName {
  if (kind === "department") {
    return DEPARTMENT_ICONS[String(option)] ?? "business-outline";
  }

  if (kind === "class") {
    return CLASS_ICONS[String(option)] ?? "people-outline";
  }

  if (kind === "year") {
    return YEAR_ICONS[Number(option)] ?? "school-outline";
  }

  if (kind === "semester") {
    return SEMESTER_ICONS[Number(option)] ?? "book-outline";
  }

  return "school-outline";
}

function getSelectionMeta(kind: SelectionKind, option: string | number, index: number) {
  if (kind === "department") {
    return "Department stream";
  }

  if (kind === "program") {
    return `Program option ${index + 1}`;
  }

  if (kind === "class") {
    return "Class group";
  }

  if (kind === "year") {
    return `Level ${option}`;
  }

  return `Semester ${option}`;
}

function SelectCards<T extends string | number>({
  options,
  selected,
  onSelect,
  animationKey,
  kind,
  layout = "row",
  columns = 1,
}: {
  options: T[];
  selected: T | null;
  onSelect: (value: T) => void;
  animationKey: string | number;
  kind: SelectionKind;
  layout?: SelectionLayout;
  columns?: 1 | 2;
}) {
  const mode = useColorScheme() === "dark" ? "dark" : "light";
  const theme = Colors[mode];
  const animatedValuesRef = useRef<Animated.Value[]>([]);
  const isTileLayout = layout === "tile";

  useEffect(() => {
    animatedValuesRef.current = options.map(
      (_, index) => animatedValuesRef.current[index] ?? new Animated.Value(0),
    );

    animatedValuesRef.current.forEach((value) => value.setValue(0));

    Animated.stagger(
      30,
      animatedValuesRef.current.map((value) =>
        Animated.timing(value, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [animationKey, options]);

  return (
    <View
      style={[
        styles.selectionCardsWrap,
        columns === 2 && styles.selectionCardsWrapTwoColumns,
      ]}
    >
      {options.map((option, index) => {
        const isActive = option === selected;
        const cardAnimation = animatedValuesRef.current[index] ?? new Animated.Value(1);
        const icon = getSelectionIcon(kind, option);
        const meta = getSelectionMeta(kind, option, index);

        return (
          <Animated.View
            key={String(option)}
            style={[
              styles.selectionCardItem,
              columns === 2
                ? styles.selectionCardItemTwoColumns
                : styles.selectionCardItemSingle,
              {
                opacity: cardAnimation,
                transform: [
                  {
                    translateY: cardAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [10, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable
              android_ripple={{ color: theme.ring, borderless: false }}
              style={({ pressed }) => [
                styles.selectionCard,
                isTileLayout ? styles.selectionCardTile : styles.selectionCardRow,
                {
                  borderColor: isActive ? theme.cta : theme.borderStrong,
                  backgroundColor: isActive ? theme.surfaceGlass : theme.surface,
                  shadowColor: theme.shadow,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}
              onPress={() => onSelect(option)}
            >
              <View
                style={[
                  styles.selectionCardInner,
                  isTileLayout && styles.selectionCardInnerTile,
                ]}
              >
                <View
                  style={[
                    styles.selectionIconWrap,
                    isTileLayout && styles.selectionIconWrapTile,
                    {
                      borderColor: isActive ? theme.cta : theme.border,
                      backgroundColor: isActive ? theme.cta : theme.surfaceMuted,
                    },
                  ]}
                >
                  <Ionicons
                    name={icon}
                    size={isTileLayout ? 20 : 18}
                    color={isActive ? theme.ctaText : theme.icon}
                  />
                </View>

                <View
                  style={[
                    styles.selectionTextWrap,
                    isTileLayout && styles.selectionTextWrapTile,
                  ]}
                >
                  <Text
                    style={[
                      styles.selectionTitle,
                      isTileLayout && styles.selectionTitleTile,
                      {
                        color: isActive ? theme.cta : theme.text,
                      },
                    ]}
                    numberOfLines={isTileLayout ? 2 : 1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    {String(option)}
                  </Text>

                  <Text
                    style={[
                      styles.selectionMeta,
                      isTileLayout && styles.selectionMetaTile,
                      {
                        color: isActive ? theme.textMuted : theme.textSubtle,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {meta}
                  </Text>
                </View>

                <View
                  style={[
                    styles.selectionStatus,
                    isTileLayout && styles.selectionStatusTile,
                    {
                      borderColor: isActive ? theme.cta : theme.borderStrong,
                      backgroundColor: isActive ? theme.cta : "transparent",
                    },
                  ]}
                >
                  <Ionicons
                    name={isActive ? "checkmark" : "add"}
                    size={12}
                    color={isActive ? theme.ctaText : theme.textSubtle}
                  />
                </View>
              </View>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

function SummaryRow({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color }]}>{label}</Text>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
    </View>
  );
}

function getInitialStepFromProfile(profile: Partial<StudentOnboardingProfile>) {
  if (!profile.department) return 0;
  if (!profile.program) return 2;
  if (!profile.className) return 3;
  if (!profile.year) return 4;
  if (!profile.semester) return 5;
  return 5;
}

export default function OnboardingScreen() {
  const { session, user } = useAuth();
  const insets = useSafeAreaInsets();

  const mode = useColorScheme() === "dark" ? "dark" : "light";
  const theme = Colors[mode];

  const [isBooting, setIsBooting] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSavedCompleteProfile, setHasSavedCompleteProfile] = useState(false);

  const [currentStep, setCurrentStep] = useState(0);

  const [department, setDepartment] = useState<string | null>(null);
  const [program, setProgram] = useState<string | null>(null);
  const [className, setClassName] = useState("");
  const [year, setYear] = useState<number | null>(null);
  const [semester, setSemester] = useState<number | null>(null);
  const [catalog, setCatalog] = useState<OnboardingCatalog>({
    departments: Object.keys(DEFAULT_PROGRAMS_BY_DEPARTMENT),
    programsByDepartment: DEFAULT_PROGRAMS_BY_DEPARTMENT,
    classes: DEFAULT_CLASS_OPTIONS,
    classesByProgram: {},
  });

  const transition = useRef(new Animated.Value(1)).current;

  const programOptions = useMemo(() => {
    if (!department) return [];
    return catalog.programsByDepartment[department] ?? [];
  }, [catalog, department]);

  const classOptions = useMemo(
    () => getScopedClassOptions(catalog, department, program),
    [catalog, department, program],
  );

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      if (!user) {
        if (mounted) {
          setIsBooting(false);
        }
        return;
      }

      const [existing, fetchedCatalog] = await Promise.all([
        getStudentProfile(user.id),
        fetchOnboardingCatalog(),
      ]);

      if (mounted) {
        setCatalog(fetchedCatalog);
      }

      if (existing) {
        setDepartment(existing.department);
        setProgram(existing.program);
        setClassName(existing.className);
        setYear(existing.year);
        setSemester(existing.semester);
        setHasSavedCompleteProfile(isProfileComplete(existing));

        const initialStep = getInitialStepFromProfile(existing);
        setCurrentStep(initialStep);
      } else {
        setHasSavedCompleteProfile(false);
      }

      if (mounted) {
        setIsBooting(false);
      }
    };

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, [user]);

  const animateToStep = (nextStep: number) => {
    transition.setValue(0);
    setCurrentStep(nextStep);

    Animated.timing(transition, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };

  if (!session || !user) {
    return <Redirect href="/login" />;
  }

  if (isBooting) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.tint} />
      </View>
    );
  }

  if (hasSavedCompleteProfile) {
    return <Redirect href="/(tabs)/home" />;
  }

  const progress = ((currentStep + 1) / TOTAL_STEPS) * 100;
  const stepInfo = STEPS[currentStep];

  const animatedStyle = {
    opacity: transition,
    transform: [
      {
        translateY: transition.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0],
        }),
      },
    ],
  };

  const goBack = () => {
    setError(null);
    if (currentStep === 0) {
      router.replace("/login");
      return;
    }
    animateToStep(currentStep - 1);
  };

  const goNext = async () => {
    setError(null);

    if (currentStep === 1 && !department) {
      setError("Choose your department to continue.");
      return;
    }

    if (currentStep === 2 && !program) {
      setError("Choose your program to continue.");
      return;
    }

    if (currentStep === 3 && !className.trim()) {
      setError("Please add your class.");
      return;
    }

    if (currentStep === 4 && !year) {
      setError("Select your current year.");
      return;
    }

    if (currentStep === 5 && !semester) {
      setError("Select your semester.");
      return;
    }

    if (currentStep === TOTAL_STEPS - 1) {
      const payload: StudentOnboardingProfile = {
        department: department ?? "",
        program: program ?? "",
        className: className.trim(),
        year: year ?? 0,
        semester: semester ?? 0,
      };

      if (!isProfileComplete(payload)) {
        setError("Please complete every field before finishing setup.");
        return;
      }

      setIsSaving(true);
      try {
        await saveStudentProfile(user.id, payload);
        setHasSavedCompleteProfile(true);
        router.replace("/(tabs)/home");
      } catch (saveError) {
        setError(
          saveError instanceof Error
            ? saveError.message
            : "Unable to save your profile.",
        );
      } finally {
        setIsSaving(false);
      }
      return;
    }

    animateToStep(currentStep + 1);
  };

  const renderStepBody = () => {
    if (stepInfo.key === "welcome") {
      return (
        <View style={styles.stepBody}>
          <View style={[styles.heroBadge, { borderColor: theme.borderStrong }]}> 
            <Image
              source={require("../assets/images/upsa.jpg")}
              style={styles.heroImage}
              resizeMode="cover"
            />
          </View>
          <Text style={[styles.heroTitle, { color: theme.tint }]}>Set up in less than 1 minute</Text>
          <Text style={[styles.heroText, { color: theme.textMuted }]}> 
            We will tailor your dashboard, notifications, and class materials based on
            your academic profile.
          </Text>
          <View style={[styles.inlineHint, { backgroundColor: theme.surfaceGlass, borderColor: theme.border }]}> 
            <Text style={[styles.inlineHintText, { color: theme.textMuted }]}>Tap Continue to begin setup</Text>
          </View>
        </View>
      );
    }

    if (stepInfo.key === "department") {
      return (
        <View style={styles.stepBody}>
          <SelectCards
            kind="department"
            layout="row"
            options={catalog.departments}
            selected={department}
            animationKey={`department-${currentStep}`}
            onSelect={(value) => {
              setDepartment(value);
              setProgram(null);
            }}
          />
        </View>
      );
    }

    if (stepInfo.key === "program") {
      return (
        <View style={styles.stepBody}>
          {!department ? (
            <Text style={[styles.helperText, { color: theme.textMuted }]}> 
              Choose your department first to see matching programs.
            </Text>
          ) : (
            <SelectCards
              kind="program"
              layout="row"
              options={programOptions}
              selected={program}
              animationKey={`program-${department ?? "none"}-${currentStep}`}
              onSelect={(value) => setProgram(value)}
            />
          )}
        </View>
      );
    }

    if (stepInfo.key === "class") {
      return (
        <View style={styles.stepBody}>
          <SelectCards
            kind="class"
            layout="row"
            options={classOptions}
            selected={className || null}
            animationKey={`class-${currentStep}`}
            onSelect={(value) => setClassName(value)}
          />
          <TextInput
            style={[
              styles.input,
              {
                borderColor: theme.border,
                color: theme.text,
                backgroundColor: theme.surfaceMuted,
              },
            ]}
            placeholder="Or enter a custom class"
            placeholderTextColor={theme.textSubtle}
            value={className}
            onChangeText={setClassName}
          />
        </View>
      );
    }

    if (stepInfo.key === "year") {
      return (
        <View style={styles.stepBody}>
          <SelectCards
            kind="year"
            layout="row"
            columns={2}
            options={YEAR_OPTIONS}
            selected={year}
            animationKey={`year-${currentStep}`}
            onSelect={setYear}
          />
        </View>
      );
    }

    return (
      <View style={styles.stepBody}>
        <SelectCards
          kind="semester"
          layout="row"
          columns={2}
          options={SEMESTER_OPTIONS}
          selected={semester}
          animationKey={`semester-${currentStep}`}
          onSelect={setSemester}
        />

        <View
          style={[
            styles.summaryPanel,
            {
              backgroundColor: theme.surfaceGlass,
              borderColor: theme.border,
            },
          ]}
        >
          <SummaryRow
            label="Department"
            value={department ?? "-"}
            color={theme.text}
          />
          <SummaryRow label="Program" value={program ?? "-"} color={theme.text} />
          <SummaryRow
            label="Class"
            value={className.trim() || "-"}
            color={theme.text}
          />
          <SummaryRow label="Year" value={String(year ?? "-")} color={theme.text} />
          <SummaryRow
            label="Semester"
            value={String(semester ?? "-")}
            color={theme.text}
          />
        </View>
      </View>
    );
  };

  const nextLabel = currentStep === TOTAL_STEPS - 1 ? "Finish setup" : "Continue";

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.glowOne, { backgroundColor: theme.heroOrbOne }]} />
      <View style={[styles.glowTwo, { backgroundColor: theme.heroOrbTwo }]} />
      <View style={[styles.glowThree, { backgroundColor: theme.accent }]} />

      <View
        style={[
          styles.safe,
          {
            paddingTop: insets.top + Spacing.md,
            paddingBottom: insets.bottom + Spacing.md,
            paddingHorizontal: Spacing.xl,
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={[styles.stepCounter, { color: theme.icon }]}>Step {currentStep + 1} of {TOTAL_STEPS}</Text>
          <View style={[styles.progressTrack, { backgroundColor: theme.border }]}> 
            <View
              style={[
                styles.progressFill,
                { backgroundColor: theme.cta, width: `${progress}%` },
              ]}
            />
          </View>

          <Text style={[styles.title, { color: theme.tint }]}>{stepInfo.title}</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>{stepInfo.subtitle}</Text>
        </View>

        <Animated.View style={[styles.pageBody, animatedStyle]}>
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.pageScroll}
          >
            {renderStepBody()}
          </ScrollView>
        </Animated.View>

        {error ? <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text> : null}

        <View style={styles.footer}>
          <Pressable
            android_ripple={{ color: theme.ring, borderless: false }}
            style={({ pressed }) => [
              styles.secondaryButton,
              {
                borderColor: theme.borderStrong,
                backgroundColor: pressed ? theme.surfaceGlass : theme.surface,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              },
            ]}
            onPress={goBack}
          >
            <Text style={[styles.secondaryButtonText, { color: theme.text }]}>Previous</Text>
          </Pressable>

          <Pressable
            android_ripple={{ color: theme.ring, borderless: false }}
            style={({ pressed }) => [
              styles.primaryButton,
              {
                backgroundColor: pressed ? theme.ctaPressed : theme.cta,
                opacity: isSaving ? 0.7 : 1,
                shadowColor: theme.shadow,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              },
            ]}
            disabled={isSaving}
            onPress={() => {
              void goNext();
            }}
          >
            {isSaving ? (
              <ActivityIndicator color={theme.ctaText} />
            ) : (
              <Text style={[styles.primaryButtonText, { color: theme.ctaText }]}> 
                {nextLabel}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flex: 1,
    overflow: "hidden",
  },
  safe: {
    flex: 1,
  },
  glowOne: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 999,
    top: -120,
    right: -100,
    opacity: 0.2,
  },
  glowTwo: {
    position: "absolute",
    width: 330,
    height: 330,
    borderRadius: 999,
    bottom: -160,
    left: -130,
    opacity: 0.18,
  },
  glowThree: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 999,
    top: "36%",
    left: -110,
    opacity: 0.09,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  stepCounter: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 2.2,
  },
  progressTrack: {
    marginTop: Spacing.sm,
    height: 7,
    borderRadius: Radius.pill,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: Radius.pill,
  },
  title: {
    marginTop: Spacing.md,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  pageBody: {
    flex: 1,
  },
  pageScroll: {
    flexGrow: 1,
    paddingVertical: Spacing.md,
  },
  stepBody: {
    flex: 1,
    gap: Spacing.md,
    justifyContent: "flex-start",
  },
  heroBadge: {
    width: 86,
    height: 86,
    borderRadius: 24,
    borderWidth: 2,
    overflow: "hidden",
    alignSelf: "center",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroTitle: {
    marginTop: Spacing.md,
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
    textAlign: "center",
  },
  heroText: {
    marginTop: Spacing.sm,
    fontSize: FontSize.md,
    lineHeight: 23,
    textAlign: "center",
  },
  inlineHint: {
    alignSelf: "center",
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  inlineHintText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  helperText: {
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  selectionCardsWrap: {
    gap: Spacing.md,
  },
  selectionCardsWrapTwoColumns: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  selectionCardItem: {
    width: "100%",
  },
  selectionCardItemSingle: {
    width: "100%",
  },
  selectionCardItemTwoColumns: {
    width: "48.2%",
  },
  selectionCard: {
    borderWidth: 2,
    borderRadius: Radius.lg + 4,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 4,
    overflow: "hidden",
  },
  selectionCardRow: {
    minHeight: 86,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  selectionCardTile: {
    minHeight: 132,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  selectionCardInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  selectionCardInnerTile: {
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
  },
  selectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  selectionIconWrapTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
  },
  selectionTextWrap: {
    flex: 1,
    gap: 2,
  },
  selectionTextWrapTile: {
    flex: 0,
    alignItems: "center",
  },
  selectionTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    lineHeight: 21,
  },
  selectionTitleTile: {
    textAlign: "center",
    fontSize: FontSize.lg,
  },
  selectionMeta: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  selectionMetaTile: {
    letterSpacing: 0.8,
  },
  selectionStatus: {
    width: 24,
    height: 24,
    borderRadius: 99,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  selectionStatusTile: {
    marginTop: Spacing.xs,
  },
  input: {
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
  },
  summaryPanel: {
    marginTop: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  summaryLabel: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  summaryValue: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
    textAlign: "right",
    flexShrink: 1,
  },
  errorText: {
    marginTop: Spacing.md,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  footer: {
    marginTop: Spacing.md,
    flexDirection: "row",
    gap: Spacing.sm,
  },
  secondaryButton: {
    flex: 0.9,
    height: 56,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  secondaryButtonText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  primaryButton: {
    flex: 1.4,
    height: 56,
    borderRadius: Radius.lg + 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 6,
    overflow: "hidden",
  },
  primaryButtonText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
});
