import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/connectDB";
import { Mission } from "@/models/mission";
import { User } from "@/models/user";
import { verifyJWT } from "@/utils/verifyJWT";
import { Route } from "@/models/routes";


export async function GET(req: NextRequest) {
	try {
		const tokenPayload = verifyJWT(req);

		if (!tokenPayload) {
			return NextResponse.json(
				{ success: false, message: "Authentication required" },
				{ status: 401 }
			);
		}

		if (!tokenPayload.roles.includes("driver")) {
			return NextResponse.json(
				{ success: false, message: "Only drivers can view their missions" },
				{ status: 403 }
			);
		}

		await connectDB();

		const driver = await User.findOne({
			_id: tokenPayload.sub,
			isActive: true,
			roles: "driver",
			"driverProfile.truckNo": { $exists: true, $ne: "" },
		}).select("driverProfile.truckNo").lean();

		if (!driver?.driverProfile?.truckNo) {
			return NextResponse.json(
				{ success: false, message: "No truck is assigned to this driver" },
				{ status: 404 }
			);
		}

		const missions = await Mission.find({
			truckNo: driver.driverProfile.truckNo,
		}).sort({ targetArrival: 1 }).lean();

		const route = await Route.findOne({
			missionId: missions[0]?.missionId,
			status: "ACTIVE",
		}).lean();

		return NextResponse.json({
			success: true,
			truckNo: driver.driverProfile.truckNo,
			missions,
			route,
		});
	} catch (error) {
		console.error("Get driver missions error:", error);

		return NextResponse.json(
			{ success: false, message: "Something went wrong while fetching missions" },
			{ status: 500 }
		);
	}
}