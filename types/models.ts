export type SlideFile = {
  id: string;
  name: string;
  path: string;
  folderName?: string;
  courseCode?: string;
  updatedAt?: string;
  localPath?: string;
  source?: "local" | "remote";
};

export type SmartSummaryItem = {
  title: string;
  bullets: string[];
};

export type SmartSummary = {
  title: string;
  intro?: string;
  items: SmartSummaryItem[];
};

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  answerIndex: number;
  explanation?: string;
};

export type TimetableEntry = {
  id: string;
  course: string;
  courseCode?: string;
  venue: string;
  lecturer?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  classType?: string;
  isOnline?: boolean;
  campus?: string;
  semesterName?: string;
  academicYear?: string;
  colorHex?: string;
};

export type HomeCourseCard = {
  courseId: string;
  courseCode: string;
  courseTitle: string;
  department: string;
  level: number;
  credits: number;
  lecturerName?: string;
  colorHex?: string;
  semesterName: string;
  academicYearLabel: string;
  sessionsPerWeek: number;
  firstClassTime?: string;
  lastClassTime?: string;
};

export type GroqSummaryResponse = {
  summary: SmartSummary;
};

export type GroqQuizResponse = {
  questions: QuizQuestion[];
};
