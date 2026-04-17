import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import {
  Pressable,
  SectionList,
  StyleSheet,
  Text,
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
  ensureNotificationPermissions,
  scheduleLectureReminder,
} from "@/lib/notifications";
import { fetchTimetable, getNextClass } from "@/lib/timetable";
import type { TimetableEntry } from "@/types/models";

const WEEKDAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

type DaySection = {
  key: string;
  dayOfWeek: number;
  title: string;
  data: TimetableEntry[];
};

function formatDayTitle(dayOfWeek: number) {
  return WEEKDAY_LABELS[dayOfWeek] ?? `Day ${dayOfWeek}`;
}

export default function TimetableScreen() {
  const mode = useColorScheme() === "dark" ? "dark" : "light";
  const theme = Colors[mode];
  const insets = useSafeAreaInsets();

  const { data: timetable = [] } = useQuery({
    queryKey: ["timetable"],
    queryFn: fetchTimetable,
  });

  const nextClass = useMemo(() => getNextClass(timetable), [timetable]);

  useEffect(() => {
    if (!nextClass) return;

    ensureNotificationPermissions().then((granted) => {
      if (!granted) return;
      scheduleLectureReminder(nextClass.entry).catch(() => {
        // No-op: reminder scheduling failures should not block timetable rendering.
      });
    });
  }, [nextClass]);

  const semesterLabel = timetable[0]?.semesterName;
  const academicYearLabel = timetable[0]?.academicYear;

  const sections = useMemo<DaySection[]>(() => {
    const map = new Map<number, TimetableEntry[]>();

    for (const entry of timetable) {
      const existing = map.get(entry.dayOfWeek) ?? [];
      existing.push(entry);
      map.set(entry.dayOfWeek, existing);
    }

    return [...map.entries()]
      .sort(([a], [b]) => a - b)
      .map(([dayOfWeek, entries]) => ({
        key: String(dayOfWeek),
        dayOfWeek,
        title: formatDayTitle(dayOfWeek),
        data: entries.sort((a, b) => a.startTime.localeCompare(b.startTime)),
      }));
  }, [timetable]);

  const nextClassText = nextClass
    ? `${formatDayTitle(nextClass.entry.dayOfWeek)} • ${nextClass.entry.startTime} - ${nextClass.entry.endTime}`
    : "No upcoming lecture found";

  const scheduleNextReminder = async () => {
    const upcoming = getNextClass(timetable);
    if (!upcoming) return;
    const granted = await ensureNotificationPermissions();
    if (!granted) return;
    await scheduleLectureReminder(upcoming.entry);
  };

  return (
    <SectionList
      style={[styles.screen, { backgroundColor: theme.background }]}
      sections={sections}
      keyExtractor={(item) => item.id}
      stickySectionHeadersEnabled={false}
      showsVerticalScrollIndicator={false}
      bounces={false}
      alwaysBounceVertical={false}
      overScrollMode="never"
      contentContainerStyle={{ paddingBottom: 130 }}
      ListHeaderComponent={
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
          <Text style={[styles.heroTitle, { color: theme.textOnHero }]}>Timetable</Text>
          <Text style={[styles.heroSubtitle, { color: theme.textMuted }]}>Next class: {nextClassText}</Text>

          <View style={styles.heroRow}>
            {semesterLabel ? (
              <View
                style={[
                  styles.heroPill,
                  { borderColor: theme.borderStrong, backgroundColor: theme.surfaceGlass },
                ]}
              >
                <Ionicons name="school-outline" size={14} color={theme.accent} />
                <Text style={[styles.heroPillText, { color: theme.textOnHero }]}>
                  {semesterLabel}
                  {academicYearLabel ? ` • ${academicYearLabel}` : ""}
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.heroPill,
                  { borderColor: theme.borderStrong, backgroundColor: theme.surfaceGlass },
                ]}
              >
                <Ionicons name="cloud-offline-outline" size={14} color={theme.accent} />
                <Text style={[styles.heroPillText, { color: theme.textOnHero }]}>Offline-ready schedule</Text>
              </View>
            )}

            <Pressable
              onPress={scheduleNextReminder}
              style={({ pressed }) => [
                styles.heroButton,
                { backgroundColor: pressed ? theme.ctaPressed : theme.cta },
              ]}
            >
              <Ionicons name="notifications-outline" size={16} color={theme.ctaText} />
              <Text style={[styles.heroButtonText, { color: theme.ctaText }]}>Reminder</Text>
            </Pressable>
          </View>
        </View>
      }
      renderSectionHeader={({ section }) => (
        <View style={styles.sectionHeaderWrap}>
          <View style={styles.sectionHeaderInner}>
            <Text style={[styles.sectionHeaderText, { color: theme.tint }]}>{section.title}</Text>
            <Text style={[styles.sectionHeaderCount, { color: theme.textSubtle }]}>
              {section.data.length} class{section.data.length === 1 ? "" : "es"}
            </Text>
          </View>
        </View>
      )}
      renderItem={({ item }) => {
        const accent = item.colorHex?.trim() || theme.tint;

        return (
          <View style={styles.itemWrap}>
            <View
              style={[
                styles.itemCard,
                {
                  borderColor: theme.border,
                  backgroundColor: theme.surface,
                  shadowColor: theme.shadow,
                  ...Shadows.card,
                },
              ]}
            >
              <View style={[styles.colorBar, { backgroundColor: accent }]} />

              <View style={styles.itemBody}>
                <View style={styles.topRow}>
                  <View
                    style={[
                      styles.courseCodePill,
                      { borderColor: theme.borderStrong, backgroundColor: theme.surfaceMuted },
                    ]}
                  >
                    <Text style={[styles.courseCodeText, { color: theme.tint }]}>
                      {item.courseCode?.trim() || "COURSE"}
                    </Text>
                  </View>

                  <Text style={[styles.classTypeText, { color: theme.textSubtle }]}>
                    {item.classType || (item.isOnline ? "Online" : "In-person")}
                  </Text>
                </View>

                <Text style={[styles.courseTitle, { color: theme.text }]} numberOfLines={2}>
                  {item.course}
                </Text>

                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={14} color={theme.icon} />
                  <Text style={[styles.metaText, { color: theme.textMuted }]}>
                    {item.startTime} - {item.endTime}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={14} color={theme.icon} />
                  <Text style={[styles.metaText, { color: theme.textMuted }]} numberOfLines={1}>
                    {item.venue}
                    {item.campus ? ` • ${item.campus}` : ""}
                  </Text>
                </View>

                {item.lecturer ? (
                  <View style={styles.metaRow}>
                    <Ionicons name="person-outline" size={14} color={theme.icon} />
                    <Text style={[styles.metaText, { color: theme.textMuted }]} numberOfLines={1}>
                      {item.lecturer}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        );
      }}
      ListFooterComponent={
        <View style={styles.footerWrap}>
          <Pressable
            style={({ pressed }) => [
              styles.reminderButton,
              { backgroundColor: pressed ? theme.tintPressed : theme.tint },
            ]}
            onPress={scheduleNextReminder}
          >
            <Ionicons name="notifications-outline" size={18} color={theme.accent} />
            <Text style={[styles.reminderButtonText, { color: theme.accent }]}>Schedule 15-min Reminder</Text>
          </Pressable>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No timetable entries</Text>
          <Text style={[styles.emptyBody, { color: theme.textMuted }]}>Once admin publishes your schedule, it will appear here and cache for offline use.</Text>
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  hero: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.xl,
    borderBottomLeftRadius: Radius.xxl,
    borderBottomRightRadius: Radius.xxl,
    overflow: "hidden",
  },
  heroOrbOne: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 99,
    right: -50,
    top: -40,
    opacity: 0.32,
  },
  heroOrbTwo: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 99,
    left: -56,
    bottom: -54,
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
  },
  heroPillText: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  heroButton: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  heroButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.bold,
  },
  sectionHeaderWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  sectionHeaderInner: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  sectionHeaderText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  sectionHeaderCount: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  itemWrap: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    overflow: "hidden",
    flexDirection: "row",
  },
  colorBar: {
    width: 6,
  },
  itemBody: {
    flex: 1,
    padding: Spacing.lg,
    gap: 6,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.sm,
  },
  courseCodePill: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
  },
  courseCodeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.4,
  },
  classTypeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  courseTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  metaText: {
    flex: 1,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  footerWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  reminderButton: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  reminderButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  emptyWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  emptyBody: {
    marginTop: Spacing.xs,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
});
