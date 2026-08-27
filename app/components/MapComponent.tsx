"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Script from "next/script";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RouteData {
  id: string;
  coordinates: [number, number][]; // [lng, lat]
  distanceKm: number;
  eta: string;
  riskScore: number;
  risk: "LOW" | "MEDIUM" | "HIGH";
  color: string;
  isRecommended: boolean;
  riskReasons: string[];
  expectedRecovery: string;
}

declare global {
  interface Window {
    mappls: {
      Map: new (
        containerId: string,
        options: { center: { lat: number; lng: number }; zoom: number }
      ) => MapplsMap;
      Polyline: new (options: {
        map: MapplsMap;
        path: { lat: number; lng: number }[];
        strokeColor: string;
        strokeWeight: number;
        strokeOpacity: number;
      }) => object;
      Marker: new (options: {
        map: MapplsMap;
        position: { lat: number; lng: number };
        fitBounds?: boolean;
        popupHtml?: string;
      }) => object;
    };
  }
}

interface MapplsMap {
  on: (event: string, callback: () => void) => void;
  fitBounds: (points: { lat: number; lng: number }[], options?: object) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAPPLS_SDK_URL = `https://sdk.mappls.com/map/sdk/web?v=3.0&access_token=${process.env.NEXT_PUBLIC_MAPPLS_KEY ?? "miunpnbpteyzxhdjjmwejxfdyxuikkumudgr"}`;

async function geocodeCity(city: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city + ", India")}&limit=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch {
    // ignore geocode failures
  }
  return null;
}

// ─── Route Popup ─────────────────────────────────────────────────────────────

interface RoutePopupProps {
  route: RouteData;
  index: number;
  onClose: () => void;
}

