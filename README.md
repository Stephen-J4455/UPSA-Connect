# UPSA Student Hub

Cross-platform Expo + TypeScript mobile app tailored for UPSA students.

## Features Implemented

- UPSA brand theme with `UPSA Blue (#003366)` and `UPSA Gold (#FFCC00)`
- Bottom tabs: `Home`, `My Slides`, `AI Tutor`, `Timetable`
- Supabase Auth login with UPSA student email + index number
- Slide listing from Supabase Storage with "Download for Offline Use"
- Floating "Summarize with AI" action on slide screen
- Groq integrations routed via Supabase Edge Functions
  - Smart summary parser with expandable bullet points
  - Quiz generation with mobile-friendly MCQ UI
- Timetable widget showing current class, venue, and progress bar using local clock
- Haptic feedback for quiz correctness
- Offline mode with TanStack Query + AsyncStorage persistence
- 15-minute lecture reminder notifications
- Snapshot Note Taking (camera -> Groq Vision transcription -> local notes)
- Dynamic Home and Timetable cards loaded from Supabase academic data views
- Light/Dark mode support for night study sessions

## Stack

- Expo Router + React Native + TypeScript
- NativeWind (Tailwind for React Native)
- Supabase (`auth`, `storage`, `functions`)
- TanStack Query + offline persistence
- Expo Notifications, Expo FileSystem, Expo Image Picker

## Setup

1. Install dependencies:

```bash
pnpm install
```

2. Configure environment variables (copy from `.env.example`):

```bash
cp .env.example .env
```

File extraction from `My Slides` and `AI Tutor` is configured directly in the app to use:

- `https://upsa-file-extract-server.vercel.app`

3. Start the app:

```bash
pnpm start
```

## Supabase Edge Functions Expected

Create these functions in your Supabase project:

- `groq-bridge`
  - `task: "summary"` -> returns `summary` JSON structure
  - `task: "quiz"` -> returns `questions` array
  - `task: "vision-transcribe"` -> returns `transcript`


## Storage and Tables Expected

- Storage bucket: `slides` (PDF materials)
- Run SQL script: `supabase/schema_and_seed.sql`
- Core tables:
  - `academic_years`
  - `semesters`
  - `courses`
  - `class_sessions`
  - `course_assessments`
  - `course_announcements`
- App query views:
  - `v_class_schedule`
  - `v_home_course_cards`

`timetable_entries` is still supported as a fallback source for backward compatibility.
