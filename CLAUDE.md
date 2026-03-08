# School Toppers - Smart Timetable System

## Project Overview
Automated timetable management system for "School Toppers" coaching institute. Handles timetable generation using a hybrid AI + Algorithm approach, teacher availability, leave management, substitute assignment, syllabus tracking, payroll, and CSV import/export.

## Tech Stack
- **Framework**: Next.js 16 (App Router, `src/` directory)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL (Neon) + Prisma ORM v5
- **Auth**: NextAuth.js v4 (credentials provider, JWT, role-based: ADMIN/TEACHER)
- **AI**: Claude API via `@anthropic-ai/sdk` + Google Gemini via `@google/generative-ai` (configurable in Settings)

## Current Data
- 2 Centers: Manpada, Thane Station
- 10 Teachers: 5 senior (11th/12th), 5 junior (8th-10th) — mix of full-time and part-time
- 7 Subjects: Physics, Chemistry, Maths, Biology, English, Science, SST
- 15 Batches: 3 IIT-JEE, 3 JEE Mains, 5 NEET, 4 Junior
- 8 Classrooms: 5 at Manpada, 3 at Thane Station
- 7 Time Slots: 4 morning (1.5h each), 3 evening (1.5h each)
- 34 Teaching Assignments with syllabus hours

## Features Completed

### Phase 1: Project Setup & Authentication
- [x] Next.js project with TypeScript, Tailwind CSS
- [x] PostgreSQL database with Prisma ORM
- [x] NextAuth.js authentication (credentials provider)
- [x] Role-based access (Admin/Teacher)
- [x] Login page with protected routes
- [x] Dashboard layout with sidebar navigation

### Phase 2: Master Data CRUD
- [x] **Centers** — Add/edit/delete coaching centers
- [x] **Subjects** — Manage subjects with unique codes
- [x] **Teachers** — Full CRUD with employment type, subject assignments
- [x] **Teacher Short Codes** — Compact identifier tags (e.g., ASM, RKP, ADE) displayed on teacher cards
- [x] **Classrooms** — Manage rooms per center with capacity and equipment
- [x] **Batches** — Student groups with batch type, center, strength, subject-hour requirements

### Phase 3: Availability & Time Slots
- [x] **Time Slots** — Define 1.5-hour slots (morning for senior, evening for junior)
- [x] **Teacher Availability** — Interactive weekly grid per teacher
  - Click to toggle available/unavailable
  - All/None quick toggles per day
  - Summary cards: Available Days, Total Slots, Total Hours
  - Defaults to "Unavailable" (explicit availability marking)
- [x] **Availability on Teachers List** — Shows days, hours/week, slots count per teacher

### Phase 4: AI Timetable Generation (Hybrid AI + Algorithm)
- [x] **Settings Page** — Store Claude/Gemini API key, select AI provider
- [x] **Hybrid AI + Algorithm Architecture** — Two-phase generation:
  - **Phase 1 (AI)**: AI only picks which DAYS each assignment should happen (simplified task)
  - **Phase 2 (Algorithm)**: Deterministic greedy scheduler assigns time slots and classrooms with zero conflicts guaranteed
  - Hard constraints enforced by algorithm: no double-booking (teacher/batch/classroom), capacity checks, availability checks, center matching, classroom blocks, teacher leaves
  - Fallback day search: if AI's preferred day is full, tries all other days
- [x] **Consecutive Slot Scheduling** — Teacher teaches same batch for 2-3 consecutive slots (3-4.5 hours continuous)
  - User selects "3 Hours" (2 slots), "4.5 Hours" (3 slots), or "Auto" in the generation questionnaire
  - `tryScheduleConsecutiveBlock()` books back-to-back slots with same classroom
  - Falls back to smaller blocks then single slots if full block unavailable
- [x] **Guided Questionnaire for Generation** — When clicking "Generate with AI", a 5-question modal appears:
  1. Consecutive hours per batch (3h / 4.5h / Auto)
  2. Saturday schedule (Full / Light / Off)
  3. Subject distribution (Spread / Cluster)
  4. Teacher-specific preferences (free text)
  5. Additional notes (free text)