function RoutePopup({ route, index, onClose }: RoutePopupProps) {
  const riskColor =
    route.risk === "LOW" ? "#16a34a" : route.risk === "MEDIUM" ? "#d97706" : "#dc2626";
  const riskBg =
    route.risk === "LOW" ? "#f0fdf4" : route.risk === "MEDIUM" ? "#fffbeb" : "#fef2f2";

  return (
    <div
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: 999,
        width: 320,
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(15,39,71,0.18)",
        border: "1px solid #e5e7eb",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "#0f2747",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <p style={{ color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: 600, margin: 0, letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Route {index + 1} {route.isRecommended ? "· RECOMMENDED" : ""}
          </p>
          <p style={{ color: "#fff", fontSize: 15, fontWeight: 700, margin: "2px 0 0" }}>
            {route.distanceKm} km · {route.eta}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{ background: "rgba(255,255,255,0.12)", border: "none", borderRadius: 6, padding: "4px 8px", color: "#fff", cursor: "pointer", fontSize: 13 }}
        >
          ✕
        </button>
      </div>

      {/* Risk badge */}
      <div style={{ padding: "12px 16px 8px" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            background: riskBg,
            border: `1px solid ${riskColor}33`,
            borderRadius: 20,
            padding: "4px 12px",
            marginBottom: 12,
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: riskColor, display: "inline-block" }} />
          <span style={{ color: riskColor, fontWeight: 700, fontSize: 12 }}>
            {route.riskScore}% risk probability · {route.risk} RISK
          </span>
        </div>

        {/* Risk reasons */}
        <p style={{ fontSize: 12, fontWeight: 700, color: "#0f2747", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Why this route?
        </p>
        <ul style={{ margin: 0, padding: "0 0 0 16px", listStyle: "disc" }}>
          {route.riskReasons.map((r, i) => (
            <li key={i} style={{ fontSize: 13, color: "#374151", marginBottom: 3 }}>{r}</li>
          ))}
        </ul>

        {/* Recovery */}
        <div style={{ marginTop: 10, padding: "8px 12px", background: "#f9fafb", borderRadius: 8, border: "1px solid #e5e7eb" }}>
          <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
            Expected status: <strong style={{ color: "#111827" }}>{route.expectedRecovery}</strong>
          </p>
        </div>

        {route.isRecommended && (
          <div style={{ marginTop: 8, padding: "8px 12px", background: "#f0fdf4", borderRadius: 8, border: "1px solid #bbf7d0" }}>
            <p style={{ margin: 0, fontSize: 12, color: "#15803d", fontWeight: 600 }}>
              ✓ MAARG recommends this route — lowest predicted disruption probability
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface MapComponentProps {
  /** City name or "lng,lat" string for origin */
  origin?: string;
  /** City name or "lng,lat" string for destination */
  destination?: string;
  /** Map initial center — defaults to Guwahati */
  center?: { lat: number; lng: number };
  /** Initial zoom */
  zoom?: number;
  /** Show the source/destination input controls */
  showControls?: boolean;
  /** Called when routes are loaded — passes the route data */
  onRoutesLoaded?: (routes: RouteData[]) => void;
  /** Height of the map container */
  height?: string;
  /** Map mode: "fleet" shows driver markers only, no route search */
  mode?: "routes" | "fleet";
  /** List of trucks to show on fleet map */
  fleetTrucks?: Array<{ truckNo: string; lat: number; lng: number; missionId?: string }>;
}

export default function MapComponent({
  origin: originProp = "",
  destination: destinationProp = "",
  center = { lat: 26.144293, lng: 91.736155 },
  zoom = 3,
  showControls = false,
  onRoutesLoaded,
  height = "calc(100vh - 220px)",
  mode = "routes",
  fleetTrucks = [],
}: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapplsMap | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [source, setSource] = useState(originProp);
  const [dest, setDest] = useState(destinationProp);
  const [loading, setLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<{ route: RouteData; index: number } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);

  // ── Coordinate resolution: "Guwahati" → { lat, lng } ──────────────────────
  const resolveCoord = useCallback(async (value: string): Promise<string | null> => {
    if (!value.trim()) return null;
    // Already "lng,lat"
    if (/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(value.trim())) return value.trim();
    // City name → geocode
    const coords = await geocodeCity(value.trim());
    if (!coords) return null;
    return `${coords.lng},${coords.lat}`;
  }, []);

  // ── Fetch routes from /api/routes ─────────────────────────────────────────
  const fetchRoutes = useCallback(
    async (originStr: string, destStr: string) => {
      if (!originStr || !destStr) return;
      setLoading(true);
      setMapError(null);

      const [originCoord, destCoord] = await Promise.all([
        resolveCoord(originStr),
        resolveCoord(destStr),
      ]);

      if (!originCoord || !destCoord) {
        setMapError("Could not find coordinates for the given locations. Please check spelling.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/routes?origin=${encodeURIComponent(originCoord)}&dest=${encodeURIComponent(destCoord)}`
        );
        const data = await res.json();
        const fetchedRoutes: RouteData[] = Array.isArray(data.routes) ? data.routes : [];
        setRoutes(fetchedRoutes);
        onRoutesLoaded?.(fetchedRoutes);
        drawRoutes(fetchedRoutes);
      } catch {
        setMapError("Route service unavailable. Showing sample data.");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolveCoord, onRoutesLoaded]
  );

  // ── Draw polylines on the map ─────────────────────────────────────────────
  function drawRoutes(routeList: RouteData[]) {
    if (!mapRef.current || !window.mappls) return;
    const allPoints: { lat: number; lng: number }[] = [];

    routeList.forEach((route) => {
      const path = route.coordinates.map(([lng, lat]) => ({ lat, lng }));
      allPoints.push(...path);
      new window.mappls.Polyline({
        map: mapRef.current!,
        path,
        strokeColor: route.color,
        strokeWeight: route.risk === "LOW" ? 7 : 4,
        strokeOpacity: 0.9,
      });
    });

    if (allPoints.length && mapRef.current.fitBounds) {
      mapRef.current.fitBounds(allPoints, { padding: 60 });
    }
  }

  // ── Draw fleet markers ────────────────────────────────────────────────────
  function drawFleet(trucks: typeof fleetTrucks) {
    if (!mapRef.current || !window.mappls) return;
    trucks.forEach((truck) => {
      new window.mappls.Marker({
        map: mapRef.current!,
        position: { lat: truck.lat, lng: truck.lng },
        popupHtml: `<div style="font-size:13px;padding:6px 10px;font-family:inherit"><strong>🚛 ${truck.truckNo}</strong><br/>${truck.missionId ? `Mission: ${truck.missionId}` : "No active mission"}</div>`,
      });
    });
  }

  // ── Initialise map once SDK is ready ─────────────────────────────────────
  useEffect(() => {
    if (!sdkReady || !mapContainerRef.current || !window.mappls) return;
    if (mapRef.current) return;

    const mapInstance = new window.mappls.Map(mapContainerRef.current.id, { center, zoom });
    mapRef.current = mapInstance;

    mapInstance.on("load", () => {
      if (mode === "fleet") {
        drawFleet(fleetTrucks);
      } else if (originProp && destinationProp) {
        fetchRoutes(originProp, destinationProp);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdkReady]);

  // ── Re-draw fleet when trucks change ─────────────────────────────────────
  useEffect(() => {
    if (mode === "fleet" && sdkReady && mapRef.current) {
      drawFleet(fleetTrucks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fleetTrucks, mode, sdkReady]);

  // ── Re-fetch routes when origin/destination props change ─────────────────
  useEffect(() => {
    if (mode !== "routes") return;
    if (originProp && destinationProp && sdkReady && mapRef.current) {
      setSource(originProp);
      setDest(destinationProp);
      fetchRoutes(originProp, destinationProp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [originProp, destinationProp, sdkReady]);

  return (
    <>
      <Script
        src={MAPPLS_SDK_URL}
        strategy="afterInteractive"
        onReady={() => setSdkReady(true)}
      />

      <div style={{ position: "relative", width: "100%", height, minHeight: 320 }}>
        {/* Optional controls */}
        {showControls && (
          <div
            style={{
              display: "flex",
              gap: 8,
              padding: "10px 12px",
              background: "#f9fafb",
              borderBottom: "1px solid #e5e7eb",
              flexWrap: "wrap",
            }}
          >
            <input
              type="text"
              placeholder="Origin (city name or lng,lat)"
              value={source}
              onChange={(e) => setSource(e.target.value)}
              style={{ flex: 1, minWidth: 200, padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }}
            />
            <input
              type="text"
              placeholder="Destination (city name or lng,lat)"
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              style={{ flex: 1, minWidth: 200, padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 13 }}
            />
            <button
              onClick={() => fetchRoutes(source, dest)}
              disabled={loading || !sdkReady}
              style={{
                padding: "8px 18px",
                background: loading || !sdkReady ? "#9ca3af" : "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 13,
                cursor: loading || !sdkReady ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Loading…" : "Find Routes"}
            </button>
          </div>
        )}

        {/* SDK loading indicator */}
        {!sdkReady && (
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "#f1f5f9" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🗺️</div>
              <p style={{ fontSize: 13, color: "#6b7280" }}>Initialising Mappls map…</p>
            </div>
          </div>
        )}

        {/* Route loading overlay */}
        {loading && sdkReady && (
          <div style={{ position: "absolute", top: 12, left: 12, zIndex: 999, background: "#0f2747", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600 }}>
            ⟳ Calculating routes…
          </div>
        )}

        {/* Error banner */}
        {mapError && (
          <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, zIndex: 999, background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 8, padding: "8px 14px", fontSize: 13, color: "#dc2626" }}>
            ⚠ {mapError}
          </div>
        )}

        {/* Route legend when routes are loaded */}
        {routes.length > 0 && !loading && (
          <div style={{ position: "absolute", bottom: 12, left: 12, zIndex: 998, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", boxShadow: "0 2px 8px rgba(0,0,0,0.10)" }}>
            <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "#0f2747" }}>
              Tap a route line on map
            </p>
            {routes.map((r, i) => (
              <button
                key={r.id}
                onClick={() => setSelectedRoute({ route: r, index: i })}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "5px 8px",
                  border: "none",
                  borderRadius: 6,
                  background: selectedRoute?.route.id === r.id ? "#f0f9ff" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  marginBottom: 2,
                }}
              >
                <span style={{ width: 20, height: 4, borderRadius: 2, background: r.color, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "#111827" }}>
                  Route {i + 1} — {r.riskScore}% risk {r.isRecommended ? "⭐" : ""}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Route popup */}
        {selectedRoute && (
          <RoutePopup
            route={selectedRoute.route}
            index={selectedRoute.index}
            onClose={() => setSelectedRoute(null)}
          />
        )}

        {/* Map container */}
        <div
          id="maarg-map"
          ref={mapContainerRef}
          style={{ width: "100%", height: showControls ? "calc(100% - 60px)" : "100%", minHeight: 280 }}
        />
      </div>
    </>
  );
}
