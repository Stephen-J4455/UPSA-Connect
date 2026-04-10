import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Image,
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
  captureSnapshot,
  listSnapshotNotes,
  transcribeAndSaveSnapshot,
} from "@/lib/snapshot";
import { fetchHomeCourseCards } from "@/lib/academics";
import { fetchTimetable, getCurrentClass } from "@/lib/timetable";
import { useAuth } from "@/providers/auth-provider";

const OFFLINE_SNAPSHOT_QUEUE_KEY = "offline_snapshot_queue_v1";

type OfflineSnapshotTask = {
  uri: string;
  course: string;
  queuedAt: string;
};

const COURSE_PALETTE = [
  "#1D4ED8",
  "#0EA5E9",
  "#10B981",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
];

function toCardTone(hexColor: string) {
  const hex = hexColor.replace("#", "");
  if (hex.length !== 6) return "rgba(0, 51, 102, 0.09)";

  const red = parseInt(hex.slice(0, 2), 16);
  const green = parseInt(hex.slice(2, 4), 16);
  const blue = parseInt(hex.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, 0.15)`;
}

export default function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const mode = useColorScheme() === "dark" ? "dark" : "light";
  const theme = Colors[mode];

  const [course, setCourse] = useState("Principles of Marketing");
  const [queuedSnapshots, setQueuedSnapshots] = useState<OfflineSnapshotTask[]>([]);
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);

  const {
    data: timetable = [],
    dataUpdatedAt: timetableUpdatedAt,
  } = useQuery({
    queryKey: ["timetable"],
    queryFn: fetchTimetable,
  });

  const {
    data: notes = [],
    refetch: refetchNotes,
    dataUpdatedAt: notesUpdatedAt,
  } = useQuery({
    queryKey: ["snapshot-notes"],
    queryFn: listSnapshotNotes,
  });

  const { data: semesterCourses = [] } = useQuery({
    queryKey: ["home-course-cards"],
    queryFn: fetchHomeCourseCards,
  });

  useEffect(() => {
    loadQueuedSnapshots().catch(() => {
      // Queue loading failures should not block the Home screen.
    });
  }, []);

  const currentClass = useMemo(() => getCurrentClass(timetable), [timetable]);
  const today = new Date().getDay();
  const todayClassCount = timetable.filter(
    (entry) => entry.dayOfWeek === today,
  ).length;
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const nextSessionByCourse = useMemo(() => {
    const now = new Date();

    return timetable.reduce<
      Record<
        string,
        {
          startsAt: number;
          dayLabel: string;
          startTime: string;
          isOnline: boolean;
        }
      >
    >((acc, entry) => {
      if (!entry.courseCode) return acc;

      const [hour, minute] = entry.startTime.split(":").map(Number);
      if (Number.isNaN(hour) || Number.isNaN(minute)) return acc;

      const sessionDate = new Date(now);
      const dayDelta = entry.dayOfWeek - now.getDay();
      sessionDate.setDate(now.getDate() + dayDelta);
      sessionDate.setHours(hour, minute, 0, 0);
      if (sessionDate.getTime() <= now.getTime()) {
        sessionDate.setDate(sessionDate.getDate() + 7);
      }

      const existing = acc[entry.courseCode];
      const nextCandidate = {
        startsAt: sessionDate.getTime(),
        dayLabel: weekdayLabels[entry.dayOfWeek] ?? `Day ${entry.dayOfWeek}`,
        startTime: entry.startTime,
        isOnline: Boolean(entry.isOnline),
      };

      if (!existing || nextCandidate.startsAt < existing.startsAt) {
        acc[entry.courseCode] = nextCandidate;
      }

      return acc;
    }, {});
  }, [timetable]);

  const displayName =
    user?.user_metadata?.full_name ??
    user?.user_metadata?.name ??
    user?.email?.split("@")[0] ??
    "UPSA Student";
  const initials = displayName
    .split(/\s+/)
    .filter((part: string) => Boolean(part))
    .slice(0, 2)
    .map((part: string) => part[0]?.toUpperCase() ?? "")
    .join("");
  const firstName = displayName.split(/\s+/)[0] ?? "Student";

  const lastSyncedAt = Math.max(timetableUpdatedAt, notesUpdatedAt);
  const lastSyncedText =
    lastSyncedAt > 0
      ? new Date(lastSyncedAt).toLocaleString()
      : "No synced data yet";

  async function loadQueuedSnapshots() {
    const raw = await AsyncStorage.getItem(OFFLINE_SNAPSHOT_QUEUE_KEY);
    if (!raw) {
      setQueuedSnapshots([]);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as OfflineSnapshotTask[];
      if (Array.isArray(parsed)) {
        setQueuedSnapshots(parsed);
      } else {
        setQueuedSnapshots([]);
      }
    } catch {
      setQueuedSnapshots([]);
    }
  }

  async function persistQueue(nextQueue: OfflineSnapshotTask[]) {
    setQueuedSnapshots(nextQueue);
    await AsyncStorage.setItem(
      OFFLINE_SNAPSHOT_QUEUE_KEY,
      JSON.stringify(nextQueue),
    );
  }

  async function queueSnapshotForLater(uri: string, courseName: string) {
    const nextQueue = [
      ...queuedSnapshots,
      {
        uri,
        course: courseName,
        queuedAt: new Date().toISOString(),
      },
    ];
    await persistQueue(nextQueue);
  }

  async function syncQueuedSnapshots() {
    if (!queuedSnapshots.length) {
      Alert.alert("Offline Queue", "No queued snapshots to sync.");
      return;
    }

    setIsSyncingQueue(true);
    let successCount = 0;
    const failed: OfflineSnapshotTask[] = [];

    for (const task of queuedSnapshots) {
      try {
        await transcribeAndSaveSnapshot(task.uri, task.course);
        successCount += 1;
      } catch {
        failed.push(task);
      }
    }

    await persistQueue(failed);
    if (successCount > 0) {
      await refetchNotes();
    }
    setIsSyncingQueue(false);

    if (failed.length) {
      Alert.alert(
        "Partial sync",
        `${successCount} synced, ${failed.length} still queued for later.`,
      );
      return;
    }

    Alert.alert("Offline Queue", `Synced ${successCount} queued snapshots.`);
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
    >
      <View
        style={[
          styles.hero,
          {
            backgroundColor: theme.heroBackground,
            paddingTop: Math.max(insets.top + 8, 24),
            shadowColor: theme.shadow,
          },
        ]}
      >
        <View style={[styles.heroOrbTop, { backgroundColor: theme.heroOrbOne }]} />
        <View style={[styles.heroOrbBottom, { backgroundColor: theme.heroOrbTwo }]} />
        <Text style={[styles.welcomeText, { color: theme.icon }]}>Welcome Back</Text>
        <Text style={[styles.heroTitle, { color: theme.textOnHero }]}>{firstName}</Text>
        <View style={styles.profileRow}>
          <View style={[styles.initialsBadge, { backgroundColor: theme.accent }]}>
            <Text style={[styles.initialsText, { color: theme.accentText }]}>
              {initials || "US"}
            </Text>
          </View>
          <View style={styles.profileMeta}>
            <Text style={[styles.profileName, { color: theme.textOnHero }]}>
              {displayName}
            </Text>
            <Text style={[styles.profileEmail, { color: theme.textMuted }]}>
              {user?.email ?? "No email available"}
            </Text>
          </View>
        </View>
      </View>

      <View style={[styles.statsRow, styles.sectionSpacing]}>
        <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
          <View style={styles.inlineRow}>
            <Ionicons name="calendar-outline" size={16} color={theme.icon} />
            <Text style={[styles.statLabel, { color: theme.textSubtle }]}>Today</Text>
          </View>
          <Text style={[styles.statValue, { color: theme.tint }]}>{todayClassCount}</Text>
          <Text style={[styles.statCaption, { color: theme.textSubtle }]}>scheduled classes</Text>
        </View>

        <View style={[styles.statCard, { backgroundColor: theme.surface }]}>
          <View style={styles.inlineRow}>
            <Ionicons name="document-text-outline" size={16} color={theme.icon} />
            <Text style={[styles.statLabel, { color: theme.textSubtle }]}>Notes</Text>
          </View>
          <Text style={[styles.statValue, { color: theme.tint }]}>{notes.length}</Text>
          <Text style={[styles.statCaption, { color: theme.textSubtle }]}>saved snapshots</Text>
        </View>
      </View>

      <View style={styles.sectionSpacing}>
        <View style={[styles.spaceBetweenRow, { marginHorizontal: Spacing.lg }]}>
          <Text style={[styles.sectionTitle, { color: theme.tint }]}>My Courses</Text>
          <View style={[styles.courseCountPill, { backgroundColor: theme.surfaceMuted }]}> 
            <Text style={[styles.courseCountText, { color: theme.tint }]}> 
              {semesterCourses.length} courses
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={[styles.courseRail, { marginHorizontal: -Spacing.lg }]}
          contentContainerStyle={[styles.courseRailContent, { paddingHorizontal: Spacing.lg }]}
        >
          {semesterCourses.map((courseCard) => {
            const accent = courseCard.colorHex || COURSE_PALETTE[Number(courseCard.level) % COURSE_PALETTE.length] || theme.tint;
            const nextSession = nextSessionByCourse[courseCard.courseCode];

            return (
              <View
                key={courseCard.courseId}
                style={[
                  styles.courseCard,
                  {
                    borderColor: accent,
                    backgroundColor: accent,
                  },
                ]}
              >
                <View style={[styles.courseAccentBar, { backgroundColor: "#ffffff", opacity: 0.3 }]} />

                <View style={styles.spaceBetweenRow}>
                  <Text style={[styles.courseBadge, { backgroundColor: "#ffffff", color: accent }]}> 
                    {courseCard.courseCode}
                  </Text>
                  <Ionicons name="school-outline" size={20} color="#ffffff" />
                </View>

                <Text style={[styles.courseTitle, { color: "#ffffff" }]} numberOfLines={2}>
                  {courseCard.courseTitle}
                </Text>

                <Text style={[styles.courseDepartment, { color: "#ffffff", opacity: 0.8 }]}>
                  {courseCard.department} • Level {courseCard.level}
                </Text>

                <View style={styles.courseMetaRow}>
                  <View style={[styles.courseChip, { backgroundColor: "rgba(255,255,255,0.2)" }]}> 
                    <Text style={[styles.courseChipLabel, { color: "#ffffff" }]}>Credits</Text>
                    <Text style={[styles.courseChipValue, { color: "#ffffff" }]}>{courseCard.credits}</Text>
                  </View>
                  <View style={[styles.courseChip, { backgroundColor: "rgba(255,255,255,0.2)" }]}> 
                    <Text style={[styles.courseChipLabel, { color: "#ffffff" }]}>Weekly</Text>
                    <Text style={[styles.courseChipValue, { color: "#ffffff" }]}>
                      {courseCard.sessionsPerWeek}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.courseMeta, { color: "#ffffff", opacity: 0.8 }]}>
                  {courseCard.semesterName} • {courseCard.academicYearLabel}
                </Text>
                <Text style={[styles.courseMeta, { color: "#ffffff", opacity: 0.8 }]}>
                  {courseCard.lecturerName || "Lecturer TBA"}
                </Text>

                <View style={[styles.courseNextClass, { borderTopColor: "rgba(255,255,255,0.3)" }]}> 
                  <Ionicons
                    name={nextSession?.isOnline ? "videocam-outline" : "time-outline"}
                    size={14}
                    color="#ffffff"
                  />
                  <Text style={[styles.courseMetaTiny, styles.courseNextClassText, { color: "#ffffff", opacity: 0.8 }]}> 
                    {nextSession
                      ? `Next: ${nextSession.dayLabel} ${nextSession.startTime}${nextSession.isOnline ? " (online)" : ""}`
                      : `Class window: ${courseCard.firstClassTime || "--:--"} - ${courseCard.lastClassTime || "--:--"}`}
                  </Text>
                </View>
              </View>
            );
          })}
          {!semesterCourses.length ? (
            <View
              style={[
                styles.courseCard,
                { borderColor: theme.border, backgroundColor: theme.surfaceMuted },
              ]}
            >
              <Ionicons name="school-outline" size={32} color={theme.textMuted} style={{ alignSelf: 'center', marginBottom: Spacing.sm }} />
              <Text style={[styles.courseTitle, { color: theme.text }]}>No courses yet</Text>
              <Text style={[styles.courseMeta, { color: theme.textMuted }]}> 
                Seed or sync your Supabase academic data to populate this section.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </View>

      <View
        style={[
          styles.card,
          styles.sectionSpacing,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.spaceBetweenRow}>
          <Text style={[styles.cardTitle, { color: theme.tint }]}>Offline Ready</Text>
          <View style={[styles.statusPill, { backgroundColor: theme.statusIdleBg }]}> 
            <Text style={[styles.statusText, { color: theme.statusIdleText }]}>CACHE</Text>
          </View>
        </View>

        <Text style={[styles.cardDescription, { color: theme.textMuted }]}> 
          Last synced: {lastSyncedText}
        </Text>
        <Text style={[styles.cardDescription, { color: theme.textMuted }]}> 
          Queued snapshots: {queuedSnapshots.length}
        </Text>

        <Pressable
          style={({ pressed }) => [
            styles.captureButton,
            { backgroundColor: pressed ? theme.tintPressed : theme.tint },
          ]}
          onPress={syncQueuedSnapshots}
          disabled={isSyncingQueue}
        >
          <Text style={[styles.captureButtonText, { color: theme.accent }]}> 
            {isSyncingQueue ? "Syncing..." : "Sync Offline Queue"}
          </Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.card,
          styles.sectionSpacing,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <View style={styles.spaceBetweenRow}>
          <Text style={[styles.cardTitle, { color: theme.tint }]}>Class Status</Text>
          <View
            style={[
              styles.statusPill,
              {
                backgroundColor: currentClass
                  ? theme.statusLiveBg
                  : theme.statusIdleBg,
              },
            ]}
          >
            <Text
              style={[
                styles.statusText,
                {
                  color: currentClass
                    ? theme.statusLiveText
                    : theme.statusIdleText,
                },
              ]}
            >
              {currentClass ? "LIVE" : "IDLE"}
            </Text>
          </View>
        </View>

        {currentClass ? (
          <View style={styles.classBody}>
            <Text style={[styles.classTitle, { color: theme.text }]}> 
              {currentClass.course}
            </Text>
            <Text style={[styles.classMeta, { color: theme.textMuted }]}> 
              Venue: {currentClass.venue}
            </Text>
            <View style={[styles.progressTrack, { backgroundColor: theme.border }]}> 
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.max(currentClass.progress * 100, 3)}%`,
                    backgroundColor: theme.accent,
                  },
                ]}
              />
            </View>
            <Text style={[styles.progressText, { color: theme.accent }]}> 
              {currentClass.remainingMinutes} mins remaining
            </Text>
          </View>
        ) : (
          <Text style={[styles.idleText, { color: theme.textMuted }]}> 
            No lecture in session now. Your next class will appear here automatically.
          </Text>
        )}
      </View>

      <View
        style={[
          styles.card,
          styles.sectionSpacing,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.tint }]}>Snapshot Studio</Text>
        <Text style={[styles.cardDescription, { color: theme.textMuted }]}> 
          Capture now. If you are offline, the snapshot is queued and auto-syncs later.
        </Text>

        <TextInput
          style={[
            styles.input,
            {
              borderColor: theme.borderStrong,
              backgroundColor: theme.surfaceMuted,
              color: theme.text,
            },
          ]}
          value={course}
          onChangeText={setCourse}
          placeholder="Course name"
          placeholderTextColor={theme.textSubtle}
        />

        <Pressable
          style={({ pressed }) => [
            styles.captureButton,
            { backgroundColor: pressed ? theme.tintPressed : theme.tint },
          ]}
          onPress={async () => {
            try {
              const uri = await captureSnapshot();
              if (!uri) return;

              try {
                await transcribeAndSaveSnapshot(uri, course.trim() || "General Course");
                await refetchNotes();
                Alert.alert("Saved", "Snapshot note has been transcribed and saved.");
              } catch {
                await queueSnapshotForLater(uri, course.trim() || "General Course");
                Alert.alert(
                  "Saved Offline",
                  "No connection detected. Snapshot was queued and will sync later.",
                );
              }
            } catch (error) {
              Alert.alert(
                "Snapshot Error",
                error instanceof Error
                  ? error.message
                  : "Could not process snapshot.",
              );
            }
          }}
        >
          <Text style={[styles.captureButtonText, { color: theme.accent }]}>Capture and Save</Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.card,
          styles.sectionSpacing,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: theme.tint }]}>Latest Snapshot Notes</Text>
        <View style={styles.notesList}>
          {notes.slice(0, 3).map((note) => (
            <View
              key={note.id}
              style={[
                styles.noteCard,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.surfaceMuted,
                },
              ]}
            >
              <Text style={[styles.noteCourse, { color: theme.textSubtle }]}> 
                {note.course}
              </Text>
              <Text style={[styles.noteText, { color: theme.text }]}> 
                {note.text}
              </Text>
            </View>
          ))}
          {!notes.length ? (
            <Text style={[styles.emptyState, { color: theme.textMuted }]}>No notes yet.</Text>
          ) : null}
        </View>
      </View>
    </ScrollView>
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
  hero: {
    marginHorizontal: -Spacing.lg,
    overflow: "hidden",
    borderBottomLeftRadius: Radius.xxl,
    borderBottomRightRadius: Radius.xxl,
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xxl,
    ...Shadows.card,
  },
  heroOrbTop: {
    position: "absolute",
    right: -20,
    top: -20,
    width: 112,
    height: 112,
    borderRadius: 56,
  },
  heroOrbBottom: {
    position: "absolute",
    left: -32,
    bottom: -32,
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  welcomeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  heroTitle: {
    marginTop: Spacing.sm,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
  },
  profileRow: {
    marginTop: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
  },
  initialsBadge: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  initialsText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
  },
  profileMeta: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  profileName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  profileEmail: {
    marginTop: 2,
    fontSize: FontSize.sm,
  },
  statsRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  inlineRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  statLabel: {
    marginLeft: Spacing.sm,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: {
    marginTop: Spacing.sm,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
  },
  statCaption: {
    fontSize: FontSize.xs,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  cardTitle: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.semibold,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  cardDescription: {
    marginTop: Spacing.xs,
    fontSize: FontSize.sm,
  },
  spaceBetweenRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusPill: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  classBody: {
    marginTop: Spacing.md,
  },
  classTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  classMeta: {
    marginTop: Spacing.xs,
    fontSize: FontSize.sm,
  },
  progressTrack: {
    marginTop: Spacing.md,
    height: 8,
    borderRadius: Radius.pill,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: Radius.pill,
  },
  progressText: {
    marginTop: Spacing.sm,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  idleText: {
    marginTop: Spacing.md,
    fontSize: FontSize.sm,
  },
  input: {
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
  },
  captureButton: {
    marginTop: Spacing.md,
    alignSelf: "flex-start",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  captureButtonText: {
    fontWeight: FontWeight.semibold,
  },
  notesList: {
    marginTop: Spacing.md,
  },
  courseRail: {
    marginTop: Spacing.md,
  },
  courseRailContent: {
    paddingRight: Spacing.sm,
    gap: Spacing.md,
  },
  courseSectionRoot: {
    marginHorizontal: -Spacing.xs,
  },
  courseHeadingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  expoMark: {
    width: 24,
    height: 24,
    borderRadius: 8,
  },
  courseCountPill: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    minWidth: 36,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 5,
  },
  courseCountText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  courseCard: {
    width: 285,
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    overflow: "hidden",
  },
  courseAccentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    right: 0,
    height: 5,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
  },
  courseBadge: {
    borderRadius: Radius.pill,
    overflow: "hidden",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
  },
  courseTitle: {
    marginTop: Spacing.sm,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    lineHeight: 21,
  },
  courseDepartment: {
    marginTop: 3,
    fontSize: FontSize.sm,
  },
  courseMetaRow: {
    marginTop: Spacing.sm,
    flexDirection: "row",
    gap: Spacing.sm,
  },
  courseChip: {
    flex: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 7,
  },
  courseChipLabel: {
    fontSize: 11,
    textTransform: "uppercase",
    fontWeight: FontWeight.semibold,
  },
  courseChipValue: {
    marginTop: 2,
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  courseMeta: {
    marginTop: 5,
    fontSize: FontSize.sm,
  },
  courseNextClass: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "center",
  },
  courseNextClassText: {
    marginTop: 0,
    marginLeft: 6,
    flex: 1,
  },
  courseMetaTiny: {
    marginTop: 6,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  noteCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  noteCourse: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  noteText: {
    marginTop: Spacing.xs,
    fontSize: FontSize.sm,
  },
  emptyState: {
    fontSize: FontSize.sm,
  },
});
