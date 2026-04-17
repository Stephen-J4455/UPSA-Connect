import type { StudentOnboardingProfile } from "@/lib/student-profile";
import { supabase } from "@/lib/supabase";

export const DEFAULT_PROGRAMS_BY_DEPARTMENT: Record<string, string[]> = {
  Accounting: ["BSc Accounting", "BSc Banking and Finance"],
  Marketing: ["BSc Marketing", "BSc Public Relations Management"],
  "Information Technology": [
    "BSc Information Technology Management",
    "BSc Data Science and Analytics",
  ],
  Economics: ["BSc Economics", "BSc Economics and Finance"],
  Law: ["LLB Law", "BSc Business Law"],
};

export const DEFAULT_CLASS_OPTIONS = ["Class A", "Class B", "Class C", "Weekend"];

export type OnboardingCatalog = {
  departments: string[];
  programsByDepartment: Record<string, string[]>;
  classes: string[];
  classesByProgram: Record<string, string[]>;
};

export type ScopedCourse = {
  id: string;
  courseCode: string;
  courseTitle: string;
  credits: number;
};

export type CampusPostItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

export type CampusScopeCounts = {
  courses: number;
  materials: number;
  announcements: number;
};

const defaultDepartments = Object.keys(DEFAULT_PROGRAMS_BY_DEPARTMENT);

function buildDefaultCatalog(): OnboardingCatalog {
  return {
    departments: defaultDepartments,
    programsByDepartment: DEFAULT_PROGRAMS_BY_DEPARTMENT,
    classes: DEFAULT_CLASS_OPTIONS,
    classesByProgram: {},
  };
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean).map((value) => value.trim()))).sort(
    (a, b) => a.localeCompare(b),
  );
}

function scopeProgramKey(department: string, program: string) {
  return `${department.trim()}::${program.trim()}`;
}

function hasScopeValues(
  profile: StudentOnboardingProfile | null,
): profile is StudentOnboardingProfile {
  if (!profile) return false;
  return Boolean(
    profile.department.trim() &&
      profile.program.trim() &&
      profile.className.trim() &&
      profile.year > 0 &&
      profile.semester > 0,
  );
}

export async function fetchOnboardingCatalog() {
  const fallback = buildDefaultCatalog();

  try {
    const [{ data: departmentsData, error: departmentsError }, { data: programsData, error: programsError }, { data: classesData, error: classesError }] = await Promise.all([
      supabase
        .from("department_catalog")
        .select("name")
        .order("name", { ascending: true })
        .limit(200),
      supabase
        .from("program_catalog")
        .select("department, program_name")
        .order("department", { ascending: true })
        .order("program_name", { ascending: true })
        .limit(500),
      supabase
        .from("class_catalog")
        .select("department, program_name, class_name")
        .order("class_name", { ascending: true })
        .limit(500),
    ]);

    if (departmentsError || programsError || classesError) {
      return fallback;
    }

    const programsByDepartment: Record<string, string[]> = {};

    (programsData ?? []).forEach((item) => {
      const department = String(item.department ?? "").trim();
      const program = String(item.program_name ?? "").trim();
      if (!department || !program) return;

      if (!programsByDepartment[department]) {
        programsByDepartment[department] = [];
      }
      programsByDepartment[department].push(program);
    });

    Object.keys(programsByDepartment).forEach((department) => {
      programsByDepartment[department] = uniqueSorted(programsByDepartment[department]);
    });

    const classesByProgram: Record<string, string[]> = {};
    const allClasses: string[] = [];

    (classesData ?? []).forEach((item) => {
      const department = String(item.department ?? "").trim();
      const program = String(item.program_name ?? "").trim();
      const className = String(item.class_name ?? "").trim();
      if (!className) return;

      allClasses.push(className);
      if (department && program) {
        const key = scopeProgramKey(department, program);
        if (!classesByProgram[key]) {
          classesByProgram[key] = [];
        }
        classesByProgram[key].push(className);
      }
    });

    Object.keys(classesByProgram).forEach((key) => {
      classesByProgram[key] = uniqueSorted(classesByProgram[key]);
    });

    const departmentsFromTable = uniqueSorted(
      (departmentsData ?? []).map((item) => String(item.name ?? "")),
    );

    const departments =
      departmentsFromTable.length > 0
        ? departmentsFromTable
        : uniqueSorted([...Object.keys(programsByDepartment), ...defaultDepartments]);

    const classes = uniqueSorted(allClasses);

    return {
      departments,
      programsByDepartment:
        Object.keys(programsByDepartment).length > 0
          ? programsByDepartment
          : DEFAULT_PROGRAMS_BY_DEPARTMENT,
      classes: classes.length > 0 ? classes : DEFAULT_CLASS_OPTIONS,
      classesByProgram,
    } satisfies OnboardingCatalog;
  } catch {
    return fallback;
  }
}

