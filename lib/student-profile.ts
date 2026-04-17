import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "@/lib/supabase";

const PROFILE_KEY_PREFIX = "upsa.student.profile";

export type StudentOnboardingProfile = {
  department: string;
  program: string;
  className: string;
  year: number;
  semester: number;
};

type StudentProfileRow = {
  department: string;
  program: string;
  class_name: string;
  year: number;
  semester: number;
};

function storageKey(userId: string) {
  return `${PROFILE_KEY_PREFIX}.${userId}`;
}

function normalizeText(value: string) {
  return value.trim();
}

export function isProfileComplete(profile: Partial<StudentOnboardingProfile> | null) {
  if (!profile) return false;

  return Boolean(
    normalizeText(profile.department ?? "") &&
      normalizeText(profile.program ?? "") &&
      normalizeText(profile.className ?? "") &&
      Number(profile.year) > 0 &&
      Number(profile.semester) > 0,
  );
}

export async function getStudentProfile(userId: string) {
  const localRaw = await AsyncStorage.getItem(storageKey(userId));
  if (localRaw) {
    return JSON.parse(localRaw) as StudentOnboardingProfile;
  }

  return null;
}

export async function fetchStudentProfileFromSupabase(userId: string) {
  const { data, error } = await supabase
    .from("student_profiles")
    .select("department, program, class_name, year, semester")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as StudentProfileRow;
  return {
    department: row.department,
    program: row.program,
    className: row.class_name,
    year: row.year,
    semester: row.semester,
  } satisfies StudentOnboardingProfile;
}

export async function getResolvedStudentProfile(userId: string) {
  const localProfile = await getStudentProfile(userId);
  if (isProfileComplete(localProfile)) {
    return localProfile;
  }

  const remoteProfile = await fetchStudentProfileFromSupabase(userId);
  if (!isProfileComplete(remoteProfile)) {
    return localProfile;
  }

  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(remoteProfile));
  return remoteProfile;
}

export async function hasCompletedOnboarding(userId: string) {
  try {
    const resolvedProfile = await getResolvedStudentProfile(userId);
    return isProfileComplete(resolvedProfile);
  } catch {
    return false;
  }
}

export async function saveStudentProfile(
  userId: string,
  profile: StudentOnboardingProfile,
) {
  const { error } = await supabase.from("student_profiles").upsert(
    {
      user_id: userId,
      department: profile.department,
      program: profile.program,
      class_name: profile.className,
      year: profile.year,
      semester: profile.semester,
    },
    { onConflict: "user_id" },
  );
  if (error) {
    throw new Error(error.message);
  }

  await AsyncStorage.setItem(storageKey(userId), JSON.stringify(profile));
}
