# UPSA Student Hub

Cross-platform Expo + TypeScript mobile app tailored for UPSA students.

## Features Implemented

- UPSA brand theme with `UPSA Blue (#003366)` and `UPSA Gold (#FFCC00)`
- Bottom tabs: `Dashboard`, `My Slides`, `AI Tutor`, `Timetable`
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
- `extract-slide-text`
  - accepts slide `path` and returns extracted `text`

## Storage and Tables Expected

- Storage bucket: `slides` (PDF materials)
- Table: `timetable_entries`
  - `id`, `course`, `venue`, `lecturer`, `day_of_week`, `start_time`, `end_time`
