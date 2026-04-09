import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    select: { characterSheet: true },
  });

  if (!campaign?.characterSheet) {
    return new NextResponse(null, { status: 404 });
  }

  try {
    return NextResponse.json(JSON.parse(campaign.characterSheet));
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
