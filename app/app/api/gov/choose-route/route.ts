
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/connectDB";
import { Route } from "@/models/routes";
import generateID from "@/utils/generateID";

const chooseRouteSchema = z.object({
  routeId: z.string().trim().min(1).optional(),
  missionId: z.string().trim().min(1),
  truckNo: z.string().trim().min(1),
  geometry: z.object({
    type: z.literal("LineString"),
    coordinates: z.array(
      z.tuple([
        z.number().finite().min(-180).max(180),
        z.number().finite().min(-90).max(90),
      ])
    ).min(2),
  }),
  distanceMeters: z.number().finite().nonnegative(),
  durationSeconds: z.number().finite().nonnegative(),
  riskScore: z.number().finite().min(0).max(100),
  status: z.enum(["ACTIVE", "SUPERSEDED", "BLOCKED", "COMPLETED"]),
  triggeredByIncidentId: z.string().trim().min(1).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = chooseRouteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, message: "Validation failed", errors: parsed.error.flatten() },
        { status: 400 }
      );
    }
  
    await connectDB();

    const route = await Route.create({
      ...parsed.data,
      routeId: parsed.data.routeId ?? generateID("R"),
      routeVersion: 1,
    });

    return NextResponse.json(
      { success: true, message: "Route selected successfully", route },
      { status: 201 }
    );
  } catch (error) {
    console.error("Choose route error:", error);

    return NextResponse.json(
      { success: false, message: "Something went wrong while saving the route" },
      { status: 500 }
    );
  }
}