export function getScopedClassOptions(
  catalog: OnboardingCatalog,
  department: string | null,
  program: string | null,
) {
  if (department && program) {
    const scoped = catalog.classesByProgram[scopeProgramKey(department, program)];
    if (scoped?.length) {
      return scoped;
    }
  }

  return catalog.classes.length ? catalog.classes : DEFAULT_CLASS_OPTIONS;
}

export async function fetchScopedCourses(profile: StudentOnboardingProfile | null) {
  if (!hasScopeValues(profile)) {
    return [] as ScopedCourse[];
  }

  try {
    const { data, error } = await supabase
      .from("course_catalog")
      .select("id, course_code, course_title, credits")
      .eq("department", profile.department)
      .eq("program_name", profile.program)
      .eq("class_name", profile.className)
      .eq("year", profile.year)
      .eq("semester", profile.semester)
      .order("course_code", { ascending: true });

    if (error) {
      return [];
    }

    return (data ?? []).map((item) => ({
      id: String(item.id),
      courseCode: String(item.course_code ?? ""),
      courseTitle: String(item.course_title ?? ""),
      credits: Number(item.credits ?? 0),
    }));
  } catch {
    return [];
  }
}

export async function fetchScopedCampusPosts(profile: StudentOnboardingProfile | null) {
  if (!hasScopeValues(profile)) {
    return [] as CampusPostItem[];
  }

  try {
    const { data, error } = await supabase
      .from("campus_posts")
      .select("id, title, body, created_at")
      .eq("department", profile.department)
      .eq("program_name", profile.program)
      .eq("class_name", profile.className)
      .eq("year", profile.year)
      .eq("semester", profile.semester)
      .order("created_at", { ascending: false })
      .limit(5);

    if (error) {
      return [];
    }

    return (data ?? []).map((item) => ({
      id: String(item.id),
      title: String(item.title ?? ""),
      body: String(item.body ?? ""),
      createdAt: String(item.created_at ?? ""),
    }));
  } catch {
    return [];
  }
}

export async function fetchCampusScopeCounts(profile: StudentOnboardingProfile | null) {
  if (!hasScopeValues(profile)) {
    return {
      courses: 0,
      materials: 0,
      announcements: 0,
    } satisfies CampusScopeCounts;
  }

  try {
    const courseCountQuery = supabase
      .from("course_catalog")
      .select("id", { count: "exact", head: true })
      .eq("department", profile.department)
      .eq("program_name", profile.program)
      .eq("class_name", profile.className)
      .eq("year", profile.year)
      .eq("semester", profile.semester);

    const materialCountQuery = supabase
      .from("learning_materials")
      .select("id", { count: "exact", head: true })
      .eq("department", profile.department)
      .eq("program_name", profile.program)
      .eq("class_name", profile.className)
      .eq("year", profile.year)
      .eq("semester", profile.semester);

    const postCountQuery = supabase
      .from("campus_posts")
      .select("id", { count: "exact", head: true })
      .eq("department", profile.department)
      .eq("program_name", profile.program)
      .eq("class_name", profile.className)
      .eq("year", profile.year)
      .eq("semester", profile.semester);

    const [courseResult, materialResult, postResult] = await Promise.all([
      courseCountQuery,
      materialCountQuery,
      postCountQuery,
    ]);

    return {
      courses: Number(courseResult.count ?? 0),
      materials: Number(materialResult.count ?? 0),
      announcements: Number(postResult.count ?? 0),
    } satisfies CampusScopeCounts;
  } catch {
    return {
      courses: 0,
      materials: 0,
      announcements: 0,
    } satisfies CampusScopeCounts;
  }
}
