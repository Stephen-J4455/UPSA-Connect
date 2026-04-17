import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { Redirect } from "expo-router";

import { Colors, FontSize, FontWeight, Radius, Shadows, Spacing } from "@/constants/theme";
import { hasCompletedOnboarding } from "@/lib/student-profile";
import { useAuth } from "@/providers/auth-provider";

export default function LoginScreen() {
  const { session, user, signInWithGoogleUpsaMail } = useAuth();
  const mode = useColorScheme() === "dark" ? "dark" : "light";
  const theme = Colors[mode];
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const ctaEntrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;

    const checkOnboarding = async () => {
      if (!session || !user) {
        if (mounted) {
          setCheckingProfile(false);
          setIsOnboarded(false);
        }
        return;
      }

      if (mounted) {
        setCheckingProfile(true);
      }

      try {
        const completed = await hasCompletedOnboarding(user.id);
        if (mounted) {
          setIsOnboarded(completed);
        }
      } finally {
        if (mounted) {
          setCheckingProfile(false);
        }
      }
    };

    void checkOnboarding();

    return () => {
      mounted = false;
    };
  }, [session, user]);

  useEffect(() => {
    ctaEntrance.setValue(0);
    Animated.timing(ctaEntrance, {
      toValue: 1,
      duration: 480,
      delay: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [ctaEntrance]);

  if (session) {
    if (checkingProfile) {
      return null;
    }
    return <Redirect href={isOnboarded ? "/(tabs)/home" : "/onboarding"} />;
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}> 
      <View style={[styles.glowOne, { backgroundColor: theme.heroOrbOne }]} />
      <View style={[styles.glowTwo, { backgroundColor: theme.heroOrbTwo }]} />
      <View style={[styles.glowThree, { backgroundColor: theme.accent }]} />

      <View
        style={[
          styles.card,
          {
            borderColor: theme.borderStrong,
            backgroundColor: theme.surfaceElevated,
            shadowColor: theme.shadow,
          },
        ]}
      >
        <View style={styles.headerArea}>
          <View style={[styles.logoWrap, { borderColor: theme.borderStrong }]}> 
            <Image
              source={require("../assets/images/upsa.jpg")}
              style={styles.logo}
              resizeMode="cover"
            />
          </View>

          <Text style={[styles.eyebrow, { color: theme.icon }]}>UPSA Connect</Text>
          <Text style={[styles.title, { color: theme.tint }]}>Sign in to continue</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}> 
            Use your UPSA mail account to access your classes, slides, timetable,
            and AI tutor.
          </Text>
        </View>

        <View style={styles.formArea}>
          {error ? (
            <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          ) : null}

          <Animated.View
            style={[
              styles.ctaWrap,
              {
                opacity: ctaEntrance,
                transform: [
                  {
                    translateY: ctaEntrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                  {
                    scale: ctaEntrance.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.98, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable
              android_ripple={{ color: theme.ring, borderless: false }}
              style={({ pressed }) => [
                styles.button,
                {
                  backgroundColor: pressed ? theme.ctaPressed : theme.cta,
                  borderColor: theme.ring,
                  shadowColor: theme.shadow,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
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
                <ActivityIndicator color={theme.ctaText} />
              ) : (
                <View style={styles.buttonContent}>
                  <View style={[styles.buttonBadge, { backgroundColor: theme.accent }]}> 
                    <Text style={[styles.buttonBadgeText, { color: theme.accentText }]}>@</Text>
                  </View>
                  <View style={styles.buttonTextWrap}>
                    <Text style={[styles.buttonText, { color: theme.ctaText }]}>Continue with UPSA mail</Text>
                    <Text style={[styles.buttonSubText, { color: theme.ctaText }]}>Secure UPSA account sign-in</Text>
                  </View>
                  <View style={[styles.buttonArrowWrap, { backgroundColor: theme.ctaPressed }]}> 
                    <Text style={[styles.buttonArrow, { color: theme.ctaText }]}>→</Text>
                  </View>
                </View>
              )}
            </Pressable>
          </Animated.View>

          <Text style={[styles.note, { color: theme.textSubtle }]}>Only @upsamail.edu.gh accounts are allowed.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    overflow: "hidden",
  },
  glowOne: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 999,
    top: -70,
    right: -50,
    opacity: 0.22,
  },
  glowTwo: {
    position: "absolute",
    width: 300,
    height: 300,
    borderRadius: 999,
    bottom: -120,
    left: -120,
    opacity: 0.15,
  },
  glowThree: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    left: -90,
    top: "44%",
    opacity: 0.1,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.xxl + 6,
    padding: Spacing.xxl,
    ...Shadows.card,
  },
  headerArea: {
    alignItems: "center",
  },
  logoWrap: {
    width: 78,
    height: 78,
    borderRadius: 22,
    borderWidth: 2,
    overflow: "hidden",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  eyebrow: {
    marginTop: Spacing.md,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.semibold,
    textTransform: "uppercase",
    letterSpacing: 2.5,
  },
  title: {
    marginTop: Spacing.sm,
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
    textAlign: "center",
  },
  subtitle: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: "center",
  },
  formArea: {
    marginTop: Spacing.xl,
    alignItems: "center",
  },
  errorText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  ctaWrap: {
    width: "100%",
    alignItems: "center",
  },
  button: {
    marginTop: Spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: Radius.lg + 2,
    borderWidth: 1,
    width: "100%",
    maxWidth: 340,
    minHeight: 56,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 7,
    overflow: "hidden",
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    gap: Spacing.sm,
  },
  buttonBadge: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  buttonBadgeText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
  },
  buttonTextWrap: {
    flex: 1,
  },
  buttonText: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.bold,
    textAlign: "left",
  },
  buttonSubText: {
    marginTop: 2,
    fontSize: FontSize.xs,
    fontWeight: FontWeight.medium,
    opacity: 0.92,
  },
  buttonArrow: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
    lineHeight: 22,
  },
  buttonArrowWrap: {
    width: 28,
    height: 28,
    borderRadius: 99,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  note: {
    marginTop: Spacing.md,
    fontSize: FontSize.xs,
    textAlign: "center",
  },
});
