import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, type ComponentProps } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  fetchCampusScopeCounts,
  fetchScopedCampusPosts,
  fetchScopedCourses,
} from "@/lib/catalog";
import {
  getResolvedStudentProfile,
  isProfileComplete,
} from "@/lib/student-profile";
import { fetchTimetable, getCurrentClass, getNextClass } from "@/lib/timetable";
import { useAuth } from "@/providers/auth-provider";
import {
  Colors,
  FontSize,
  FontWeight,
  Radius,
  Shadows,
  Spacing,
} from "@/constants/theme";

type QuickAction = {
  label: string;
  subtitle: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  route: string;
};

const QUICK_ACTIONS: QuickAction[] = [
  {
    label: "Timetable",
    subtitle: "Class schedule",
    icon: "calendar-outline",
    route: "/(tabs)/timetable",
  },
  {
    label: "My Slides",
    subtitle: "Course materials",
    icon: "document-text-outline",
    route: "/(tabs)/my-slides",
  },
  {
    label: "AI Tutor",
    subtitle: "Study support",
    icon: "sparkles-outline",
    route: "/(tabs)/ai-tutor",
  },
  {
    label: "Onboarding",
    subtitle: "Update profile",
    icon: "settings-outline",
    route: "/onboarding",
  },
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const mode = useColorScheme() === "dark" ? "dark" : "light";
  const theme = Colors[mode];

  const { data: profile } = useQuery({
    queryKey: ["student-profile", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) return null;
      return getResolvedStudentProfile(user.id);
    },
  });

  const normalizedProfile = profile === undefined ? null : profile;
  const profileComplete = isProfileComplete(normalizedProfile);

  const { data: timetable = [] } = useQuery({
    queryKey: ["timetable"],
    queryFn: fetchTimetable,
  });

  const { data: scopedCourses = [] } = useQuery({
    queryKey: [
      "scoped-courses",
      profile?.department,
      profile?.program,
      profile?.className,
      profile?.year,
      profile?.semester,
    ],
    enabled: profileComplete,
    queryFn: async () => fetchScopedCourses(normalizedProfile),
  });

  const { data: scopeCounts = { courses: 0, materials: 0, announcements: 0 } } = useQuery({
    queryKey: [
      "scope-counts",
      profile?.department,
      profile?.program,
      profile?.className,
      profile?.year,
      profile?.semester,
    ],
    enabled: profileComplete,
    queryFn: async () => fetchCampusScopeCounts(normalizedProfile),
  });

  const { data: scopedPosts = [] } = useQuery({
    queryKey: [
      "scoped-posts",
      profile?.department,
      profile?.program,
      profile?.className,
      profile?.year,
      profile?.semester,
    ],
    enabled: profileComplete,
    queryFn: async () => fetchScopedCampusPosts(normalizedProfile),
  });

  const currentClass = useMemo(() => getCurrentClass(timetable), [timetable]);
  const nextClass = useMemo(() => getNextClass(timetable), [timetable]);

  const todayClasses = useMemo(() => {
    const currentDay = new Date().getDay();
    return timetable
      .filter((entry) => entry.dayOfWeek === currentDay)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [timetable]);

  const displayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split("@")[0] ??
    "UPSA Student";

  const firstName = displayName.split(/\s+/)[0] ?? "Student";

  const nextClassText = nextClass
    ? `${WEEKDAY_LABELS[nextClass.entry.dayOfWeek] ?? "Day"} ${nextClass.entry.startTime} - ${nextClass.entry.endTime}`
    : "No upcoming lecture found";

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      bounces={false}
      alwaysBounceVertical={false}
      overScrollMode="never"
    >
      <View
        style={[
          styles.hero,
          {
            backgroundColor: theme.heroBackground,
            borderColor: theme.borderStrong,
            paddingTop: insets.top + Spacing.md,
          },
        ]}
      >
        <View style={[styles.heroOrbOne, { backgroundColor: theme.heroOrbOne }]} />
        <View style={[styles.heroOrbTwo, { backgroundColor: theme.heroOrbTwo }]} />

        <Text style={[styles.heroEyebrow, { color: theme.textOnHero }]}>UPSA Connect</Text>
        <Text style={[styles.heroTitle, { color: theme.textOnHero }]}>Hello, {firstName}</Text>
        <Text style={[styles.heroSubtitle, { color: theme.textMuted }]}> 
          {profileComplete
            ? `${profile?.department} | ${profile?.program}`
            : "Complete onboarding to personalize your campus workspace."}
        </Text>

        <View style={[styles.heroStatusRow, { borderColor: theme.borderStrong }]}> 
          <Ionicons
            name={currentClass ? "radio-outline" : "time-outline"}
            size={16}
            color={theme.accent}
          />
          <Text style={[styles.heroStatusText, { color: theme.textOnHero }]}> 
            {currentClass
              ? `Live now: ${currentClass.course} at ${currentClass.venue}`
              : `Next class: ${nextClassText}`}
          </Text>
        </View>

        {currentClass ? (
          <View style={styles.heroProgressWrap}>
            <View
              style={[
                styles.heroProgressTrack,
                {
                  backgroundColor: "rgba(255, 255, 255, 0.16)",
                  borderColor: "rgba(255, 255, 255, 0.18)",
                },
              ]}
            >
              <View
                style={[
                  styles.heroProgressFill,
                  {
                    backgroundColor: theme.accent,
                    width: `${Math.max(currentClass.progress * 100, 3)}%`,
                  },
                ]}
              />
            </View>
            <Text style={[styles.heroProgressText, { color: theme.textOnHero }]}>
              {currentClass.remainingMinutes} min left
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.quickActionsGrid, styles.sectionSpacing]}>
        {QUICK_ACTIONS.map((action) => (
          <Pressable
            key={action.label}
            android_ripple={{ color: theme.ring, borderless: false }}
            style={({ pressed }) => [
              styles.quickActionCard,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              },
            ]}
            onPress={() => {
              router.push(action.route as never);
            }}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: theme.surfaceMuted }]}> 
              <Ionicons name={action.icon} size={20} color={theme.tint} />
            </View>
            <Text style={[styles.quickActionTitle, { color: theme.text }]}>{action.label}</Text>
            <Text style={[styles.quickActionSubtitle, { color: theme.textSubtle }]}> 
              {action.subtitle}
            </Text>
          </Pressable>
        ))}
      </View>

      <View
        style={[
          styles.card,
          styles.sectionSpacing,
          { borderColor: theme.border, backgroundColor: theme.surface },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.tint }]}>Academic Profile</Text>

        {profileComplete ? (
          <View style={styles.profileGrid}>
            <ProfilePill label="Department" value={profile?.department ?? "-"} theme={theme} />
            <ProfilePill label="Program" value={profile?.program ?? "-"} theme={theme} />
            <ProfilePill label="Class" value={profile?.className ?? "-"} theme={theme} />
            <ProfilePill
              label="Year / Sem"
              value={`Y${profile?.year} S${profile?.semester}`}
              theme={theme}
            />
          </View>
        ) : (
          <View style={styles.emptyWrap}>
            <Text style={[styles.emptyText, { color: theme.textMuted }]}> 
              Your profile is incomplete. Finish onboarding to unlock personalized content.
            </Text>
            <Pressable
              style={({ pressed }) => [
                styles.inlineButton,
                { backgroundColor: pressed ? theme.ctaPressed : theme.cta },
              ]}
              onPress={() => {
                router.push("/onboarding");
              }}
            >
              <Text style={[styles.inlineButtonText, { color: theme.ctaText }]}>Complete Onboarding</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View
        style={[
          styles.card,
          styles.sectionSpacing,
          { borderColor: theme.border, backgroundColor: theme.surface },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.tint }]}>Today at UPSA</Text>
        <Text style={[styles.cardSubtitle, { color: theme.textSubtle }]}> 
          {todayClasses.length
            ? `${todayClasses.length} classes scheduled today`
            : "No scheduled class for today."}
        </Text>

        <View style={styles.todayList}>
          {todayClasses.slice(0, 4).map((entry) => (
            <View
              key={entry.id}
              style={[
                styles.todayItem,
                { borderColor: theme.border, backgroundColor: theme.surfaceMuted },
              ]}
            >
              <View style={styles.todayTimeWrap}>
                <Text style={[styles.todayTime, { color: theme.tint }]}>{entry.startTime}</Text>
                <Text style={[styles.todayTimeTo, { color: theme.textSubtle }]}>{entry.endTime}</Text>
              </View>
              <View style={styles.todayMetaWrap}>
                <Text style={[styles.todayCourse, { color: theme.text }]} numberOfLines={1}>
                  {entry.course}
                </Text>
                <Text style={[styles.todayVenue, { color: theme.textMuted }]} numberOfLines={1}>
                  {entry.venue}
                </Text>
              </View>
            </View>
          ))}

          {!todayClasses.length ? (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>Use the timetable tab to view your full week.</Text>
          ) : null}
        </View>
      </View>

      <View
        style={[
          styles.card,
          styles.sectionSpacing,
          { borderColor: theme.border, backgroundColor: theme.surface },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.tint }]}>Semester Workspace</Text>

        <View style={styles.metricsRow}>
          <MetricBadge
            label="Courses"
            value={String(scopeCounts.courses || scopedCourses.length)}
            theme={theme}
          />
          <MetricBadge label="Materials" value={String(scopeCounts.materials)} theme={theme} />
          <MetricBadge
            label="Notices"
            value={String(scopeCounts.announcements || scopedPosts.length)}
            theme={theme}
          />
        </View>

        <View style={styles.courseList}>
          {scopedCourses.slice(0, 5).map((courseItem) => (
            <View
              key={courseItem.id}
              style={[
                styles.courseItem,
                { borderColor: theme.border, backgroundColor: theme.surfaceMuted },
              ]}
            >
              <Text style={[styles.courseCode, { color: theme.tint }]}>{courseItem.courseCode}</Text>
              <View style={styles.courseBody}>
                <Text style={[styles.courseName, { color: theme.text }]} numberOfLines={1}>
                  {courseItem.courseTitle}
                </Text>
                <Text style={[styles.courseCredit, { color: theme.textSubtle }]}> 
                  {courseItem.credits} credits
                </Text>
              </View>
            </View>
          ))}

          {!scopedCourses.length ? (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}> 
              No scoped courses yet. Admin can add courses from the admin dashboard.
            </Text>
          ) : null}
        </View>
      </View>

      <View
        style={[
          styles.card,
          styles.sectionSpacing,
          styles.lastSection,
          { borderColor: theme.border, backgroundColor: theme.surface },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.tint }]}>Announcements</Text>

        <View style={styles.postList}>
          {scopedPosts.slice(0, 4).map((post) => (
            <View
              key={post.id}
              style={[
                styles.postItem,
                { borderColor: theme.border, backgroundColor: theme.surfaceMuted },
              ]}
            >
              <Text style={[styles.postTitle, { color: theme.text }]} numberOfLines={1}>
                {post.title}
              </Text>
              <Text style={[styles.postBody, { color: theme.textMuted }]} numberOfLines={2}>
                {post.body}
              </Text>
              <Text style={[styles.postDate, { color: theme.textSubtle }]}> 
                {post.createdAt
                  ? new Date(post.createdAt).toLocaleDateString()
                  : "Recent"}
              </Text>
            </View>
          ))}

          {!scopedPosts.length ? (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}> 
              No announcements for your stream yet.
            </Text>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

function ProfilePill({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: (typeof Colors)["light"] | (typeof Colors)["dark"];
}) {
  return (
    <View
      style={[
        styles.profilePill,
        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.profilePillLabel, { color: theme.textSubtle }]}>{label}</Text>
      <Text style={[styles.profilePillValue, { color: theme.text }]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function MetricBadge({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: (typeof Colors)["light"] | (typeof Colors)["dark"];
}) {
  return (
    <View
      style={[
        styles.metricBadge,
        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
      ]}
    >
      <Text style={[styles.metricValue, { color: theme.tint }]}>{value}</Text>
      <Text style={[styles.metricLabel, { color: theme.textSubtle }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
  },
  sectionSpacing: {
    marginTop: Spacing.lg,
  },
  lastSection: {
    marginBottom: Spacing.xl,
  },
  hero: {
    marginHorizontal: -Spacing.lg,
    borderWidth: 0,
    borderBottomLeftRadius: Radius.xxl,
    borderBottomRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    overflow: "hidden",
  },
  heroOrbOne: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 99,
    right: -36,
    top: -30,
    opacity: 0.35,
  },
  heroOrbTwo: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 99,
    left: -40,
    bottom: -46,
    opacity: 0.26,
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
  heroStatusRow: {
    marginTop: Spacing.md,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  heroStatusText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    lineHeight: 20,
  },
  heroProgressWrap: {
    marginTop: Spacing.sm,
  },
  heroProgressTrack: {
    height: 8,
    borderRadius: Radius.pill,
    overflow: "hidden",
    borderWidth: 1,
  },
  heroProgressFill: {
    height: "100%",
    borderRadius: Radius.pill,
  },
  heroProgressText: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    opacity: 0.9,
  },
  quickActionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  quickActionCard: {
    width: "48.4%",
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    minHeight: 120,
    shadowColor: "#000",
    ...Shadows.card,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  quickActionTitle: {
    marginTop: Spacing.sm,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  quickActionSubtitle: {
    marginTop: 2,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    shadowColor: "#000",
    ...Shadows.card,
  },
  cardTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  cardSubtitle: {
    marginTop: Spacing.xs,
    fontSize: FontSize.sm,
  },
  profileGrid: {
    marginTop: Spacing.md,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  profilePill: {
    width: "48.5%",
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  profilePillLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    opacity: 0.8,
  },
  profilePillValue: {
    marginTop: 2,
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  emptyWrap: {
    marginTop: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  inlineButton: {
    marginTop: Spacing.md,
    alignSelf: "flex-start",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  inlineButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  todayList: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  todayItem: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "center",
  },
  todayTimeWrap: {
    width: 74,
  },
  todayTime: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  todayTimeTo: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
  },
  todayMetaWrap: {
    flex: 1,
  },
  todayCourse: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  todayVenue: {
    marginTop: 2,
    fontSize: FontSize.xs,
  },
  metricsRow: {
    marginTop: Spacing.md,
    flexDirection: "row",
    gap: Spacing.sm,
  },
  metricBadge: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  metricValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  metricLabel: {
    marginTop: 2,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  courseList: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  courseItem: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
    flexDirection: "row",
    gap: Spacing.sm,
    alignItems: "center",
  },
  courseCode: {
    width: 78,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  courseBody: {
    flex: 1,
  },
  courseName: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  courseCredit: {
    marginTop: 2,
    fontSize: FontSize.xs,
  },
  postList: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  postItem: {
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.sm,
  },
  postTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  postBody: {
    marginTop: 4,
    fontSize: FontSize.sm,
    lineHeight: 19,
  },
  postDate: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
});
