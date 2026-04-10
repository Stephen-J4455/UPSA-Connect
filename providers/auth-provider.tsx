import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import type { Session, User } from "@supabase/supabase-js";

import { isSupabaseConfigured, supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signInWithGoogleUpsaMail: () => Promise<void>;
  signOut: () => Promise<void>;
};

type OAuthCallbackResult =
  | { kind: "code"; code: string }
  | { kind: "token"; accessToken: string; refreshToken: string }
  | { kind: "invalid" };

function parseOAuthCallback(url: string): OAuthCallbackResult {
  const parsed = Linking.parse(url);
  const query = parsed.queryParams ?? {};
  const getQueryParam = (key: string) => {
    const value = query[key];
    return typeof value === "string" ? value : undefined;
  };

  const code = getQueryParam("code");
  if (code) {
    return { kind: "code", code };
  }

  const hash = url.includes("#") ? url.split("#")[1] : "";
  const hashParams = new URLSearchParams(hash);
  const accessToken =
    hashParams.get("access_token") ?? getQueryParam("access_token");
  const refreshToken =
    hashParams.get("refresh_token") ?? getQueryParam("refresh_token");

  if (accessToken && refreshToken) {
    return {
      kind: "token",
      accessToken,
      refreshToken,
    };
  }

  return { kind: "invalid" };
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const user = session?.user ?? null;

  useEffect(() => {
    let mounted = true;

    const loadInitialSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(data.session);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadInitialSession();

    const subscription = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
        setIsLoading(false);
      },
    );

    return () => {
      mounted = false;
      subscription.data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      isLoading,
      signInWithGoogleUpsaMail: async () => {
        if (!isSupabaseConfigured) {
          throw new Error(
            "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env file.",
          );
        }

        const redirectTo = Linking.createURL("/");

        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
            skipBrowserRedirect: true,
            queryParams: {
              hd: "upsamail.edu.gh",
              prompt: "select_account",
            },
          },
        });

        if (error) {
          throw new Error(error.message);
        }

        if (!data?.url) {
          throw new Error("Unable to start Google login.");
        }

        const authResult = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectTo,
        );

        if (authResult.type !== "success") {
          throw new Error("Google sign-in was cancelled.");
        }

        const callback = parseOAuthCallback(authResult.url);

        if (callback.kind === "code") {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(callback.code);

          if (exchangeError) {
            throw new Error(exchangeError.message);
          }
        } else if (callback.kind === "token") {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: callback.accessToken,
            refresh_token: callback.refreshToken,
          });

          if (setSessionError) {
            throw new Error(setSessionError.message);
          }
        } else {
          throw new Error("Google sign-in response was invalid.");
        }

        const { data: userData, error: userError } =
          await supabase.auth.getUser();
        if (userError) {
          throw new Error(userError.message);
        }

        const email = userData.user?.email?.toLowerCase() ?? "";
        if (!email.endsWith("@upsamail.edu.gh")) {
          await supabase.auth.signOut();
          throw new Error("Use your UPSA Google account (@upsamail.edu.gh).");
        }
      },
      signOut: async () => {
        await supabase.auth.signOut();
      },
    }),
    [session, user, isLoading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}
