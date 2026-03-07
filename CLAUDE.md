# School Toppers - Smart Timetable System

## Project Overview
Automated timetable management system for "School Toppers" coaching institute. Handles timetable generation using Claude AI, teacher availability, leave management, and substitute assignment.

## Tech Stack
- **Framework**: Next.js 16 (App Router, `src/` directory)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL + Prisma ORM v5
- **Auth**: NextAuth.js v4 (credentials provider, JWT, role-based: ADMIN/TEACHER)
- **AI**: Claude API via `@anthropic-ai/sdk`

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

### Phase 4: AI Timetable Generation
- [x] **Settings Page** — Store Claude API key
- [x] **AI Integration** — Claude API generates timetable from constraints
  - Sends all teachers, batches, classrooms, time slots, availability, and teaching assignments
  - Hard constraints: no double-booking, capacity checks, availability checks, center matching
  - Includes classroom availability restrictions and teacher leave data
  - Soft constraints: workload balance, subject distribution, gap minimization
  - Validates generated entries against all constraints including classroom blocks and leaves
  - Reports conflicts
- [x] **Timetable Generation Page** — Select week/center, generate, preview, save
- [x] **Timetable View** — Weekly grid with day columns and time slot rows
  - Substituted entries: amber background, original teacher struck through, "Sub: [name]" shown
  - Cancelled entries: red background with strikethrough
  - Stats bar showing scheduled/substituted/cancelled counts
  - Legend for color coding
- [x] **Manual Entry Management** — Edit/delete individual timetable entries with conflict checking
- [x] **Classroom Availability** — Block classrooms for specific dates/times
  - Classroom page has "Availability Blocks" tab to manage blocks
  - Blocks are fed to AI timetable generator as constraints

### Phase 5: Leave Management & Substitution
- [x] **Leave Application** — Teachers apply for leaves (sick, casual, emergency, planned)
- [x] **Leave Approval** — Admin reviews and approves/rejects; auto-triggers substitute finding on approval
- [x] **Affected Classes Preview** — Shows which classes are impacted by a leave
- [x] **AI Substitute Suggestions** — Claude AI suggests best substitute teachers
- [x] **Substitute Assignment** — Assign substitutes with "Assign" buttons per entry
  - Subject qualification check, double-booking prevention
  - Creates SubstituteAssignment record + updates TimetableEntry status to SUBSTITUTED
  - "Auto-Assign All" button to assign top AI suggestion for every affected entry
- [x] **Quick Absence** — One-click absence handler (admin only)
  - Select teacher + date → auto-creates leave, finds subs with AI, assigns them automatically
  - Shows results: which classes got substitutes, which couldn't be covered

### Phase 6: Reports
- [x] **Faculty Utilization Report** — Hours assigned vs available per teacher

### Phase 7: Teaching Assignments (NEW)
- [x] **Teaching Assignment Model** — Teacher + Batch + Subject + Total Hours + Date Range
- [x] **Weekly Slot Calculator** — Auto-calculates how many weekly slots each teacher needs
- [x] **Teaching Assignments Page** — Full CRUD with teacher filter cards
  - Summary cards per teacher showing total slots/week and batches
  - Progress bar for completed vs total hours
  - Duration display with weeks calculation
  - Weekly plan (slots/wk needed, hours/wk needed)
- [x] **API Routes** — GET/POST/PUT/DELETE for teaching assignments
- [x] **Timetable Integration** — Teaching assignments fed to AI generator as constraints
- [x] **Seed Data** — 34 realistic assignments for all 10 teachers

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
      timetable-generator.ts — Claude AI timetable generation
      substitute-finder.ts   — AI substitute finding + assignment logic

  app/
    api/
      centers/route.ts
      subjects/route.ts
      teachers/route.ts & [id]/route.ts
      classrooms/route.ts & [id]/route.ts
      batches/route.ts & [id]/route.ts
      time-slots/route.ts
      availability/route.ts
      teaching-assignments/route.ts & [id]/route.ts
      timetable/generate/route.ts
      timetable/save/route.ts
      timetable/entries/route.ts & [id]/route.ts
      leaves/route.ts & [id]/route.ts
      leaves/[id]/substitutes/assign/route.ts
      leaves/quick-absence/route.ts
      classroom-availability/route.ts
      reports/utilization/route.ts
      settings/route.ts

    (dashboard)/
      page.tsx                    — Dashboard
      centers/page.tsx
      subjects/page.tsx
      teachers/page.tsx
      teachers/[id]/availability/page.tsx
      classrooms/page.tsx
      batches/page.tsx
      teaching-assignments/page.tsx
      time-slots/page.tsx
      timetable/page.tsx
      leaves/page.tsx
      reports/page.tsx
      settings/page.tsx

  components/
    sidebar.tsx
    header.tsx
    modal.tsx
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
*Last updated: March 7, 2026 — Added Auto-Recalibration, Quick Absence, Classroom Availability, Substitute Assignment*