- [x] **Unscheduled Items Reporting** — Shows items that couldn't be scheduled with reasons
- [x] **Timetable View** — Weekly grid with day columns and time slot rows
  - Always-visible **Batch filter** and **Teacher filter** dropdowns with active filter summary
  - Clear Filters button with active filter chips
  - Substituted entries: amber background, original teacher struck through, "Sub: [name]" shown
  - Cancelled entries: red background with strikethrough
  - Stats bar showing scheduled/substituted/cancelled counts
  - Legend for color coding
- [x] **Manual Entry Management** — Edit/delete individual timetable entries with conflict checking
- [x] **Timetable PDF Export** — Export weekly timetable as PDF
- [x] **Classroom Availability** — Block classrooms for specific dates/times
  - Classroom page has "Availability Blocks" tab to manage blocks
  - Blocks are fed to timetable generator as constraints
- [x] **Server-Side Save Validation** — Duplicate check before saving (teacher/classroom double-booking)

### Phase 5: Leave Management & Substitution
- [x] **Leave Application** — Teachers apply for leaves (sick, casual, emergency, planned)
- [x] **Leave Approval** — Admin reviews and approves/rejects; auto-triggers substitute finding on approval
- [x] **Affected Classes Preview** — Shows which classes are impacted by a leave
- [x] **AI Substitute Suggestions** — AI suggests best substitute teachers
- [x] **Substitute Assignment** — Assign substitutes with "Assign" buttons per entry
  - Subject qualification check, double-booking prevention
  - Creates SubstituteAssignment record + updates TimetableEntry status to SUBSTITUTED
  - "Auto-Assign All" button to assign top AI suggestion for every affected entry
- [x] **Quick Absence** — One-click absence handler (admin only)
  - Select teacher + date → auto-creates leave, finds subs with AI, assigns them automatically
  - Shows results: which classes got substitutes, which couldn't be covered

### Phase 6: Reports
- [x] **Faculty Utilization Report** — Hours assigned vs available per teacher

### Phase 7: Teaching Assignments
- [x] **Teaching Assignment Model** — Teacher + Batch + Subject + Total Hours + Date Range
- [x] **Weekly Slot Calculator** — Auto-calculates how many weekly slots each teacher needs
- [x] **Teaching Assignments Page** — Full CRUD with teacher filter cards
  - Summary cards per teacher showing total slots/week and batches
  - Progress bar for completed vs total hours
  - Duration display with weeks calculation
  - Weekly plan (slots/wk needed, hours/wk needed)
- [x] **API Routes** — GET/POST/PUT/DELETE for teaching assignments
- [x] **Timetable Integration** — Teaching assignments drive the AI + Algorithm generation
- [x] **Seed Data** — 34 realistic assignments for all 10 teachers

### Phase 8: Syllabus Management
- [x] **Syllabus Model** — Syllabus → Chapters → Subtopics hierarchy
- [x] **Syllabus CRUD** — Create/edit syllabi with chapters and subtopics
- [x] **Bulk Import** — Import chapters/subtopics via structured text
- [x] **Syllabus Assignment** — Link syllabi to teaching assignments
- [x] **Progress Tracking** — Teachers mark subtopic completion status
- [x] **Teacher Syllabus View** — Teachers see their assigned syllabi and update progress
- [x] **Syllabus Reports** — Admin views completion percentages across assignments

### Phase 9: CSV Import
- [x] **Import Page** — Dedicated import page with 3 CSV upload sections:
  - Import Teachers (CSV with name, email, phone, employment type, etc.)
  - Import Teaching Assignments (CSV with teacher email, batch, subject, hours, dates)
  - Import Timetable Entries (CSV with batch, subject, teacher, classroom, day, time)
- [x] **Demo CSV Downloads** — Pre-built demo CSVs with real teacher emails for each import type

### Phase 10: Payroll
- [x] **Payroll Dashboard** — Admin view of teacher rates and monthly calculations
- [x] **Rate Setting** — Admin sets hourly rate per teacher
- [x] **PIN-based Security** — Admin sets up PIN for accessing payroll
- [x] **PIN Verification** — PIN required to view payroll data
- [x] **My Earnings** — Teacher view of their own earnings and class history

## Architecture: Timetable Generation Flow

