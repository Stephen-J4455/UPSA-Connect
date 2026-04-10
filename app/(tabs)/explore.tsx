import { StyleSheet, Text, useColorScheme, View } from "react-native";

import { Colors, FontSize, Spacing } from "@/constants/theme";

export default function HiddenExploreRoute() {
  const mode = useColorScheme() === "dark" ? "dark" : "light";
  const theme = Colors[mode];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Text style={[styles.text, { color: theme.textMuted }]}>
        This route is hidden from the UPSA Student Hub tab bar.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.lg,
  },
  text: {
    textAlign: "center",
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
});
