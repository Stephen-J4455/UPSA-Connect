import { Ionicons, Octicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Colors, FontSize, FontWeight, Radius, Shadows } from "@/constants/theme";
import { hasCompletedOnboarding } from "@/lib/student-profile";
import { useAuth } from "@/providers/auth-provider";

export default function TabLayout() {
  const { session, user, isLoading } = useAuth();
  const mode = useColorScheme() === "dark" ? "dark" : "light";
  const theme = Colors[mode];
  const insets = useSafeAreaInsets();
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkOnboarding = async () => {
      if (mounted) {
        setCheckingProfile(true);
      }

      if (!session || !user) {
        if (mounted) {
          setIsOnboarded(false);
          setCheckingProfile(false);
        }
        return;
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

  if (isLoading || checkingProfile) {
    return null;
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!isOnboarded) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <View style={styles.container}>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: theme.tint },
          headerTintColor: theme.accent,
          headerTitleStyle: { fontWeight: FontWeight.bold },
          tabBarStyle: {
            position: "absolute",
            width: "90%",
            alignSelf: "center",
            bottom: Math.max(insets.bottom, 10),
            height: 62,
            borderTopWidth: 0,
            borderRadius: Radius.xl,
            zIndex: 10,
            overflow: "visible",
            backgroundColor: theme.heroBackground,
            shadowColor: theme.shadow,
            ...Shadows.card,
            paddingTop: 6,
            paddingBottom: 6,
            marginHorizontal: "5%",
          },
          tabBarItemStyle: {
            borderRadius: Radius.lg,
            marginHorizontal: 2,
          },
          tabBarLabelStyle: {
            fontSize: FontSize.xs - 1,
            fontWeight: FontWeight.bold,
          },
          tabBarActiveTintColor: theme.accent,
          tabBarInactiveTintColor: theme.tabBarInactive,
        }}
      >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="dashboard"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="my-slides"
        options={{
          title: "My Slides",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai-tutor"
        options={{
          title: "P-AI",
          headerShown: false,
          tabBarStyle: { display: "none" },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="timetable"
        options={{
          title: "Timetable",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerShown: false,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
