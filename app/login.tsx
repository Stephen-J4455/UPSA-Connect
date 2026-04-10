import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { Redirect } from "expo-router";

import { Colors, FontSize, FontWeight, Radius, Shadows, Spacing } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";

export default function LoginScreen() {
  const { session, signInWithGoogleUpsaMail } = useAuth();
  const mode = useColorScheme() === "dark" ? "dark" : "light";
  const theme = Colors[mode];
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (session) {
    return <Redirect href="/(tabs)/home" />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <View
        style={[
          styles.card,
          {
            borderColor: theme.border,
            backgroundColor: theme.surface,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <Text style={[styles.eyebrow, { color: theme.icon }]}> 
          UPSA Student Hub
        </Text>
        <Text style={[styles.title, { color: theme.tint }]}> 
          Welcome Back
        </Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}> 
          Sign in with your UPSA Google account (example:
          your_ID@upsamail.edu.gh).
        </Text>

        <View style={styles.formArea}>
          {error ? (
            <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: pressed ? theme.tintPressed : theme.tint },
            ]}
            disabled={loading}
            onPress={async () => {
              setError(null);
              setLoading(true);
              try {
                await signInWithGoogleUpsaMail();
              } catch (signInError) {
                setError(
                  signInError instanceof Error
                    ? signInError.message
                    : "Unable to sign in.",
                );
              } finally {
                setLoading(false);
              }
            }}
          >
            {loading ? (
              <ActivityIndicator color={theme.accent} />
            ) : (
              <Text style={[styles.buttonText, { color: theme.accent }]}>
                Continue with Google
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xxl,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.xxl,
    padding: Spacing.xxl,
    ...Shadows.card,
  },
  eyebrow: {
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 3,
  },
  title: {
    marginTop: Spacing.sm,
    fontSize: FontSize.xxxl,
    fontWeight: FontWeight.bold,
  },
  subtitle: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  formArea: {
    marginTop: Spacing.xxl,
  },
  errorText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.sm,
  },
  button: {
    marginTop: Spacing.sm,
    alignItems: "center",
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  buttonText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
});
