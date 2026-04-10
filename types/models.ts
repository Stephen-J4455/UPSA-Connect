export type SlideFile = {
  id: string;
  name: string;
  path: string;
  courseCode?: string;
  updatedAt?: string;
  localPath?: string;
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
  venue: string;
  lecturer?: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type GroqSummaryResponse = {
  summary: SmartSummary;
};

export type GroqQuizResponse = {
  questions: QuizQuestion[];
};
