import { Link } from "expo-router";
import { StyleSheet, Text, useColorScheme, View } from "react-native";

import { Colors, FontSize, FontWeight, Spacing } from "@/constants/theme";

export default function ModalScreen() {
  const mode = useColorScheme() === "dark" ? "dark" : "light";
  const theme = Colors[mode];

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <Text style={[styles.title, { color: theme.tint }]}>This is a modal</Text>
      <Link href="/" dismissTo style={styles.link}> 
        <Text style={[styles.linkText, { color: theme.text }]}>Go to home screen</Text>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.xl,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: FontWeight.bold,
  },
  link: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  linkText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
  },
});
