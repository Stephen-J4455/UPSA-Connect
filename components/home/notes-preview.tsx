import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, FontSize, FontWeight, Radius, Spacing } from "@/constants/theme";

type Note = {
  id: string;
  course: string;
  text: string;
};

type NotesPreviewProps = {
  theme: (typeof Colors)["light"];
  notes: Note[];
  onViewAll?: () => void;
};

export function NotesPreview({ theme, notes, onViewAll }: NotesPreviewProps) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={[styles.iconContainer, { backgroundColor: `${theme.accent}20` }]}>
            <Ionicons name="document-text" size={20} color={theme.accent} />
          </View>
          <View style={styles.titleContainer}>
            <Text style={[styles.title, { color: theme.text }]}>Recent Notes</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              {notes.length} snapshot{notes.length !== 1 ? "s" : ""} saved
            </Text>
          </View>
        </View>

        {notes.length > 0 && (
          <Pressable
            style={({ pressed }) => [
              styles.viewAllButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            onPress={onViewAll}
          >
            <Text style={[styles.viewAllText, { color: theme.tint }]}>View All</Text>
            <Ionicons name="chevron-forward" size={16} color={theme.tint} />
          </Pressable>
        )}
      </View>

      {notes.length > 0 ? (
        <View style={styles.notesList}>
          {notes.slice(0, 3).map((note, index) => (
            <View
              key={note.id}
              style={[
                styles.noteItem,
                {
                  backgroundColor: theme.surfaceMuted,
                  borderLeftColor: getAccentColor(index),
                },
              ]}
            >
              <View style={styles.noteHeader}>
                <View style={[styles.courseBadge, { backgroundColor: `${getAccentColor(index)}15` }]}>
                  <Text style={[styles.courseBadgeText, { color: getAccentColor(index) }]}>
                    {note.course}
                  </Text>
                </View>
              </View>
              <Text
                style={[styles.noteText, { color: theme.text }]}
                numberOfLines={2}
              >
                {note.text}
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIconContainer, { backgroundColor: theme.surfaceMuted }]}>
            <Ionicons name="albums-outline" size={28} color={theme.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No notes yet</Text>
          <Text style={[styles.emptyText, { color: theme.textMuted }]}>
            Capture your first snapshot to get started
          </Text>
        </View>
      )}
    </View>
  );
}

function getAccentColor(index: number): string {
  const colors = ["#10B981", "#0EA5E9", "#8B5CF6", "#F59E0B", "#EC4899"];
  return colors[index % colors.length];
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
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    flex: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
  subtitle: {
    fontSize: FontSize.sm,
    marginTop: 2,
  },
  viewAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  viewAllText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
  },
  notesList: {
    gap: Spacing.sm,
  },
  noteItem: {
    borderRadius: Radius.md,
    padding: Spacing.md,
    borderLeftWidth: 3,
  },
  noteHeader: {
    flexDirection: "row",
    marginBottom: Spacing.xs,
  },
  courseBadge: {
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  courseBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  noteText: {
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
  emptyIconContainer: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    fontSize: FontSize.sm,
    textAlign: "center",
  },
});
