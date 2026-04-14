import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Colors, FontSize, FontWeight, Radius, Spacing } from "@/constants/theme";

type QuickAction = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress?: () => void;
};

type QuickActionsProps = {
  theme: (typeof Colors)["light"];
  onScanNotes?: () => void;
  onViewTimetable?: () => void;
  onAIChat?: () => void;
  onViewGrades?: () => void;
};

export function QuickActions({
  theme,
  onScanNotes,
  onViewTimetable,
  onAIChat,
  onViewGrades,
}: QuickActionsProps) {
  const actions: QuickAction[] = [
    {
      id: "scan",
      icon: "scan-outline",
      label: "Scan Notes",
      color: "#10B981",
      onPress: onScanNotes,
    },
    {
      id: "timetable",
      icon: "calendar-outline",
      label: "Timetable",
      color: "#0EA5E9",
      onPress: onViewTimetable,
    },
    {
      id: "ai",
      icon: "sparkles-outline",
      label: "AI Chat",
      color: "#8B5CF6",
      onPress: onAIChat,
    },
    {
      id: "grades",
      icon: "ribbon-outline",
      label: "Grades",
      color: "#F59E0B",
      onPress: onViewGrades,
    },
  ];

  return (
    <View style={styles.container}>
      {actions.map((action) => (
        <Pressable
          key={action.id}
          style={({ pressed }) => [
            styles.actionButton,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              opacity: pressed ? 0.8 : 1,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            },
          ]}
          onPress={action.onPress}
        >
          <View
            style={[
              styles.iconContainer,
              { backgroundColor: `${action.color}15` },
            ]}
          >
            <Ionicons name={action.icon} size={22} color={action.color} />
          </View>
          <Text
            style={[styles.label, { color: theme.text }]}
            numberOfLines={1}
          >
            {action.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  actionButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xs,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    textAlign: "center",
  },
});
