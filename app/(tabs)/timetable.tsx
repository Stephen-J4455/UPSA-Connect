import { useEffect } from "react";
import { FlatList, Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";

import { useQuery } from "@tanstack/react-query";

import { Colors, FontSize, FontWeight, Radius, Spacing } from "@/constants/theme";
import {
  ensureNotificationPermissions,
  scheduleLectureReminder,
} from "@/lib/notifications";
import { fetchTimetable, getNextClass } from "@/lib/timetable";

export default function TimetableScreen() {
  const mode = useColorScheme() === "dark" ? "dark" : "light";
  const theme = Colors[mode];
  const { data: timetable = [] } = useQuery({
    queryKey: ["timetable"],
    queryFn: fetchTimetable,
  });

  useEffect(() => {
    const nextClass = getNextClass(timetable);
    if (!nextClass) return;

    ensureNotificationPermissions().then((granted) => {
      if (!granted) return;
      scheduleLectureReminder(nextClass.entry).catch(() => {
        // No-op: reminder scheduling failures should not block timetable rendering.
      });
    });
  }, [timetable]);

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <Text style={[styles.title, { color: theme.tint }]}> 
        Timetable
      </Text>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}> 
        Works offline with cached data from React Query + AsyncStorage.
      </Text>

      <FlatList
        style={styles.list}
        data={timetable}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 120 }}
        renderItem={({ item }) => (
          <View
            style={[
              styles.itemCard,
              { borderColor: theme.border, backgroundColor: theme.surface },
            ]}
          >
            <Text style={[styles.courseText, { color: theme.text }]}> 
              {item.course}
            </Text>
            <Text style={[styles.metaText, { color: theme.textMuted }]}> 
              {item.venue}
            </Text>
            <Text style={[styles.metaText, { color: theme.textMuted }]}> 
              {item.startTime} - {item.endTime}
            </Text>
            <Text style={[styles.dayText, { color: theme.textSubtle }]}> 
              Day {item.dayOfWeek}
            </Text>
          </View>
        )}
        ListFooterComponent={
          <Pressable
            style={({ pressed }) => [
              styles.reminderButton,
              { backgroundColor: pressed ? theme.tintPressed : theme.tint },
            ]}
            onPress={async () => {
              const nextClass = getNextClass(timetable);
              if (!nextClass) return;
              const granted = await ensureNotificationPermissions();
              if (!granted) return;
              await scheduleLectureReminder(nextClass.entry);
            }}
          >
            <Text style={[styles.reminderButtonText, { color: theme.accent }]}> 
              Schedule 15-min Reminder
            </Text>
          </Pressable>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    marginTop: Spacing.xs,
    fontSize: FontSize.sm,
  },
  list: {
    marginTop: Spacing.lg,
  },
  itemCard: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  courseText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  metaText: {
    marginTop: Spacing.xs,
    fontSize: FontSize.sm,
  },
  dayText: {
    marginTop: Spacing.xs,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: "uppercase",
  },
  reminderButton: {
    marginTop: Spacing.md,
    alignSelf: "flex-start",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  reminderButtonText: {
    fontWeight: FontWeight.semibold,
  },
});
