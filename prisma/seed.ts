import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Clear existing data in reverse dependency order
  await prisma.teachingAssignment.deleteMany();
  await prisma.substituteAssignment.deleteMany();
  await prisma.leave.deleteMany();
  await prisma.timetableGeneration.deleteMany();
  await prisma.timetableEntry.deleteMany();
  await prisma.teacherAvailability.deleteMany();
  await prisma.batchSubject.deleteMany();
  await prisma.batch.deleteMany();
  await prisma.teacherSubject.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.classroom.deleteMany();
  await prisma.timeSlot.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.center.deleteMany();
  await prisma.user.deleteMany();

  console.log("Cleared existing data.");

  // ==================== USERS ====================
  const adminPassword = await hash("admin123", 12);
  const teacherPassword = await hash("teacher123", 12);

  const admin = await prisma.user.create({
    data: {
      name: "Admin",
      email: "admin@schooltoppers.com",
      password: adminPassword,
      role: "ADMIN",
      phone: "+91-9999999999",
    },
  });

  // --- 5 Senior Teachers (11th/12th - IIT-JEE, NEET, JEE Mains) ---
  // 2 Full-time, 3 Part-time
  const seniorTeacherData = [
    { name: "Dr. Rajesh Kumar",    email: "rajesh.kumar@schooltoppers.com",    phone: "+91-9876543201", employment: "FULL_TIME" as const },
    { name: "Prof. Sunita Verma",  email: "sunita.verma@schooltoppers.com",    phone: "+91-9876543202", employment: "FULL_TIME" as const },
    { name: "Amit Sharma",         email: "amit.sharma@schooltoppers.com",     phone: "+91-9876543203", employment: "PART_TIME" as const },
    { name: "Dr. Priya Nair",      email: "priya.nair@schooltoppers.com",      phone: "+91-9876543204", employment: "PART_TIME" as const },
    { name: "Vikram Singh",        email: "vikram.singh@schooltoppers.com",    phone: "+91-9876543205", employment: "PART_TIME" as const },
  ];

  // --- 5 Junior Teachers (8th/9th/10th) ---
  // 3 Full-time, 2 Part-time
  const juniorTeacherData = [
    { name: "Neha Gupta",          email: "neha.gupta@schooltoppers.com",      phone: "+91-9876543206", employment: "FULL_TIME" as const },
    { name: "Rahul Sharma",        email: "rahul.sharma@schooltoppers.com",    phone: "+91-9876543207", employment: "FULL_TIME" as const },
    { name: "Anjali Deshmukh",     email: "anjali.deshmukh@schooltoppers.com", phone: "+91-9876543208", employment: "FULL_TIME" as const },
    { name: "Sanjay Patil",        email: "sanjay.patil@schooltoppers.com",    phone: "+91-9876543209", employment: "PART_TIME" as const },
    { name: "Meera Joshi",         email: "meera.joshi@schooltoppers.com",     phone: "+91-9876543210", employment: "PART_TIME" as const },
  ];

  const allTeacherUsers = [];
  for (const t of [...seniorTeacherData, ...juniorTeacherData]) {
    const user = await prisma.user.create({
      data: {
        name: t.name,
        email: t.email,
        password: teacherPassword,
        role: "TEACHER",
        phone: t.phone,
      },
    });
    allTeacherUsers.push({ ...t, userId: user.id });
  }

  console.log("Created 10 teacher users + 1 admin.");

  // ==================== CENTERS ====================
  const manpada = await prisma.center.create({
    data: {
      id: "center-manpada",
      name: "Manpada Center",
      address: "Manpada, Thane West",
      phone: "+91-22-12345678",
    },
  });

  const station = await prisma.center.create({
    data: {
      id: "center-station",
      name: "Thane Station Center",
      address: "Near Thane Railway Station",
      phone: "+91-22-87654321",
    },
  });

  console.log("Created 2 centers: Manpada, Thane Station.");

  // ==================== SUBJECTS ====================
  const subPhysics = await prisma.subject.create({ data: { id: "sub-physics", name: "Physics", code: "PHY" } });
  const subChemistry = await prisma.subject.create({ data: { id: "sub-chemistry", name: "Chemistry", code: "CHE" } });
  const subMaths = await prisma.subject.create({ data: { id: "sub-maths", name: "Mathematics", code: "MAT" } });
  const subBiology = await prisma.subject.create({ data: { id: "sub-biology", name: "Biology", code: "BIO" } });
  const subEnglish = await prisma.subject.create({ data: { id: "sub-english", name: "English", code: "ENG" } });
  const subScience = await prisma.subject.create({ data: { id: "sub-science", name: "Science", code: "SCI" } });
  const subSST = await prisma.subject.create({ data: { id: "sub-sst", name: "Social Studies", code: "SST" } });

  console.log("Created 7 subjects.");

  // ==================== TEACHERS (profiles + subject assignments) ====================

  // Senior Teacher 1: Dr. Rajesh Kumar - Physics (Full-time) → RKP
  const tRajesh = await prisma.teacher.create({
    data: {
      userId: allTeacherUsers[0].userId,
      shortCode: "RKP",
      employmentType: "FULL_TIME",
      subjects: { create: [{ subjectId: subPhysics.id }] },
    },
  });

  // Senior Teacher 2: Prof. Sunita Verma - Chemistry (Full-time) → SVC
  const tSunita = await prisma.teacher.create({
    data: {
      userId: allTeacherUsers[1].userId,
      shortCode: "SVC",
      employmentType: "FULL_TIME",
      subjects: { create: [{ subjectId: subChemistry.id }] },
    },
  });

  // Senior Teacher 3: Amit Sharma - Maths (Part-time) → ASM
  const tAmit = await prisma.teacher.create({
    data: {
      userId: allTeacherUsers[2].userId,
      shortCode: "ASM",
      employmentType: "PART_TIME",
      subjects: { create: [{ subjectId: subMaths.id }] },
    },
  });

  // Senior Teacher 4: Dr. Priya Nair - Biology + Chemistry (Part-time) → PNB
  const tPriya = await prisma.teacher.create({
    data: {
      userId: allTeacherUsers[3].userId,
      shortCode: "PNB",
      employmentType: "PART_TIME",
      subjects: { create: [{ subjectId: subBiology.id }, { subjectId: subChemistry.id }] },
    },
  });

  // Senior Teacher 5: Vikram Singh - Physics + Maths (Part-time) → VSP
  const tVikram = await prisma.teacher.create({
    data: {
      userId: allTeacherUsers[4].userId,
      shortCode: "VSP",
      employmentType: "PART_TIME",
      subjects: { create: [{ subjectId: subPhysics.id }, { subjectId: subMaths.id }] },
    },
  });

  // Junior Teacher 1: Neha Gupta - Maths + Science (Full-time) → NGM
  const tNeha = await prisma.teacher.create({
    data: {
      userId: allTeacherUsers[5].userId,
      shortCode: "NGM",
      employmentType: "FULL_TIME",
      subjects: { create: [{ subjectId: subMaths.id }, { subjectId: subScience.id }] },
    },
  });

  // Junior Teacher 2: Rahul Sharma - Science + Physics (Full-time) → RSS
  const tRahul = await prisma.teacher.create({
    data: {
      userId: allTeacherUsers[6].userId,
      shortCode: "RSS",
      employmentType: "FULL_TIME",
      subjects: { create: [{ subjectId: subScience.id }, { subjectId: subPhysics.id }] },
    },
  });

  // Junior Teacher 3: Anjali Deshmukh - English + SST (Full-time) → ADE
  const tAnjali = await prisma.teacher.create({
    data: {
      userId: allTeacherUsers[7].userId,
      shortCode: "ADE",
      employmentType: "FULL_TIME",
      subjects: { create: [{ subjectId: subEnglish.id }, { subjectId: subSST.id }] },
    },
  });

  // Junior Teacher 4: Sanjay Patil - Maths + English (Part-time) → SPM
  const tSanjay = await prisma.teacher.create({
    data: {
      userId: allTeacherUsers[8].userId,
      shortCode: "SPM",
      employmentType: "PART_TIME",
      subjects: { create: [{ subjectId: subMaths.id }, { subjectId: subEnglish.id }] },
    },
  });

  // Junior Teacher 5: Meera Joshi - Science + SST (Part-time) → MJS
  const tMeera = await prisma.teacher.create({
    data: {
      userId: allTeacherUsers[9].userId,
      shortCode: "MJS",
      employmentType: "PART_TIME",
      subjects: { create: [{ subjectId: subScience.id }, { subjectId: subSST.id }] },
    },
  });

  console.log("Created 10 teacher profiles with subject assignments.");

  // ==================== CLASSROOMS ====================
  // Manpada: More rooms since more batches here
  const classrooms = [
    { id: "room-m1", name: "Room M1", capacity: 30, centerId: manpada.id, equipment: ["projector", "whiteboard"] },
    { id: "room-m2", name: "Room M2", capacity: 30, centerId: manpada.id, equipment: ["projector", "whiteboard"] },
    { id: "room-m3", name: "Room M3", capacity: 35, centerId: manpada.id, equipment: ["projector", "whiteboard", "ac"] },
    { id: "room-m4", name: "Room M4", capacity: 30, centerId: manpada.id, equipment: ["whiteboard"] },
    { id: "room-m5", name: "Lab M1", capacity: 25, centerId: manpada.id, equipment: ["projector", "whiteboard", "lab_equipment"] },
    { id: "room-s1", name: "Room S1", capacity: 30, centerId: station.id, equipment: ["projector", "whiteboard"] },
    { id: "room-s2", name: "Room S2", capacity: 30, centerId: station.id, equipment: ["projector", "whiteboard", "ac"] },
    { id: "room-s3", name: "Room S3", capacity: 35, centerId: station.id, equipment: ["whiteboard"] },
  ];

  for (const room of classrooms) {
    await prisma.classroom.create({ data: room });
  }

  console.log("Created 8 classrooms (5 Manpada, 3 Station).");

  // ==================== TIME SLOTS ====================
  // Senior batches (morning): 1.5 hour slots
  // Junior batches (evening): 1.5 hour slots
  const timeSlots = [
    // Morning slots (Senior - 11th/12th)
    { id: "slot-sr-1", startTime: "08:00", endTime: "09:30", label: "Morning 1 (8:00-9:30)", order: 1 },
    { id: "slot-sr-2", startTime: "09:45", endTime: "11:15", label: "Morning 2 (9:45-11:15)", order: 2 },
    { id: "slot-sr-3", startTime: "11:45", endTime: "13:15", label: "Morning 3 (11:45-1:15)", order: 3 },
    { id: "slot-sr-4", startTime: "13:30", endTime: "15:00", label: "Afternoon (1:30-3:00)", order: 4 },
    // Evening slots (Junior - 8th/9th/10th)
    { id: "slot-jr-1", startTime: "15:15", endTime: "16:45", label: "Evening 1 (3:15-4:45)", order: 5 },
    { id: "slot-jr-2", startTime: "17:00", endTime: "18:30", label: "Evening 2 (5:00-6:30)", order: 6 },
    { id: "slot-jr-3", startTime: "18:45", endTime: "20:15", label: "Evening 3 (6:45-8:15)", order: 7 },
  ];

  for (const slot of timeSlots) {
    await prisma.timeSlot.create({ data: slot });
  }

  console.log("Created 7 time slots (4 morning senior, 3 evening junior).");

  // ==================== BATCHES ====================
  // Strength: 25-27 students per batch

  // --- IIT-JEE Batches (2 Manpada, 1 Station) ---
  const bJee1 = await prisma.batch.create({
    data: { id: "batch-jee-m1", name: "IIT-JEE Batch A (Manpada)", batchType: "IIT_JEE", centerId: manpada.id, strength: 25, status: "ACTIVE" },
  });
  const bJee2 = await prisma.batch.create({
    data: { id: "batch-jee-m2", name: "IIT-JEE Batch B (Manpada)", batchType: "IIT_JEE", centerId: manpada.id, strength: 27, status: "ACTIVE" },
  });
  const bJee3 = await prisma.batch.create({
    data: { id: "batch-jee-s1", name: "IIT-JEE Batch A (Station)", batchType: "IIT_JEE", centerId: station.id, strength: 26, status: "ACTIVE" },
  });

  // --- JEE Mains Batches (2 Manpada, 1 Station) ---
  const bMains1 = await prisma.batch.create({
    data: { id: "batch-mains-m1", name: "JEE Mains Batch A (Manpada)", batchType: "JEE_MAINS", centerId: manpada.id, strength: 27, status: "ACTIVE" },
  });
  const bMains2 = await prisma.batch.create({
    data: { id: "batch-mains-m2", name: "JEE Mains Batch B (Manpada)", batchType: "JEE_MAINS", centerId: manpada.id, strength: 25, status: "ACTIVE" },
  });
  const bMains3 = await prisma.batch.create({
    data: { id: "batch-mains-s1", name: "JEE Mains Batch A (Station)", batchType: "JEE_MAINS", centerId: station.id, strength: 26, status: "ACTIVE" },
  });

  // --- NEET Batches (3 Manpada, 2 Station) ---
  const bNeet1 = await prisma.batch.create({
    data: { id: "batch-neet-m1", name: "NEET Batch A (Manpada)", batchType: "NEET", centerId: manpada.id, strength: 27, status: "ACTIVE" },
  });
  const bNeet2 = await prisma.batch.create({
    data: { id: "batch-neet-m2", name: "NEET Batch B (Manpada)", batchType: "NEET", centerId: manpada.id, strength: 25, status: "ACTIVE" },
  });
  const bNeet3 = await prisma.batch.create({
    data: { id: "batch-neet-m3", name: "NEET Batch C (Manpada)", batchType: "NEET", centerId: manpada.id, strength: 26, status: "ACTIVE" },
  });
  const bNeet4 = await prisma.batch.create({
    data: { id: "batch-neet-s1", name: "NEET Batch A (Station)", batchType: "NEET", centerId: station.id, strength: 25, status: "ACTIVE" },
  });
  const bNeet5 = await prisma.batch.create({
    data: { id: "batch-neet-s2", name: "NEET Batch B (Station)", batchType: "NEET", centerId: station.id, strength: 27, status: "ACTIVE" },
  });

  // --- Junior Batches (8th, 9th, 10th) ---
  // Adding some junior batches for the junior teachers
  const b8th1 = await prisma.batch.create({
    data: { id: "batch-8th-m1", name: "8th Standard (Manpada)", batchType: "SCHOOL_8TH", centerId: manpada.id, strength: 25, status: "ACTIVE" },
  });
  const b9th1 = await prisma.batch.create({
    data: { id: "batch-9th-m1", name: "9th Standard (Manpada)", batchType: "SCHOOL_9TH", centerId: manpada.id, strength: 26, status: "ACTIVE" },
  });
  const b10th1 = await prisma.batch.create({
    data: { id: "batch-10th-m1", name: "10th Standard (Manpada)", batchType: "SCHOOL_10TH", centerId: manpada.id, strength: 27, status: "ACTIVE" },
  });
  const b10th2 = await prisma.batch.create({
    data: { id: "batch-10th-s1", name: "10th Standard (Station)", batchType: "SCHOOL_10TH", centerId: station.id, strength: 25, status: "ACTIVE" },
  });

  console.log("Created 15 batches: 3 JEE, 3 Mains, 5 NEET, 1 8th, 1 9th, 2 10th.");

  // ==================== BATCH-SUBJECT ASSIGNMENTS ====================
  // IIT-JEE: Physics, Chemistry, Maths (each ~6 hrs/week = 4 slots of 1.5h)
  const jeeBatches = [bJee1, bJee2, bJee3];
  for (const b of jeeBatches) {
    await prisma.batchSubject.createMany({
      data: [
        { batchId: b.id, subjectId: subPhysics.id, hoursPerWeek: 6 },
        { batchId: b.id, subjectId: subChemistry.id, hoursPerWeek: 6 },
        { batchId: b.id, subjectId: subMaths.id, hoursPerWeek: 8 },
      ],
    });
  }

  // JEE Mains: Physics, Chemistry, Maths (slightly less intensive)
  const mainsBatches = [bMains1, bMains2, bMains3];
  for (const b of mainsBatches) {
    await prisma.batchSubject.createMany({
      data: [
        { batchId: b.id, subjectId: subPhysics.id, hoursPerWeek: 5 },
        { batchId: b.id, subjectId: subChemistry.id, hoursPerWeek: 5 },
        { batchId: b.id, subjectId: subMaths.id, hoursPerWeek: 6 },
      ],
    });
  }

  // NEET: Physics, Chemistry, Biology
  const neetBatches = [bNeet1, bNeet2, bNeet3, bNeet4, bNeet5];
  for (const b of neetBatches) {
    await prisma.batchSubject.createMany({
      data: [
        { batchId: b.id, subjectId: subPhysics.id, hoursPerWeek: 5 },
        { batchId: b.id, subjectId: subChemistry.id, hoursPerWeek: 5 },
        { batchId: b.id, subjectId: subBiology.id, hoursPerWeek: 6 },
      ],
    });
  }

  // Junior batches: Maths, Science, English, SST
  const juniorBatches = [b8th1, b9th1, b10th1, b10th2];
  for (const b of juniorBatches) {
    await prisma.batchSubject.createMany({
      data: [
        { batchId: b.id, subjectId: subMaths.id, hoursPerWeek: 5 },
        { batchId: b.id, subjectId: subScience.id, hoursPerWeek: 5 },
        { batchId: b.id, subjectId: subEnglish.id, hoursPerWeek: 3 },
        { batchId: b.id, subjectId: subSST.id, hoursPerWeek: 3 },
      ],
    });
  }

  console.log("Created batch-subject assignments for all 15 batches.");

  // ==================== TEACHER AVAILABILITY ====================
  // We store ALL slots for each teacher, marking available/unavailable explicitly.
  // Full-time teachers: Available 8:00 AM - 8:15 PM (all 7 slots), Mon-Sat
  // Part-time teachers: Available only specific hours on specific days

  const allSlots = [
    { start: "08:00", end: "09:30" },   // Slot 1 - Morning 1
    { start: "09:45", end: "11:15" },   // Slot 2 - Morning 2
    { start: "11:45", end: "13:15" },   // Slot 3 - Morning 3
    { start: "13:30", end: "15:00" },   // Slot 4 - Afternoon
    { start: "15:15", end: "16:45" },   // Slot 5 - Evening 1
    { start: "17:00", end: "18:30" },   // Slot 6 - Evening 2
    { start: "18:45", end: "20:15" },   // Slot 7 - Evening 3
  ];

  // Helper to create availability for a teacher
  async function setAvailability(teacherId: string, days: number[], availableSlotIndices: number[]) {
    for (let day = 0; day < 6; day++) {
      for (let si = 0; si < allSlots.length; si++) {
        const slot = allSlots[si];
        const isAvailable = days.includes(day) && availableSlotIndices.includes(si);
        await prisma.teacherAvailability.create({
          data: { teacherId, dayOfWeek: day, startTime: slot.start, endTime: slot.end, isAvailable },
        });
      }
    }
  }

  // --- SENIOR TEACHERS ---

  // Dr. Rajesh Kumar (Full-time Senior, Physics)
  // Available Mon-Sat, 8:00 AM - 3:00 PM (all 4 morning slots)
  await setAvailability(tRajesh.id, [0, 1, 2, 3, 4, 5], [0, 1, 2, 3]);

  // Prof. Sunita Verma (Full-time Senior, Chemistry)
  // Available Mon-Sat, 8:00 AM - 3:00 PM (all 4 morning slots)
  await setAvailability(tSunita.id, [0, 1, 2, 3, 4, 5], [0, 1, 2, 3]);

  // Amit Sharma (Part-time Senior, Maths)
  // Comes at 11:30 AM, available till 8:15 PM. Only Mon, Wed, Fri.
  // Available slots: 3 (11:45-1:15), 4 (1:30-3:00), 5 (3:15-4:45), 6 (5:00-6:30), 7 (6:45-8:15)
  await setAvailability(tAmit.id, [0, 2, 4], [2, 3, 4, 5, 6]);

  // Dr. Priya Nair (Part-time Senior, Biology+Chemistry)
  // Comes at 11:30 AM, available till 6:30 PM. Only Tue, Thu, Sat.
  // Available slots: 3 (11:45-1:15), 4 (1:30-3:00), 5 (3:15-4:45), 6 (5:00-6:30)
  await setAvailability(tPriya.id, [1, 3, 5], [2, 3, 4, 5]);

  // Vikram Singh (Part-time Senior, Physics+Maths)
  // Comes at 9:45 AM, available till 6:30 PM. Mon-Thu only.
  // Available slots: 2 (9:45-11:15), 3 (11:45-1:15), 4 (1:30-3:00), 5 (3:15-4:45), 6 (5:00-6:30)
  await setAvailability(tVikram.id, [0, 1, 2, 3], [1, 2, 3, 4, 5]);

  // --- JUNIOR TEACHERS ---

  // Neha Gupta (Full-time Junior, Maths+Science)
  // Available Mon-Sat, 3:15 PM - 8:15 PM (all 3 evening slots)
  await setAvailability(tNeha.id, [0, 1, 2, 3, 4, 5], [4, 5, 6]);

  // Rahul Sharma (Full-time Junior, Science+Physics)
  // Available Mon-Sat, 3:15 PM - 8:15 PM (all 3 evening slots)
  await setAvailability(tRahul.id, [0, 1, 2, 3, 4, 5], [4, 5, 6]);

  // Anjali Deshmukh (Full-time Junior, English+SST)
  // Available Mon-Sat, 3:15 PM - 8:15 PM (all 3 evening slots)
  await setAvailability(tAnjali.id, [0, 1, 2, 3, 4, 5], [4, 5, 6]);

  // Sanjay Patil (Part-time Junior, Maths+English)
  // Available 5:00 PM - 8:15 PM, only Mon, Wed, Fri.
  // Available slots: 6 (5:00-6:30), 7 (6:45-8:15)
  await setAvailability(tSanjay.id, [0, 2, 4], [5, 6]);

  // Meera Joshi (Part-time Junior, Science+SST)
  // Available 5:00 PM - 8:15 PM, only Tue, Thu, Sat.
  // Available slots: 6 (5:00-6:30), 7 (6:45-8:15)
  await setAvailability(tMeera.id, [1, 3, 5], [5, 6]);

  console.log("Created teacher availability for all 10 teachers (all slots, available+unavailable).");

  // ==================== TEACHING ASSIGNMENTS ====================
  // These define: which teacher teaches which subject for which batch,
  // how many total hours are needed to complete the syllabus, and the date range.
  // System calculates weekly slots needed based on duration and total hours.

  const assignmentStart = new Date("2026-03-01");
  const assignmentEnd = new Date("2026-08-31");

  const teachingAssignments = [
    // --- SENIOR TEACHERS → JEE/NEET/MAINS BATCHES ---

    // Dr. Rajesh Kumar (RKP) - Physics
    { teacherId: tRajesh.id, batchId: bJee1.id, subjectId: subPhysics.id, totalHours: 300, notes: "IIT-JEE Advanced Physics" },
    { teacherId: tRajesh.id, batchId: bJee2.id, subjectId: subPhysics.id, totalHours: 300, notes: "IIT-JEE Advanced Physics" },
    { teacherId: tRajesh.id, batchId: bNeet1.id, subjectId: subPhysics.id, totalHours: 200, notes: "NEET Physics" },
    { teacherId: tRajesh.id, batchId: bNeet2.id, subjectId: subPhysics.id, totalHours: 200, notes: "NEET Physics" },

    // Prof. Sunita Verma (SVC) - Chemistry
    { teacherId: tSunita.id, batchId: bJee1.id, subjectId: subChemistry.id, totalHours: 280, notes: "IIT-JEE Chemistry" },
    { teacherId: tSunita.id, batchId: bJee2.id, subjectId: subChemistry.id, totalHours: 280, notes: "IIT-JEE Chemistry" },
    { teacherId: tSunita.id, batchId: bMains1.id, subjectId: subChemistry.id, totalHours: 200, notes: "JEE Mains Chemistry" },
    { teacherId: tSunita.id, batchId: bMains2.id, subjectId: subChemistry.id, totalHours: 200, notes: "JEE Mains Chemistry" },

    // Amit Sharma (ASM) - Maths (Part-time)
    { teacherId: tAmit.id, batchId: bJee1.id, subjectId: subMaths.id, totalHours: 350, notes: "IIT-JEE Advanced Maths - high priority" },
    { teacherId: tAmit.id, batchId: bJee3.id, subjectId: subMaths.id, totalHours: 350, notes: "IIT-JEE Station Maths" },
    { teacherId: tAmit.id, batchId: bMains1.id, subjectId: subMaths.id, totalHours: 250, notes: "JEE Mains Maths" },

    // Dr. Priya Nair (PNB) - Biology + Chemistry (Part-time)
    { teacherId: tPriya.id, batchId: bNeet1.id, subjectId: subBiology.id, totalHours: 280, notes: "NEET Biology" },
    { teacherId: tPriya.id, batchId: bNeet2.id, subjectId: subBiology.id, totalHours: 280, notes: "NEET Biology" },
    { teacherId: tPriya.id, batchId: bNeet3.id, subjectId: subBiology.id, totalHours: 280, notes: "NEET Biology" },
    { teacherId: tPriya.id, batchId: bNeet4.id, subjectId: subChemistry.id, totalHours: 200, notes: "NEET Station Chemistry" },

    // Vikram Singh (VSP) - Physics + Maths (Part-time)
    { teacherId: tVikram.id, batchId: bJee3.id, subjectId: subPhysics.id, totalHours: 300, notes: "IIT-JEE Station Physics" },
    { teacherId: tVikram.id, batchId: bMains3.id, subjectId: subPhysics.id, totalHours: 200, notes: "JEE Mains Station Physics" },
    { teacherId: tVikram.id, batchId: bMains3.id, subjectId: subMaths.id, totalHours: 250, notes: "JEE Mains Station Maths" },
    { teacherId: tVikram.id, batchId: bNeet3.id, subjectId: subPhysics.id, totalHours: 200, notes: "NEET Manpada C Physics" },

    // --- JUNIOR TEACHERS → SCHOOL BATCHES ---

    // Neha Gupta (NGM) - Maths + Science
    { teacherId: tNeha.id, batchId: b8th1.id, subjectId: subMaths.id, totalHours: 180, notes: "8th Maths" },
    { teacherId: tNeha.id, batchId: b9th1.id, subjectId: subMaths.id, totalHours: 200, notes: "9th Maths" },
    { teacherId: tNeha.id, batchId: b10th1.id, subjectId: subScience.id, totalHours: 200, notes: "10th Science" },

    // Rahul Sharma (RSS) - Science + Physics
    { teacherId: tRahul.id, batchId: b8th1.id, subjectId: subScience.id, totalHours: 180, notes: "8th Science" },
    { teacherId: tRahul.id, batchId: b9th1.id, subjectId: subScience.id, totalHours: 200, notes: "9th Science" },
    { teacherId: tRahul.id, batchId: b10th2.id, subjectId: subScience.id, totalHours: 200, notes: "10th Station Science" },

    // Anjali Deshmukh (ADE) - English + SST
    { teacherId: tAnjali.id, batchId: b8th1.id, subjectId: subEnglish.id, totalHours: 120, notes: "8th English" },
    { teacherId: tAnjali.id, batchId: b9th1.id, subjectId: subEnglish.id, totalHours: 120, notes: "9th English" },
    { teacherId: tAnjali.id, batchId: b10th1.id, subjectId: subSST.id, totalHours: 150, notes: "10th SST" },
    { teacherId: tAnjali.id, batchId: b10th2.id, subjectId: subSST.id, totalHours: 150, notes: "10th Station SST" },

    // Sanjay Patil (SPM) - Maths + English (Part-time)
    { teacherId: tSanjay.id, batchId: b10th1.id, subjectId: subMaths.id, totalHours: 200, notes: "10th Maths" },
    { teacherId: tSanjay.id, batchId: b10th2.id, subjectId: subEnglish.id, totalHours: 120, notes: "10th Station English" },

    // Meera Joshi (MJS) - Science + SST (Part-time)
    { teacherId: tMeera.id, batchId: b8th1.id, subjectId: subSST.id, totalHours: 120, notes: "8th SST" },
    { teacherId: tMeera.id, batchId: b9th1.id, subjectId: subSST.id, totalHours: 120, notes: "9th SST" },
    { teacherId: tMeera.id, batchId: b10th2.id, subjectId: subMaths.id, totalHours: 200, notes: "10th Station Maths" },
  ];

  for (const a of teachingAssignments) {
    await prisma.teachingAssignment.create({
      data: {
        teacherId: a.teacherId,
        batchId: a.batchId,
        subjectId: a.subjectId,
        totalHours: a.totalHours,
        startDate: assignmentStart,
        endDate: assignmentEnd,
        completedHours: 0,
        notes: a.notes,
      },
    });
  }

  console.log(`Created ${teachingAssignments.length} teaching assignments.`);

  // ==================== SUMMARY ====================
  console.log("\n========== SEED COMPLETE ==========");
  console.log("Login credentials (all teachers use password: teacher123):");
  console.log("  Admin:  admin@schooltoppers.com / admin123");
  console.log("\nSenior Teachers (11th/12th):");
  console.log("  Dr. Rajesh Kumar (Full-time, Physics) - rajesh.kumar@schooltoppers.com");
  console.log("  Prof. Sunita Verma (Full-time, Chemistry) - sunita.verma@schooltoppers.com");
  console.log("  Amit Sharma (Part-time, Maths) - amit.sharma@schooltoppers.com");
  console.log("  Dr. Priya Nair (Part-time, Biology+Chemistry) - priya.nair@schooltoppers.com");
  console.log("  Vikram Singh (Part-time, Physics+Maths) - vikram.singh@schooltoppers.com");
  console.log("\nJunior Teachers (8th/9th/10th):");
  console.log("  Neha Gupta (Full-time, Maths+Science) - neha.gupta@schooltoppers.com");
  console.log("  Rahul Sharma (Full-time, Science+Physics) - rahul.sharma@schooltoppers.com");
  console.log("  Anjali Deshmukh (Full-time, English+SST) - anjali.deshmukh@schooltoppers.com");
  console.log("  Sanjay Patil (Part-time, Maths+English) - sanjay.patil@schooltoppers.com");
  console.log("  Meera Joshi (Part-time, Science+SST) - meera.joshi@schooltoppers.com");
  console.log("\nBatches: 3 JEE + 3 Mains + 5 NEET + 4 Junior = 15 total");
  console.log("Classrooms: 5 Manpada + 3 Station = 8 total");
  console.log("Time Slots: 4 morning (senior) + 3 evening (junior) = 7 total");
  console.log("===================================\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
