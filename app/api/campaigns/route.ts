import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { updatedAt: "desc" },
    select: { id: true, name: true, model: true, initialized: true, createdAt: true, updatedAt: true },
  });
  return NextResponse.json(campaigns);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const campaign = await prisma.campaign.create({
    data: {
      name: body.name ?? "Nova Campanha",
      model: body.model ?? null,
    },
  });
  return NextResponse.json(campaign, { status: 201 });
}
