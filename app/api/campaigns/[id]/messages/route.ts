import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const messages = await prisma.message.findMany({
    where: { campaignId: id },
    orderBy: { createdAt: "asc" },
    select: { id: true, role: true, content: true },
  });
  return NextResponse.json(messages);
}