```
User clicks "Generate with AI"
    ↓
Guided Questionnaire (5 questions)
    ↓
Preferences → Custom Prompt + Consecutive Slots Setting
    ↓
Phase 1: AI Day Planning
  - AI receives human-readable assignment list (names, not IDs)
  - AI only decides WHICH DAYS each assignment should happen
  - Output: [{"a":0,"d":[0,2]}, {"a":1,"d":[1,3]}]
    ↓
Phase 2: Deterministic Scheduler
  - For each (assignment, day): try consecutive block → smaller block → single slot
  - Hard constraints checked: teacher/batch/classroom not double-booked, availability, leaves, capacity
  - Same classroom for entire consecutive block
  - Fallback: if AI's day fails, try all other days
    ↓
Phase 3: Results
  - Entries (zero conflicts guaranteed) → auto-saved
  - Unscheduled items with reasons → shown to admin
```

## File Structure (Key Files)
```
prisma/
  schema.prisma          — Database models
  seed.ts                — Test data seeder

src/
  lib/
    db.ts                — Prisma client
    auth.ts              — NextAuth config
    utils.ts             — Auth helpers, constants
    ai/
      timetable-generator.ts — Hybrid AI + Algorithm timetable generation
      substitute-finder.ts   — AI substitute finding + assignment logic

  app/
    api/
      auth/[...nextauth]/route.ts
      dashboard/stats/route.ts
      centers/route.ts & [id]/route.ts
      subjects/route.ts & [id]/route.ts
      teachers/route.ts & [id]/route.ts
      classrooms/route.ts & [id]/route.ts
      batches/route.ts & [id]/route.ts
      time-slots/route.ts & [id]/route.ts
      availability/route.ts
      teaching-assignments/route.ts & [id]/route.ts
      timetable/generate/route.ts
      timetable/save/route.ts
      timetable/entries/route.ts & [id]/route.ts
      timetable/export-pdf/route.ts
      leaves/route.ts & [id]/route.ts
      leaves/[id]/approve/route.ts
      leaves/[id]/substitutes/route.ts & assign/route.ts
      leaves/quick-absence/route.ts
      classroom-availability/route.ts
      reports/utilization/route.ts
      settings/route.ts & test-ai/route.ts
      syllabus/route.ts & [id]/route.ts
      syllabus/[id]/chapters/route.ts & [chapterId]/route.ts
      syllabus/[id]/chapters/[chapterId]/subtopics/route.ts & [subtopicId]/route.ts
      syllabus/[id]/assignments/route.ts
      syllabus/[id]/bulk-import/route.ts
      syllabus/progress/route.ts & [progressId]/route.ts
      syllabus/reports/route.ts
      import/teachers/route.ts
      import/assignments/route.ts
      import/timetable/route.ts
      payroll/route.ts
      payroll/set-rate/route.ts
      payroll/setup-pin/route.ts
      payroll/verify-pin/route.ts
      my-earnings/route.ts

    (dashboard)/
      page.tsx                    — Dashboard
      centers/page.tsx
      subjects/page.tsx
      teachers/page.tsx
      teachers/[id]/availability/page.tsx
      teachers/[id]/syllabus/page.tsx
      classrooms/page.tsx
      batches/page.tsx
      teaching-assignments/page.tsx
      time-slots/page.tsx
      timetable/page.tsx
      timetable/manual/page.tsx
      leaves/page.tsx
      reports/page.tsx
      settings/page.tsx
      syllabus/page.tsx
      syllabus/[id]/page.tsx
      syllabus/my-progress/page.tsx
      import/page.tsx
      payroll/page.tsx
      my-earnings/page.tsx

  components/
    sidebar.tsx
    header.tsx
    modal.tsx
    auth-provider.tsx
```

## Login Credentials
- **Admin**: admin@schooltoppers.com / admin123
- **All Teachers**: [email] / teacher123

## Running
```bash
npm run dev        # Start dev server (port 3000)
npx tsx prisma/seed.ts  # Re-seed database
npx prisma db push      # Sync schema changes
```

---
*Last updated: March 8, 2026 — Added Hybrid AI+Algorithm timetable generation with consecutive slot scheduling, guided questionnaire, prominent batch/teacher filters, syllabus management, CSV import, payroll system*
