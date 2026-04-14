import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Colors,
  FontSize,
  FontWeight,
  Radius,
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

import {
  HeroSection,
  QuickActions,
  CourseCard,
  EmptyCourseCard,
  ClassStatusCard,
  SnapshotCard,
  NotesPreview,
} from "@/components/home";

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

  async function handleCaptureSnapshot() {
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
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero Section */}
      <HeroSection
        theme={theme}
        displayName={displayName}
        initials={initials}
        firstName={firstName}
        email={user?.email ?? "No email available"}
        paddingTop={Math.max(insets.top + 8, 24)}
        todayClassCount={todayClassCount}
        notesCount={notes.length}
      />

      {/* Quick Actions */}
      <View style={styles.section}>
        <QuickActions
          theme={theme}
          onScanNotes={handleCaptureSnapshot}
        />
      </View>

      {/* My Courses Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Ionicons name="library-outline" size={20} color={theme.tint} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              My Courses
            </Text>
          </View>
          <View style={[styles.countBadge, { backgroundColor: theme.surfaceMuted }]}>
            <Text style={[styles.countText, { color: theme.tint }]}>
              {semesterCourses.length}
            </Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.courseRail}
          contentContainerStyle={styles.courseRailContent}
        >
          {semesterCourses.length > 0 ? (
            semesterCourses.map((courseCard) => {
              const accent =
                courseCard.colorHex ||
                COURSE_PALETTE[Number(courseCard.level) % COURSE_PALETTE.length] ||
                theme.tint;
              const nextSession = nextSessionByCourse[courseCard.courseCode];

              return (
                <CourseCard
                  key={courseCard.courseId}
                  theme={theme}
                  courseCode={courseCard.courseCode}
                  courseTitle={courseCard.courseTitle}
                  department={courseCard.department}
                  level={courseCard.level}
                  credits={courseCard.credits}
                  sessionsPerWeek={courseCard.sessionsPerWeek}
                  semesterName={courseCard.semesterName}
                  academicYearLabel={courseCard.academicYearLabel}
                  lecturerName={courseCard.lecturerName}
                  accentColor={accent}
                  nextSession={nextSession}
                />
              );
            })
          ) : (
            <EmptyCourseCard theme={theme} />
          )}
        </ScrollView>
      </View>

      {/* Class Status */}
      <View style={styles.section}>
        <ClassStatusCard theme={theme} currentClass={currentClass} />
      </View>

      {/* Snapshot Studio */}
      <View style={styles.section}>
        <SnapshotCard
          theme={theme}
          course={course}
          onCourseChange={setCourse}
          onCapture={handleCaptureSnapshot}
          queuedCount={queuedSnapshots.length}
          isSyncing={isSyncingQueue}
          onSyncQueue={syncQueuedSnapshots}
          lastSyncedText={lastSyncedText}
        />
      </View>

      {/* Recent Notes */}
      <View style={styles.section}>
        <NotesPreview theme={theme} notes={notes} />
      </View>

      {/* Bottom Spacing */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 20,
  },
  section: {
    marginTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
  },
  countBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    minWidth: 32,
    alignItems: "center",
  },
  countText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  courseRail: {
    marginHorizontal: -Spacing.lg,
  },
  courseRailContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
});
