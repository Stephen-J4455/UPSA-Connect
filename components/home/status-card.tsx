import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { Colors, FontSize, FontWeight, Radius, Spacing } from "@/constants/theme";

type ClassStatusCardProps = {
  theme: (typeof Colors)["light"];
  currentClass?: {
    course: string;
    venue: string;
    progress: number;
    remainingMinutes: number;
  };
};

export function ClassStatusCard({ theme, currentClass }: ClassStatusCardProps) {
  const isLive = Boolean(currentClass);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.surface,
          borderColor: isLive ? theme.statusLiveText : theme.border,
          borderWidth: isLive ? 1.5 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons
            name={isLive ? "radio" : "time-outline"}
            size={20}
            color={isLive ? theme.statusLiveText : theme.icon}
          />
          <Text style={[styles.title, { color: theme.text }]}>Class Status</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: isLive ? theme.statusLiveBg : theme.statusIdleBg,
            },
          ]}
        >
          {isLive && <View style={[styles.liveDot, { backgroundColor: theme.statusLiveText }]} />}
          <Text
            style={[
              styles.statusText,
              { color: isLive ? theme.statusLiveText : theme.statusIdleText },
            ]}
          >
            {isLive ? "LIVE" : "IDLE"}
          </Text>
        </View>
      </View>

      {currentClass ? (
        <View style={styles.liveContent}>
          <Text style={[styles.className, { color: theme.text }]}>
            {currentClass.course}
          </Text>
          <View style={styles.venueRow}>
            <Ionicons name="location-outline" size={14} color={theme.textMuted} />
            <Text style={[styles.venueText, { color: theme.textMuted }]}>
              {currentClass.venue}
            </Text>
          </View>

          <View style={styles.progressSection}>
            <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.max(currentClass.progress * 100, 5)}%`,
                    backgroundColor: theme.statusLiveText,
                  },
                ]}
              />
            </View>
            <View style={styles.progressInfo}>
              <Text style={[styles.progressLabel, { color: theme.textMuted }]}>
                {Math.round(currentClass.progress * 100)}% complete
              </Text>
              <Text style={[styles.timeRemaining, { color: theme.statusLiveText }]}>
                {currentClass.remainingMinutes} min left
              </Text>
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.idleContent}>
          <View style={[styles.idleIconContainer, { backgroundColor: theme.surfaceMuted }]}>
            <Ionicons name="cafe-outline" size={24} color={theme.textMuted} />
          </View>
          <Text style={[styles.idleTitle, { color: theme.text }]}>
            No class in session
          </Text>
          <Text style={[styles.idleText, { color: theme.textMuted }]}>
            Your next class will appear here automatically when it starts.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.xl,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    gap: 6,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.bold,
    letterSpacing: 0.5,
  },
  liveContent: {
    marginTop: Spacing.xs,
  },
  className: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  venueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: Spacing.md,
  },
  venueText: {
    fontSize: FontSize.sm,
  },
  progressSection: {
    gap: Spacing.sm,
  },
  progressTrack: {
    height: 8,
    borderRadius: Radius.pill,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: Radius.pill,
  },
  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  progressLabel: {
    fontSize: FontSize.xs,
  },
  timeRemaining: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
  },
  idleContent: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  idleIconContainer: {
    width: 56,
    height: 56,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  idleTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  idleText: {
    fontSize: FontSize.sm,
    textAlign: "center",
    lineHeight: 20,
  },
});
