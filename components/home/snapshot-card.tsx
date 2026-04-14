import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { Colors, FontSize, FontWeight, Radius, Spacing } from "@/constants/theme";

type SnapshotCardProps = {
  theme: (typeof Colors)["light"];
  course: string;
  onCourseChange: (value: string) => void;
  onCapture: () => void;
  queuedCount: number;
  isSyncing: boolean;
  onSyncQueue: () => void;
  lastSyncedText: string;
};

export function SnapshotCard({
  theme,
  course,
  onCourseChange,
  onCapture,
  queuedCount,
  isSyncing,
  onSyncQueue,
  lastSyncedText,
}: SnapshotCardProps) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.iconContainer, { backgroundColor: `${theme.tint}15` }]}>
            <Ionicons name="camera-outline" size={20} color={theme.tint} />
          </View>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Snapshot Studio</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Capture and transcribe notes
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.inputSection}>
        <Text style={[styles.inputLabel, { color: theme.textSubtle }]}>Course Name</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: theme.surfaceMuted,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
          value={course}
          onChangeText={onCourseChange}
          placeholder="e.g., Principles of Marketing"
          placeholderTextColor={theme.textSubtle}
        />
      </View>

      <Pressable
        style={({ pressed }) => [
          styles.captureButton,
          {
            backgroundColor: pressed ? theme.tintPressed : theme.tint,
          },
        ]}
        onPress={onCapture}
      >
        <Ionicons name="scan" size={20} color={theme.accent} />
        <Text style={[styles.captureButtonText, { color: theme.accent }]}>
          Capture and Save
        </Text>
      </Pressable>

      <View style={[styles.offlineSection, { backgroundColor: theme.surfaceMuted }]}>
        <View style={styles.offlineHeader}>
          <Ionicons name="cloud-offline-outline" size={16} color={theme.icon} />
          <Text style={[styles.offlineTitle, { color: theme.text }]}>Offline Queue</Text>
          {queuedCount > 0 && (
            <View style={[styles.queueBadge, { backgroundColor: theme.accent }]}>
              <Text style={[styles.queueBadgeText, { color: theme.accentText }]}>
                {queuedCount}
              </Text>
            </View>
          )}
        </View>

        <Text style={[styles.syncText, { color: theme.textMuted }]}>
          Last synced: {lastSyncedText}
        </Text>

        {queuedCount > 0 && (
          <Pressable
            style={({ pressed }) => [
              styles.syncButton,
              {
                backgroundColor: theme.surface,
                borderColor: theme.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
            onPress={onSyncQueue}
            disabled={isSyncing}
          >
            <Ionicons
              name={isSyncing ? "sync" : "cloud-upload-outline"}
              size={16}
              color={theme.tint}
            />
            <Text style={[styles.syncButtonText, { color: theme.tint }]}>
              {isSyncing ? "Syncing..." : "Sync Now"}
            </Text>
          </Pressable>
        )}
      </View>
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
    marginBottom: Spacing.lg,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  subtitle: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  inputSection: {
    marginBottom: Spacing.md,
  },
  inputLabel: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  input: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.sm,
  },
  captureButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
  },
  captureButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
  offlineSection: {
    borderRadius: Radius.md,
    padding: Spacing.md,
  },
  offlineHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  offlineTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    flex: 1,
  },
  queueBadge: {
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  queueBadgeText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },
  syncText: {
    fontSize: FontSize.xs,
    marginBottom: Spacing.sm,
  },
  syncButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.sm,
  },
  syncButtonText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
});
