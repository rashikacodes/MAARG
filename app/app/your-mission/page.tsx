"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Icon from "@/components/Icon";
import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[480px] w-full items-center justify-center rounded-[10px] border border-line bg-canvas text-sm text-muted">
      Loading map…
    </div>
  ),
});

interface Mission {
  missionId?: string;
  truckNo?: string;
  cargoType?: string;
  cargoQuantity?: string;
  origin?: string;
  destination?: string;
  originAddress?: string;
  destinationAddress?: string;
  targetArrival?: string;
  status?: string;
}

const CARGO_LABELS: Record<string, string> = {
  MEDICAL: "Medical supplies",
  FOOD: "Food grains",
  FUEL: "Fuel",
  AGRICULTURAL: "Agricultural",
  CONSTRUCTION: "Construction material",
  RELIEF: "Relief material",
  GENERAL: "General cargo",
};

function statusMeta(status?: string): { label: string; chip: string; dot: string } {
  switch (status) {
    case "IN_PROGRESS":
      return { label: "In transit", chip: "border-primary/25 bg-primary/8 text-primary", dot: "bg-primary" };
    case "COMPLETED":
      return { label: "Completed", chip: "border-safe-line bg-safe-bg text-safe", dot: "bg-safe" };
    case "CANCELLED":
      return { label: "Cancelled", chip: "border-danger-line bg-danger-bg text-danger", dot: "bg-danger" };
    case "PENDING":
    default:
      return { label: "Pending", chip: "border-warning-line bg-warning-bg text-warning", dot: "bg-warning" };
  }
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isCoordinateString(val?: string): boolean {
  return !!val && /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(val.trim());
}

function displayLocation(address?: string, coord?: string): string {
  if (address && address.trim()) return address;
  if (coord && !isCoordinateString(coord)) return coord;
  return "—";
}

export default function DriverMissionPage() {
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [truckNo, setTruckNo] = useState<string | null>(null);
  const [missions, setMissions] = useState<Mission[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/missions/my-mission");
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (!res.ok) {
          setErrorCode(res.status);
          setErrorMsg(data?.message ?? null);
          setLoading(false);
          return;
        }
        setTruckNo(data?.truckNo ?? null);
        setMissions(Array.isArray(data?.missions) ? data.missions : []);
        setLoading(false);
      } catch {
        if (!active) return;
        setErrorCode(0);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // ── 10-second GPS location ping ──────────────────────────────────────
  useEffect(() => {
    // Only ping when we have an active mission and truck number
    const activeMission = missions.find((m) => m.status === "IN_PROGRESS" || m.status === "PENDING");
    if (!truckNo || !activeMission) return;

    let watchId: number | null = null;
    let latestCoords: { lat: number; lng: number } | null = null;

    // Watch GPS position
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          latestCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        },
        () => { /* ignore errors silently */ },
        { enableHighAccuracy: true, maximumAge: 5000 }
      );
    }

    // Ping every 10 seconds
    const interval = setInterval(async () => {
      if (!latestCoords) return;
      try {
        await fetch(`/api/truck/${truckNo}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            missionId: activeMission.missionId,
            location: {
              type: "Point",
              coordinates: [latestCoords.lng, latestCoords.lat],
            },
          }),
        });
      } catch {
        // Non-fatal — continue pinging
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    };
  }, [truckNo, missions]);

  const primary =
    missions.find((m) => m.status === "IN_PROGRESS") ?? missions[0] ?? null;
  const others = primary ? missions.filter((m) => m !== primary) : [];

  const [showAllRoutes, setShowAllRoutes] = useState(false);

  return (
    <div className="flex min-h-screen w-full flex-col bg-canvas text-ink">
      <Navbar />

      <main id="main" className="w-full flex-1 py-10 sm:py-12">
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-8 lg:px-12">
          {/* Header */}
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[26px] font-bold tracking-tight text-ink sm:text-[32px]">
                Your assigned missions
              </h1>
              <p className="mt-1.5 text-sm text-muted">
                {truckNo
                  ? `Missions assigned to truck ${truckNo}, with live route recommendations.`
                  : "Pre-assigned transport parameters and live route recommendations."}
              </p>
            </div>
            <Link
              href="/report"
              className="inline-flex items-center gap-2 rounded-md border border-line-strong bg-surface px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:border-primary hover:text-primary"
            >
              <Icon name="alertTriangle" size={15} />
              Report incident
            </Link>
          </div>

          {/* States */}
          {loading ? (
            <div className="rounded-[10px] border border-line bg-surface p-10 text-center text-sm text-muted">
              Loading your missions…
            </div>
          ) : errorCode ? (
            <div className="mx-auto max-w-xl rounded-[10px] border border-line bg-surface p-8 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-line bg-wash text-muted">
                <Icon name={errorCode === 401 ? "lock" : "info"} size={22} />
              </span>
              <h3 className="mt-4 text-lg font-bold text-navy">
                {errorCode === 401
                  ? "Please sign in"
                  : errorCode === 403
                  ? "Driver access only"
                  : errorCode === 404
                  ? "No truck assigned yet"
                  : "Missions unavailable"}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                {errorCode === 401
                  ? "Sign in with your driver account to view the missions assigned to your truck."
                  : errorCode === 403
                  ? "This view is for government-assigned drivers."
                  : errorCode === 404
                  ? errorMsg || "No truck is linked to your driver profile yet. Contact your authority administrator."
                  : "We couldn't reach the mission service right now. Please try again shortly."}
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {errorCode === 401 && (
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
                  >
                    Sign in <Icon name="arrowRight" size={15} />
                  </Link>
                )}
              </div>
            </div>
          ) : !primary ? (
            <div className="mx-auto max-w-xl rounded-[10px] border border-line bg-surface p-8 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-line bg-wash text-muted">
                <Icon name="truck" size={22} />
              </span>
              <h3 className="mt-4 text-lg font-bold text-navy">No missions yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                {truckNo
                  ? `No missions are currently assigned to truck ${truckNo}. New assignments will appear here.`
                  : "No missions are currently assigned. New assignments will appear here."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
              {/* Left: mission details */}
              <div className="space-y-6 lg:col-span-4">
                <div className="overflow-hidden rounded-[10px] border border-line bg-surface">
                  <div className="tricolor-strip" aria-hidden="true" />
                  <div className="p-6 sm:p-7">
                    <div className="mb-5 flex items-center justify-between border-b border-line pb-4">
                      <div>
                        <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted">
                          Mission ID
                        </span>
                        <h2 className="mt-0.5 font-mono text-xl font-bold tracking-tight text-navy">
                          {primary.missionId || "—"}
                        </h2>
                      </div>
                      {(() => {
                        const s = statusMeta(primary.status);
                        return (
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${s.chip}`}>
                            <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                            {s.label}
                          </span>
                        );
                      })()}
                    </div>

                    {/* Route */}
                    <div className="mb-5 rounded-md border border-line bg-canvas p-5">
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center">
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                            <Icon name="mapPin" size={13} />
                          </span>
                          <div className="my-1 h-10 w-0.5 bg-line-strong" />
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-saffron text-white">
                            <Icon name="flag" size={12} />
                          </span>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle">From</span>
                            <p className="text-[15px] font-semibold text-ink">{displayLocation(primary.originAddress, primary.origin)}</p>
                          </div>
                          <div>
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-subtle">To</span>
                            <p className="text-[15px] font-semibold text-ink">{displayLocation(primary.destinationAddress, primary.destination)}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { icon: "shieldCheck" as const, label: "Cargo", value: CARGO_LABELS[primary.cargoType ?? ""] || primary.cargoType || "—" },
                        { icon: "gauge" as const, label: "Quantity", value: primary.cargoQuantity || "—" },
                        { icon: "truck" as const, label: "Truck", value: primary.truckNo || truckNo || "—", mono: true },
                        { icon: "clock" as const, label: "Target arrival", value: formatDate(primary.targetArrival), small: true },
                      ].map(({ icon, label, value, mono, small }) => (
                        <div key={label} className="rounded-md border border-line bg-canvas p-4">
                          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
                            <Icon name={icon} size={13} className="text-subtle" />
                            {label}
                          </span>
                          <p className={`mt-1 font-semibold text-ink ${mono ? "font-mono text-[15px]" : ""} ${small ? "text-[13px]" : "text-[15px]"}`}>
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Other missions */}
                {others.length > 0 && (
                  <div className="rounded-[10px] border border-line bg-surface p-6">
                    <h3 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-navy">
                      Other missions for this truck
                    </h3>
                    <ul className="mt-3 divide-y divide-line">
                      {others.map((m, i) => {
                        const s = statusMeta(m.status);
                        return (
                          <li key={m.missionId || i} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-ink">{displayLocation(m.originAddress, m.origin)} → {displayLocation(m.destinationAddress, m.destination)}</p>
                              <p className="font-mono text-[12px] text-subtle">{m.missionId}</p>
                            </div>
                            <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${s.chip}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                              {s.label}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>

              {/* Right: real map with routes */}
              <div className="w-full lg:col-span-8">
                <div className="overflow-hidden rounded-[10px] border border-line">
                  <MapComponent
                    origin={primary.origin || ""}
                    destination={primary.destination || ""}
                    height="560px"
                    mode="routes"
                    showControls={false}
                    showOnlyBestRoute={!showAllRoutes}
                  />
                </div>
                <div className="mt-3 flex items-center justify-end">
                  <button
                    onClick={() => setShowAllRoutes(!showAllRoutes)}
                    className="inline-flex items-center gap-2 rounded-md border border-line bg-surface px-4 py-2 text-sm font-medium text-navy transition-colors hover:border-primary hover:text-primary"
                  >
                    <Icon name={showAllRoutes ? "chevronUp" : "chevronDown"} size={15} />
                    {showAllRoutes ? "Show best route only" : "Show all routes"}
                  </button>
                </div>
                <p className="mt-2 text-[12px] text-muted">
                  Map powered by Mappls · Click a route in the legend to see risk analysis
                </p>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
