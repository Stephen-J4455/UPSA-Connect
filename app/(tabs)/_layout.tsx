import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import React from "react";
import { useColorScheme } from "react-native";

import { Colors, FontSize, FontWeight, Radius, Shadows } from "@/constants/theme";
import { useAuth } from "@/providers/auth-provider";

export default function TabLayout() {
  const { session, isLoading } = useAuth();
  const mode = useColorScheme() === "dark" ? "dark" : "light";
  const theme = Colors[mode];

  if (isLoading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: theme.tint },
        headerTintColor: theme.accent,
        headerTitleStyle: { fontWeight: FontWeight.bold },
        tabBarStyle: {
          position: "absolute",
          width: "90%",
          alignSelf: "center",
          bottom: 16,
          height: 62,
          borderTopWidth: 0,
          borderRadius: Radius.xl,
          backgroundColor: theme.tint,
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
            <Ionicons name="grid" color={color} size={size} />
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
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="ai-tutor"
        options={{
          title: "AI Tutor",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="sparkles" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="timetable"
        options={{
          title: "Timetable",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" color={color} size={size} />
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
  );
}
