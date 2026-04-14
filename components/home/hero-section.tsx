import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { Colors, FontSize, FontWeight, Radius, Spacing } from "@/constants/theme";

type HeroSectionProps = {
  theme: (typeof Colors)["light"];
  displayName: string;
  initials: string;
  firstName: string;
  email: string;
  paddingTop: number;
  todayClassCount: number;
  notesCount: number;
  onNotificationPress?: () => void;
};

export function HeroSection({
  theme,
  displayName,
  initials,
  firstName,
  email,
  paddingTop,
  todayClassCount,
  notesCount,
  onNotificationPress,
}: HeroSectionProps) {
  const greeting = getGreeting();

  return (
    <View style={[styles.hero, { paddingTop }]}>
      <LinearGradient
        colors={[theme.heroBackground, theme.heroOrbTwo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.heroContent}>
        <View style={styles.topRow}>
          <View style={styles.greetingContainer}>
            <Text style={[styles.greetingText, { color: theme.textMuted }]}>
              {greeting}
            </Text>
            <Text style={[styles.nameText, { color: theme.textOnHero }]}>
              {firstName}
            </Text>
          </View>

          <View style={styles.topRightActions}>
            <Pressable
              style={({ pressed }) => [
                styles.notificationButton,
                {
                  backgroundColor: "rgba(255,255,255,0.12)",
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              onPress={onNotificationPress}
            >
              <Ionicons name="notifications-outline" size={22} color={theme.textOnHero} />
              <View style={[styles.notificationBadge, { backgroundColor: theme.accent }]}>
                <Text style={[styles.notificationBadgeText, { color: theme.accentText }]}>
                  2
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        <View style={styles.profileCard}>
          <View style={[styles.avatarContainer, { backgroundColor: theme.accent }]}>
            <Text style={[styles.avatarText, { color: theme.accentText }]}>
              {initials || "US"}
            </Text>
          </View>

          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: theme.textOnHero }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.profileEmail, { color: theme.textMuted }]} numberOfLines={1}>
              {email}
            </Text>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <View style={[styles.statItem, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
            <View style={styles.statIconContainer}>
              <Ionicons name="calendar" size={18} color={theme.accent} />
            </View>
            <View style={styles.statTextContainer}>
              <Text style={[styles.statValue, { color: theme.textOnHero }]}>
                {todayClassCount}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>
                Classes Today
              </Text>
            </View>
          </View>

          <View style={[styles.statDivider, { backgroundColor: "rgba(255,255,255,0.15)" }]} />

          <View style={[styles.statItem, { backgroundColor: "rgba(255,255,255,0.08)" }]}>
            <View style={styles.statIconContainer}>
              <Ionicons name="document-text" size={18} color={theme.accent} />
            </View>
            <View style={styles.statTextContainer}>
              <Text style={[styles.statValue, { color: theme.textOnHero }]}>
                {notesCount}
              </Text>
              <Text style={[styles.statLabel, { color: theme.textMuted }]}>
                Saved Notes
              </Text>
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.heroOrbTop, { backgroundColor: theme.heroOrbOne }]} />
      <View style={[styles.heroOrbBottom, { backgroundColor: theme.heroOrbTwo }]} />
    </View>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

const styles = StyleSheet.create({
  hero: {
    overflow: "hidden",
    borderBottomLeftRadius: Radius.xxl,
    borderBottomRightRadius: Radius.xxl,
    paddingBottom: Spacing.xl,
  },
  heroContent: {
    paddingHorizontal: Spacing.xl,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  greetingContainer: {
    flex: 1,
  },
  greetingText: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: Spacing.xs,
  },
  nameText: {
    fontSize: FontSize.xxl,
    fontWeight: FontWeight.bold,
  },
  topRightActions: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  notificationButton: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  notificationBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationBadgeText: {
    fontSize: 10,
    fontWeight: FontWeight.bold,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  avatarContainer: {
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.extrabold,
  },
  profileInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  profileName: {
    fontSize: FontSize.md,
    fontWeight: FontWeight.semibold,
    marginBottom: 2,
  },
  profileEmail: {
    fontSize: FontSize.sm,
  },
  statsContainer: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: Radius.lg,
    padding: Spacing.sm,
  },
  statItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: Radius.md,
  },
  statIconContainer: {
    marginRight: Spacing.sm,
  },
  statTextContainer: {
    flex: 1,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.bold,
  },
  statLabel: {
    fontSize: FontSize.xs,
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    marginVertical: Spacing.sm,
    marginHorizontal: Spacing.xs,
  },
  heroOrbTop: {
    position: "absolute",
    right: -30,
    top: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.3,
  },
  heroOrbBottom: {
    position: "absolute",
    left: -40,
    bottom: -40,
    width: 100,
    height: 100,
    borderRadius: 50,
    opacity: 0.4,
  },
});
