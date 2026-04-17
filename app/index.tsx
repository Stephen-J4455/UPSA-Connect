import { Redirect } from "expo-router";

import { useAuth } from "@/providers/auth-provider";

export default function RootIndex() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  return <Redirect href="/login" />;
}
