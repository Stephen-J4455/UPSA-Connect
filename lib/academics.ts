import type { HomeCourseCard } from "@/types/models";

import { supabase } from "@/lib/supabase";

const fallbackHomeCards: HomeCourseCard[] = [
  {
    courseId: "fallback-mkt301",
    courseCode: "MKT301",
    courseTitle: "Principles of Marketing",
    department: "Marketing",
    level: 300,
    credits: 3,
    lecturerName: "Dr. A. Mensah",
    colorHex: "#1D4ED8",
    semesterName: "Second Semester",
    academicYearLabel: "2025/2026",
    sessionsPerWeek: 2,
    firstClassTime: "10:00",
    lastClassTime: "15:00",
  },
  {
    courseId: "fallback-it220",
    courseCode: "IT220",
    courseTitle: "Data Communications",
    department: "Information Systems",
    level: 200,
    credits: 3,
    lecturerName: "Mr. K. Ofori",
    colorHex: "#10B981",
    semesterName: "Second Semester",
    academicYearLabel: "2025/2026",
    sessionsPerWeek: 1,
    firstClassTime: "14:00",
    lastClassTime: "16:00",
  },
];

type HomeCardRow = {
  course_id: string;
  course_code: string;
  course_title: string;
  department: string;
  level: number;
  credits: number;
  lecturer_name: string | null;
  color_hex: string | null;
  semester_name: string;
  academic_year_label: string;
  sessions_per_week: number;
  first_class_time: string | null;
  last_class_time: string | null;
};

export async function fetchHomeCourseCards() {
  try {
    const { data, error } = await supabase
      .from("v_home_course_cards")
      .select(
        "course_id, course_code, course_title, department, level, credits, lecturer_name, color_hex, semester_name, academic_year_label, sessions_per_week, first_class_time, last_class_time",
      )
      .order("course_code", { ascending: true });

    if (error) throw error;

    const mapped: HomeCourseCard[] = ((data as HomeCardRow[] | null) ?? []).map(
      (item) => ({
        courseId: item.course_id,
        courseCode: item.course_code,
        courseTitle: item.course_title,
        department: item.department,
        level: item.level,
        credits: item.credits,
        lecturerName: item.lecturer_name ?? undefined,
        colorHex: item.color_hex ?? undefined,
        semesterName: item.semester_name,
        academicYearLabel: item.academic_year_label,
        sessionsPerWeek: item.sessions_per_week,
        firstClassTime: item.first_class_time ?? undefined,
        lastClassTime: item.last_class_time ?? undefined,
      }),
    );

    return mapped.length ? mapped : fallbackHomeCards;
  } catch {
    return fallbackHomeCards;
  }
}
