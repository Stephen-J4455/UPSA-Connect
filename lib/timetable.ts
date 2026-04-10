import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "@/lib/supabase";
import type { TimetableEntry } from "@/types/models";

const TIMETABLE_CACHE_KEY = "upsa.timetable";

const fallbackTimetable: TimetableEntry[] = [
  {
    id: "mkt301-mon",
    course: "Principles of Marketing",
    venue: "Management Block",
    dayOfWeek: 1,
    startTime: "10:00",
    endTime: "12:00",
    lecturer: "Dr. A. Mensah",
  },
  {
    id: "acc204-tue",
    course: "Financial Accounting",
    venue: "LBC 302",
    dayOfWeek: 2,
    startTime: "08:00",
    endTime: "10:00",
    lecturer: "Mrs. Y. Boateng",
  },
  {
    id: "it220-wed",
    course: "Data Communications",
    venue: "ICT Lab 2",
    dayOfWeek: 3,
    startTime: "14:00",
    endTime: "16:00",
    lecturer: "Mr. K. Ofori",
  },
];

function parseClockToDate(dayOfWeek: number, clock: string) {
  const now = new Date();
  const [hour, minute] = clock.split(":").map(Number);
  const target = new Date(now);
  const delta = dayOfWeek - now.getDay();
  target.setDate(now.getDate() + delta);
  target.setHours(hour, minute, 0, 0);
  return target;
}

export function getCurrentClass(entries: TimetableEntry[]) {
  const now = new Date();

  const active = entries.find((entry) => {
    const start = parseClockToDate(entry.dayOfWeek, entry.startTime);
    const end = parseClockToDate(entry.dayOfWeek, entry.endTime);
    return now >= start && now <= end;
  });

  if (!active) return null;

  const start = parseClockToDate(active.dayOfWeek, active.startTime);
  const end = parseClockToDate(active.dayOfWeek, active.endTime);
  const total = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();

  return {
    ...active,
    progress: Math.min(1, Math.max(0, elapsed / total)),
    remainingMinutes: Math.max(
      0,
      Math.round((end.getTime() - now.getTime()) / 60000),
    ),
  };
}

export function getNextClass(entries: TimetableEntry[]) {
  const now = new Date();

  const upcoming = entries
    .map((entry) => ({
      entry,
      startDate: parseClockToDate(entry.dayOfWeek, entry.startTime),
    }))
    .map((item) => {
      if (item.startDate < now) {
        item.startDate.setDate(item.startDate.getDate() + 7);
      }
      return item;
    })
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];

  return upcoming ?? null;
}

export async function fetchTimetable() {
  try {
    const { data: scheduleRows, error: scheduleError } = await supabase
      .from("v_class_schedule")
      .select(
        "id, day_of_week, start_time, end_time, venue, campus, is_online, class_type, course_code, course_title, lecturer_name, semester_name, academic_year_label, color_hex",
      )
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true });

    let entries: TimetableEntry[] = [];

    if (!scheduleError && scheduleRows?.length) {
      entries = scheduleRows.map((item) => ({
        id: item.id,
        course: item.course_title,
        courseCode: item.course_code,
        venue: item.venue,
        lecturer: item.lecturer_name ?? undefined,
        dayOfWeek: item.day_of_week,
        startTime: item.start_time,
        endTime: item.end_time,
        classType: item.class_type ?? undefined,
        isOnline: item.is_online,
        campus: item.campus ?? undefined,
        semesterName: item.semester_name ?? undefined,
        academicYear: item.academic_year_label ?? undefined,
        colorHex: item.color_hex ?? undefined,
      }));
    } else {
      const { data, error } = await supabase
        .from("timetable_entries")
        .select("id, course, venue, lecturer, day_of_week, start_time, end_time")
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;

      entries = (data ?? []).map((item) => ({
        id: item.id,
        course: item.course,
        venue: item.venue,
        lecturer: item.lecturer ?? undefined,
        dayOfWeek: item.day_of_week,
        startTime: item.start_time,
        endTime: item.end_time,
      }));
    }

    await AsyncStorage.setItem(TIMETABLE_CACHE_KEY, JSON.stringify(entries));

    return entries.length ? entries : fallbackTimetable;
  } catch {
    const cached = await AsyncStorage.getItem(TIMETABLE_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached) as TimetableEntry[];
    }
    return fallbackTimetable;
  }
}
