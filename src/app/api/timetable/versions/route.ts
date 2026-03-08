import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/utils";
import { BatchType } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const weekStart = req.nextUrl.searchParams.get("weekStart");
  if (!weekStart) {
    return NextResponse.json({ error: "weekStart is required" }, { status: 400 });
  }

  const versions = await prisma.timetableGeneration.findMany({
    where: { weekStart: new Date(weekStart) },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(versions);
}

// Set a version as active
export async function PUT(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { versionId } = body;

  if (!versionId) {
    return NextResponse.json({ error: "versionId is required" }, { status: 400 });
  }

  const version = await prisma.timetableGeneration.findUnique({
    where: { id: versionId },
  });
  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const SENIOR_BATCH_TYPES: BatchType[] = [BatchType.IIT_JEE, BatchType.JEE_MAINS, BatchType.NEET];

  // Build batch type filter for the scope
  const batchTypeFilter = version.scope === "senior"
    ? { batch: { batchType: { in: SENIOR_BATCH_TYPES } } }
    : version.scope === "junior"
      ? { batch: { batchType: { notIn: SENIOR_BATCH_TYPES } } }
      : {};

  // Deactivate all entries for this week + scope
  await prisma.timetableEntry.updateMany({
    where: { weekStart: version.weekStart, isActive: true, ...batchTypeFilter },
    data: { isActive: false },
  });

  // Activate the selected version's entries
  await prisma.timetableEntry.updateMany({
    where: { versionId, weekStart: version.weekStart },
    data: { isActive: true },
  });

  // Update generation records
  await prisma.timetableGeneration.updateMany({
    where: {
      weekStart: version.weekStart,
      isActive: true,
      ...(version.scope ? { scope: version.scope } : {}),
    },
    data: { isActive: false },
  });

  await prisma.timetableGeneration.update({
    where: { id: versionId },
    data: { isActive: true },
  });

  return NextResponse.json({ success: true });
}

// Delete a version
export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const versionId = req.nextUrl.searchParams.get("versionId");
  if (!versionId) {
    return NextResponse.json({ error: "versionId is required" }, { status: 400 });
  }

  const version = await prisma.timetableGeneration.findUnique({
    where: { id: versionId },
  });
  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  if (version.isActive) {
    return NextResponse.json({ error: "Cannot delete the active version. Set another version as active first." }, { status: 400 });
  }

  // Delete the version's entries and the version record
  await prisma.timetableEntry.deleteMany({
    where: { versionId },
  });
  await prisma.timetableGeneration.delete({
    where: { id: versionId },
  });

  return NextResponse.json({ success: true });
}
