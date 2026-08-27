import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/connectDB";
import { Incident } from "@/models/incident";
import generateID from "@/utils/generateID";
import { verifyJWT } from "@/utils/verifyJWT";
import { rerouteRoutesForIncident } from "@/lib/rerouteActiveRoutes";

const reportIncidentSchema = z.object({
	type: z.enum([
		"LANDSLIDE",
		"FLOOD",
		"ROAD_BLOCK",
		"ROAD_DAMAGE",
		"BRIDGE_DAMAGE",
		"ACCIDENT",
		"TRAFFIC",
		"OTHER",
	]),
	severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
	location: z.object({
		coordinates: z.tuple([
			z.number().finite().min(-180).max(180),
			z.number().finite().min(-90).max(90),
		]),
	}),
	description: z.string().trim().max(2000).optional(),
	missionId: z.string().trim().min(1).optional(), // if the driver reports the incident, if normal user does then not needed
	imgUrl: z.string().trim().url().optional(),
	truckNo: z.string().trim().min(1).optional(),
	occurredAt: z.coerce.date(),
});

export async function POST(req: NextRequest) {
	try {
		if (!verifyJWT(req)) {
			return NextResponse.json(
				{ success: false, message: "Authentication required" },
				{ status: 401 }
			);
		}

		const body = await req.json();
		const parsed = reportIncidentSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json(
				{ success: false, message: "Validation failed", errors: parsed.error.flatten() },
				{ status: 400 }
			);
		}

		await connectDB();

		const incident = await Incident.create({
			...parsed.data,
			incidentId: generateID("I"),
			location: {
				type: "Point",
				coordinates: parsed.data.location.coordinates,
			},
			source: "FIELD_REPORT",
			status: "ACTIVE",
		});

		let reroute: unknown = { affectedMissionCount: 0, missions: [] };
		try {
			reroute = await rerouteRoutesForIncident(incident.incidentId);
		} catch (error) {
			console.error("Reroute active routes error:", error);
			reroute = {
				success: false,
				message: "Incident saved, but affected routes could not be recalculated",
			};
		}

		return NextResponse.json(
			{ success: true, message: "Incident reported successfully", incident, reroute },
			{ status: 201 }
		);
	} catch (error) {
		console.error("Report incident error:", error);

		return NextResponse.json(
			{ success: false, message: "Something went wrong while reporting the incident" },
			{ status: 500 }
		);
	}
}
