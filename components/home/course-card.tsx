import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Colors, FontSize, FontWeight, Radius, Spacing } from "@/constants/theme";

type CourseCardProps = {
  theme: (typeof Colors)["light"];
  courseCode: string;
  courseTitle: string;
  department: string;
  level: string;
  credits: number;
  sessionsPerWeek: number;
  semesterName: string;
  academicYearLabel: string;
  lecturerName?: string;
  accentColor: string;
  nextSession?: {
    dayLabel: string;
    startTime: string;
    isOnline: boolean;
  };
  onPress?: () => void;
};

export function CourseCard({
  theme,
  courseCode,
  courseTitle,
  department,
  level,
  credits,
  sessionsPerWeek,
  semesterName,
  academicYearLabel,
  lecturerName,
  accentColor,
  nextSession,
  onPress,
}: CourseCardProps) {
  // Generate gradient colors from accent
  const gradientStart = accentColor;
  const gradientEnd = adjustColorBrightness(accentColor, -20);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          opacity: pressed ? 0.95 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
      ]}
      onPress={onPress}
    >
      <LinearGradient
        colors={[gradientStart, gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.cardOverlay} />

      <View style={styles.cardHeader}>
        <View style={styles.badgeContainer}>
          <Text style={styles.badge}>{courseCode}</Text>
        </View>
        <View style={styles.iconContainer}>
          <Ionicons name="school-outline" size={20} color="rgba(255,255,255,0.9)" />
        </View>
      </View>

      <Text style={styles.title} numberOfLines={2}>
        {courseTitle}
      </Text>

      <Text style={styles.subtitle}>
        {department} | Level {level}
      </Text>

      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Credits</Text>
          <Text style={styles.metricValue}>{credits}</Text>
        </View>
        <View style={styles.metricDivider} />
        <View style={styles.metricItem}>
          <Text style={styles.metricLabel}>Weekly</Text>
          <Text style={styles.metricValue}>{sessionsPerWeek}</Text>
        </View>
      </View>

      <View style={styles.infoSection}>
        <View style={styles.infoRow}>
          <Ionicons name="person-outline" size={14} color="rgba(255,255,255,0.7)" />
          <Text style={styles.infoText} numberOfLines={1}>
            {lecturerName || "Lecturer TBA"}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="book-outline" size={14} color="rgba(255,255,255,0.7)" />
          <Text style={styles.infoText}>
            {semesterName} | {academicYearLabel}
          </Text>
        </View>
      </View>

      <View style={styles.nextClassContainer}>
        <Ionicons
          name={nextSession?.isOnline ? "videocam" : "time"}
          size={14}
          color="rgba(255,255,255,0.9)"
        />
        <Text style={styles.nextClassText}>
          {nextSession
            ? `Next: ${nextSession.dayLabel} ${nextSession.startTime}${nextSession.isOnline ? " (Online)" : ""}`
            : "No upcoming session"}
        </Text>
      </View>
    </Pressable>
  );
}

type EmptyCourseCardProps = {
  theme: (typeof Colors)["light"];
};

export function EmptyCourseCard({ theme }: EmptyCourseCardProps) {
  return (
    <View
      style={[
        styles.card,
        styles.emptyCard,
        { backgroundColor: theme.surfaceMuted, borderColor: theme.border },
      ]}
    >
      <Ionicons
        name="school-outline"
        size={40}
        color={theme.textMuted}
        style={styles.emptyIcon}
      />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        No courses yet
      </Text>
      <Text style={[styles.emptySubtitle, { color: theme.textMuted }]}>
        Your enrolled courses will appear here once synced.
      </Text>
    </View>
  );
}

function adjustColorBrightness(hex: string, percent: number): string {
  const cleanHex = hex.replace("#", "");
  if (cleanHex.length !== 6) return hex;

  const num = parseInt(cleanHex, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + percent));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + percent));
  const b = Math.min(255, Math.max(0, (num & 0x0000ff) + percent));

  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

const styles = StyleSheet.create({
  card: {
    width: 280,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    overflow: "hidden",
  },
  cardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  emptyCard: {
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 240,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  badgeContainer: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
  },
  badge: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    color: "#1a1a1a",
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: Radius.md,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    color: "#ffffff",
    marginBottom: 4,
    lineHeight: 24,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: "rgba(255,255,255,0.8)",
    marginBottom: Spacing.md,
  },
  metricsRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  metricItem: {
    flex: 1,
    alignItems: "center",
  },
  metricDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginVertical: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: FontWeight.medium,
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    color: "#ffffff",
  },
  infoSection: {
    marginBottom: Spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  infoText: {
    fontSize: FontSize.sm,
    color: "rgba(255,255,255,0.8)",
    marginLeft: Spacing.xs,
    flex: 1,
  },
  nextClassContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  nextClassText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    color: "rgba(255,255,255,0.95)",
    marginLeft: Spacing.xs,
  },
  emptyIcon: {
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    textAlign: "center",
    paddingHorizontal: Spacing.lg,
  },
});
