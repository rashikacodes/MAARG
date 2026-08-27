import { findRoute } from "@/lib/findGeometry";
import { connectDB } from "@/lib/connectDB";
import { Incident, IIncident } from "@/models/incident";
import { Mission } from "@/models/mission";
import { Route } from "@/models/routes";
import generateID from "@/utils/generateID";

const ROUTE_MATCH_RADIUS_METERS = 500;
const MAX_ALTERNATIVES = 3;

type Coordinate = [number, number];

type CandidateRoute = {
  routeId: string;
  geometry: {
    type: "LineString";
    coordinates: Coordinate[];
  };
  distanceMeters: number;
  durationSeconds: number;
};

type MLRouteResult = {
  route_id: string;
  disruption_risk: number;
  risk_band: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
};

function extractCandidates(raw: unknown): CandidateRoute[] {
  const response = raw as {
    trip?: Record<string, unknown>;
    alternates?: Array<{ trip?: Record<string, unknown> }>;
  };
  const trips = [
    response.trip,
    ...(response.alternates ?? []).map((alternate) => alternate.trip),
  ].filter((trip): trip is Record<string, unknown> => Boolean(trip));

  return trips.slice(0, MAX_ALTERNATIVES).map((trip, index) => {
    const geometry = trip.geometry as { coordinates?: unknown } | undefined;
    const coordinates = geometry?.coordinates;

    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      throw new Error(`Mappls route ${index + 1} has no usable GeoJSON geometry`);
    }

    const normalizedCoordinates = coordinates.map((coordinate) => {
      if (
        !Array.isArray(coordinate) ||
        coordinate.length < 2 ||
        typeof coordinate[0] !== "number" ||
        typeof coordinate[1] !== "number"
      ) {
        throw new Error(`Mappls route ${index + 1} contains invalid coordinates`);
      }
      return [coordinate[0], coordinate[1]] as Coordinate;
    });

    const summary = (trip.summary ?? {}) as {
      length?: unknown;
      time?: unknown;
    };

    return {
      routeId: index === 0 ? "primary" : `alternative_${index}`,
      geometry: { type: "LineString", coordinates: normalizedCoordinates },
      distanceMeters: Number(summary.length ?? 0),
      durationSeconds: Number(summary.time ?? 0),
    };
  });
}

async function scoreCandidates(
  incident: IIncident,
  candidates: CandidateRoute[]
): Promise<MLRouteResult[]> {
  const mlUrl = process.env.ML_SERVICE_URL ?? "http://localhost:8001";
  const response = await fetch(`${mlUrl}/predict/reroute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      incident: {
        incident_id: incident.incidentId,
        type: incident.type,
        severity: incident.severity,
        location: incident.location,
        occurred_at: incident.occurredAt.toISOString(),
      },
      routes: candidates,
    }),
  });

  if (!response.ok) {
    throw new Error(`ML reroute request failed with status ${response.status}`);
  }

  const data = (await response.json()) as { routes?: MLRouteResult[] };
  if (!Array.isArray(data.routes) || data.routes.length !== candidates.length) {
    throw new Error("ML reroute response did not score every candidate route");
  }
  return data.routes;
}

async function rerouteMission(incident: IIncident, missionId: string) {
  const mission = await Mission.findOne({ missionId }).lean();
  if (!mission) {
    console.warn(`Skipping reroute: mission ${missionId} was not found`);
    return;
  }

  const rawMapplsResponse = await findRoute({
    origin: mission.origin,
    dest: mission.destination,
  });

  if ("error" in rawMapplsResponse) {
    throw new Error(rawMapplsResponse.detail);
  }

  const candidates = extractCandidates(rawMapplsResponse);
  if (candidates.length !== MAX_ALTERNATIVES) {
    throw new Error(`Mappls returned ${candidates.length} routes; expected 3`);
  }

  const scores = await scoreCandidates(incident, candidates);
  const latestRoute = await Route.findOne({ missionId })
    .sort({ routeVersion: -1 })
    .select("routeVersion")
    .lean();
  const nextVersion = (latestRoute?.routeVersion ?? 0) + 1;

  await Route.updateMany(
    { missionId, status: "ACTIVE" },
    { $set: { status: "SUPERSEDED" } }
  );

  await Route.insertMany(
    candidates.map((candidate, index) => {
      const score = scores[index];
      return {
        routeId: generateID("R"),
        missionId,
        truckNo: mission.truckNo,
        routeVersion: nextVersion,
        alternativeRank: index + 1,
        geometry: candidate.geometry,
        distanceMeters: candidate.distanceMeters,
        durationSeconds: candidate.durationSeconds,
        riskScore: Math.round(score.disruption_risk * 100),
        riskBand: score.risk_band,
        status: "ACTIVE",
        triggeredByIncidentId: incident.incidentId,
      };
    })
  );

  return { missionId, routeVersion: nextVersion, routeCount: candidates.length };
}

export async function rerouteRoutesForIncident(incidentId: string) {
  await connectDB();

  const incident = await Incident.findOne({ incidentId }).lean();
  if (!incident) throw new Error(`Incident ${incidentId} was not found`);

  const affectedRoutes = await Route.find({
    status: "ACTIVE",
    geometry: {
      $near: {
        $geometry: incident.location,
        $maxDistance: ROUTE_MATCH_RADIUS_METERS,
      },
    },
  })
    .select("missionId")
    .lean();

  const missionIds = [...new Set(affectedRoutes.map((route) => route.missionId))];
  const rerouted = [];
  for (const missionId of missionIds) {
    rerouted.push(await rerouteMission(incident, missionId));
  }

  return { affectedMissionCount: rerouted.length, missions: rerouted };
}
