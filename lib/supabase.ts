import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";



const supabaseUrl = "https://pkkffnpcgkwvnlwhtxwu.supabase.co";
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBra2ZmbnBjZ2t3dm5sd2h0eHd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU3Njk0NzksImV4cCI6MjA5MTM0NTQ3OX0.WFP_eL57XA5P14WbI-sX9ZI208rIjTR2yv9IYSGvU2I";

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
if (!isSupabaseConfigured) {
  // Keep app booting in UI-only mode so local development can continue without secrets.
  console.warn(
    "Supabase env vars missing. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your environment.",
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storage: AsyncStorage,
  },
});
