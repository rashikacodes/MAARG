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
        options: { center: { lat: number; lng: number }; zoom: number },
      ) => MapplsMap;
      Polyline: new (options: {
        map: MapplsMap;
        path: { lat: number; lng: number }[];
        strokeColor: string;
        strokeWeight: number;
        strokeOpacity: number;
      }) => object;
      Marker: new (options: {
        map: MapplsMap | null;
        position: { lat: number; lng: number } | [number, number];
        fitBounds?: boolean;
        popupHtml?: string;
        html?: string;
        icon?: { url: string; width: number; height: number };
      }) => object;
      Circle: new (options: {
        map: MapplsMap | null;
        center: [number, number];
        radius: number;
        fillColor?: string;
        fillOpacity?: number;
        strokeColor?: string;
        strokeOpacity?: number;
        strokeWeight?: number;
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

async function geocodeCity(
  city: string,
): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city + ", India")}&limit=1`,
      { headers: { "Accept-Language": "en" } },
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
    route.risk === "LOW"
      ? "#16a34a"
      : route.risk === "MEDIUM"
        ? "#d97706"
        : "#dc2626";
  const riskBg =
    route.risk === "LOW"
      ? "#f0fdf4"
      : route.risk === "MEDIUM"
        ? "#fffbeb"
        : "#fef2f2";

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 39, 71, 0.4)',
        backdropFilter: 'blur(4px)',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          background: '#fff',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(15,39,71,0.18)',
          border: '1px solid #e5e7eb',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
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
          <p
            style={{
              color: "rgba(255,255,255,0.65)",
              fontSize: 11,
              fontWeight: 600,
              margin: 0,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            Route {index + 1} {route.isRecommended ? "· RECOMMENDED" : ""}
          </p>
          <p
            style={{
              color: "#fff",
              fontSize: 15,
              fontWeight: 700,
              margin: "2px 0 0",
            }}
          >
            {route.distanceKm} km · {route.eta}
          </p>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(255,255,255,0.12)",
            border: "none",
            borderRadius: 6,
            padding: "4px 8px",
            color: "#fff",
            cursor: "pointer",
            fontSize: 13,
          }}
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
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: riskColor,
              display: "inline-block",
            }}
          />
          <span style={{ color: riskColor, fontWeight: 700, fontSize: 12 }}>
            {route.riskScore}% risk probability · {route.risk} RISK
          </span>
        </div>

        {/* Risk reasons */}
        <p
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#0f2747",
            marginBottom: 4,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Why this route?
        </p>
        <ul style={{ margin: 0, padding: "0 0 0 16px", listStyle: "disc" }}>
          {route.riskReasons.map((r, i) => (
            <li
              key={i}
              style={{ fontSize: 13, color: "#374151", marginBottom: 3 }}
            >
              {r}
            </li>
          ))}
        </ul>

        {/* Recovery */}
        <div
          style={{
            marginTop: 10,
            padding: "8px 12px",
            background: "#f9fafb",
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        >
          <p style={{ margin: 0, fontSize: 12, color: "#6b7280" }}>
            Expected status:{" "}
            <strong style={{ color: "#111827" }}>
              {route.expectedRecovery}
            </strong>
          </p>
        </div>

        {route.isRecommended && (
          <div
            style={{
              marginTop: 8,
              padding: "8px 12px",
              background: "#f0fdf4",
              borderRadius: 8,
              border: "1px solid #bbf7d0",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "#15803d",
                fontWeight: 600,
              }}
            >
              ✓ MAARG recommends this route — lowest predicted disruption
              probability
            </p>
          </div>
        )}
      </div>
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
  fleetTrucks?: Array<{
    truckNo: string;
    lat: number;
    lng: number;
    missionId?: string;
  }>;
  /** User type for markers */
  userType?: "driver" | "user";
  /** Only show the recommended/best route instead of all routes */
  showOnlyBestRoute?: boolean;
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
  userType = "user",
  showOnlyBestRoute = false,
}: MapComponentProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapplsMap | null>(null);
  const overlaysRef = useRef<any[]>([]);
  const [sdkReady, setSdkReady] = useState(false);
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [source, setSource] = useState(originProp);
  const [dest, setDest] = useState(destinationProp);
  const [loading, setLoading] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<{
    route: RouteData;
    index: number;
  } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<any[]>([]);

  // ── Coordinate resolution: "Guwahati" → { lat, lng } ──────────────────────
  const resolveCoord = useCallback(
    async (value: string): Promise<string | null> => {
      if (!value.trim()) return null;
      // Already "lng,lat"
      if (/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(value.trim()))
        return value.trim();
      // City name → geocode
      const coords = await geocodeCity(value.trim());
      if (!coords) return null;
      return `${coords.lng},${coords.lat}`;
    },
    [],
  );

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
        setMapError(
          "Could not find coordinates for the given locations. Please check spelling.",
        );
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          `/api/routes?origin=${encodeURIComponent(originCoord)}&dest=${encodeURIComponent(destCoord)}`,
        );
        const data = await res.json();
        const fetchedRoutes: RouteData[] = Array.isArray(data.routes)
          ? data.routes
          : [];
        const fetchedIncidents = data.incidents || [];
        setRoutes(fetchedRoutes);
        setIncidents(fetchedIncidents);
        onRoutesLoaded?.(fetchedRoutes);
        drawRoutes(fetchedRoutes, fetchedIncidents);
      } catch {
        setMapError("Route service unavailable. Showing sample data.");
      } finally {
        setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [resolveCoord, onRoutesLoaded],
  );

  // ── Draw polylines on the map ─────────────────────────────────────────────
  function drawRoutes(routeList: RouteData[], incidents: any[] = []) {
    if (!mapRef.current || !window.mappls) return;

    // Clear all previous overlays (polylines, circles, markers) from map
    if (overlaysRef.current && overlaysRef.current.length > 0) {
      overlaysRef.current.forEach((item) => {
        try {
          if (typeof item.remove === "function") {
            item.remove();
          } else if (mapRef.current && typeof (mapRef.current as any).removeLayer === "function") {
            (mapRef.current as any).removeLayer(item);
          }
        } catch {}
      });
      overlaysRef.current = [];
    }

    // Filter routes if showOnlyBestRoute is true - only show the single best route
    // Best = isRecommended flag from server, fallback = lowest riskScore
    const getBestRoute = (list: RouteData[]) => {
      if (list.length === 0) return null;
      return list.find((r) => r.isRecommended) ?? [...list].sort((a, b) => a.riskScore - b.riskScore)[0];
    };
    const routesToShow = showOnlyBestRoute
      ? (() => { const b = getBestRoute(routeList); return b ? [b] : routeList.slice(0, 1); })()
      : routeList;

    const allPoints: { lat: number; lng: number }[] = [];

    // 1. Draw 1km incident impact circles and warning markers
    incidents.forEach((inc) => {
      if (!inc.location || !inc.location.coordinates) return;
      const [lng, lat] = inc.location.coordinates;

      const circle = new window.mappls.Circle({
        map: mapRef.current,
        center: [lat, lng],
        radius: 1000,
        fillColor: "#ef4444",
        fillOpacity: 0.25,
        strokeColor: "#b91c1c",
        strokeOpacity: 0.8,
        strokeWeight: 2,
      });
      overlaysRef.current.push(circle);

      const marker = new window.mappls.Marker({
        map: mapRef.current,
        position: { lat, lng },
        html: `<div style="background: white; padding: 4px 8px; border-radius: 12px; border: 2px solid #ef4444; font-size: 12px; font-weight: bold; color: #ef4444; white-space: nowrap; box-shadow: 0 2px 6px rgba(0,0,0,0.3); transform: translate(-50%, -150%);">
                 ⚠️ ${inc.type || inc.incidentId || 'Incident'}
               </div>`,
        popupHtml: `<div style="font-size:13px;padding:6px 10px;font-family:inherit"><strong>⚠️ ${inc.type || 'Incident'}</strong><br/>Severity: ${inc.severity || '—'}<br/>Impact Radius: 1.0 km<br/>Status: ${inc.status || '—'}</div>`,
      });
      overlaysRef.current.push(marker);
    });

    // 2. Sort routes so blocked/high risk are drawn on the bottom, and recommended safe route is drawn on top
    const sortedRoutesToDraw = [...routesToShow].sort((a, b) => b.riskScore - a.riskScore);

    sortedRoutesToDraw.forEach((route) => {
      const path = route.coordinates.map(([lng, lat]) => ({ lat, lng }));
      allPoints.push(...path);

      const isRec = route.isRecommended || route.risk === "LOW";
      const isCritical = route.riskScore >= 75 || route.risk === "HIGH";

      const polyline = new window.mappls.Polyline({
        map: mapRef.current!,
        path,
        strokeColor: route.color || (isCritical ? "#dc2626" : isRec ? "#16a34a" : "#d97706"),
        strokeWeight: isRec ? 7 : 4,
        strokeOpacity: isRec ? 0.95 : 0.75,
      });
      overlaysRef.current.push(polyline);
      // Make route line clickable to show risk popup
      try {
        const anyPoly = polyline as any;
        const idx = routesToShow.findIndex((r) => r.id === route.id);
        const handler = () => setSelectedRoute({ route, index: idx >= 0 ? idx : 0 });
        if (typeof anyPoly.on === "function") anyPoly.on("click", handler);
        else if (typeof anyPoly.addListener === "function") anyPoly.addListener("click", handler);
        else if (typeof anyPoly.addEventListener === "function") anyPoly.addEventListener("click", handler);
      } catch {}
    });

    // 3. Draw origin and destination markers on top
    if (routeList.length > 0) {
      const firstRoute = routeList[0];
      const originCoord = firstRoute.coordinates[0];
      const destCoord = firstRoute.coordinates[firstRoute.coordinates.length - 1];

      const emoji = userType === 'driver' ? '🚛' : '🚗';

      const origMarker = new window.mappls.Marker({
        map: mapRef.current!,
        position: { lat: originCoord[1], lng: originCoord[0] },
        html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%)">
          <div style="font-size:32px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));line-height:1">${emoji}</div>
          <div style="margin-top:2px;background:#0f2747;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2)">You are here</div>
        </div>`,
        popupHtml: `<div style="font-size:14px;padding:6px 10px;font-family:inherit"><span style="font-size:20px">${emoji}</span> <strong>You are here</strong></div>`,
      });
      overlaysRef.current.push(origMarker);

      const destMarker = new window.mappls.Marker({
        map: mapRef.current!,
        position: { lat: destCoord[1], lng: destCoord[0] },
        html: `<div style="display:flex;flex-direction:column;align-items:center;transform:translate(-50%,-100%)">
          <div style="font-size:28px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3));line-height:1">📍</div>
          <div style="margin-top:2px;background:#d97706;color:#fff;font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.2)">Destination</div>
        </div>`,
        popupHtml: `<div style="font-size:14px;padding:6px 10px;font-family:inherit"><span style="font-size:20px">📍</span> <strong>Destination</strong></div>`,
      });
      overlaysRef.current.push(destMarker);
    }


    if (allPoints.length && mapRef.current.fitBounds) {
      mapRef.current.fitBounds(allPoints, {
        padding: 60,
        maxZoom: 13,
      });
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

    const mapInstance = new window.mappls.Map(mapContainerRef.current.id, {
      center,
      zoom,
    });
    mapRef.current = mapInstance;

    mapInstance.on("load", () => {
      if (mode === "fleet") {
        drawFleet(fleetTrucks);
      } else if (originProp && destinationProp) {
        fetchRoutes(originProp, destinationProp);
      }

      // ── Show live location blue dot (like Google Maps) ────────────────────
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            if (!mapRef.current || !window.mappls) return;
            new window.mappls.Marker({
              map: mapRef.current,
              position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
              html: `<div style="display:flex;align-items:center;justify-content:center;transform:translate(-50%,-50%)">
                <div style="width:18px;height:18px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 2px rgba(66,133,244,0.3),0 2px 6px rgba(0,0,0,0.3);position:relative">
                  <div style="position:absolute;inset:-8px;border-radius:50%;background:rgba(66,133,244,0.15);animation:bluePulse 2s ease-out infinite"></div>
                </div>
              </div>
              <style>@keyframes bluePulse{0%{transform:scale(1);opacity:0.6}100%{transform:scale(2.5);opacity:0}}</style>`,
            });
          },
          () => { /* GPS unavailable — skip blue dot */ },
          { enableHighAccuracy: true, timeout: 8000 }
        );
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

  // ── Re-draw routes when showOnlyBestRoute changes ──────────────────────────
  useEffect(() => {
    if (mode !== "routes") return;
    if (routes.length > 0 && sdkReady && mapRef.current) {
      drawRoutes(routes, incidents);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOnlyBestRoute]);

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

      <div
        style={{ position: "relative", width: "100%", height, minHeight: 320 }}
      >
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
              style={{
                flex: 1,
                minWidth: 200,
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                fontSize: 13,
              }}
            />
            <input
              type="text"
              placeholder="Destination (city name or lng,lat)"
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              style={{
                flex: 1,
                minWidth: 200,
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                fontSize: 13,
              }}
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
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#f1f5f9",
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🗺️</div>
              <p style={{ fontSize: 13, color: "#6b7280" }}>
                Initialising Mappls map…
              </p>
            </div>
          </div>
        )}

        {/* Route loading overlay */}
        {loading && sdkReady && (
          <div
            style={{
              position: "absolute",
              top: 12,
              left: 12,
              zIndex: 999,
              background: "#0f2747",
              color: "#fff",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            ⟳ Calculating routes…
          </div>
        )}

        {/* Error banner */}
        {mapError && (
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              right: 12,
              zIndex: 999,
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 13,
              color: "#dc2626",
            }}
          >
            ⚠ {mapError}
          </div>
        )}

        {/* Route legend when routes are loaded */}
        {routes.length > 0 && !loading && (
          <div
            style={{
              position: "absolute",
              bottom: 12,
              left: 12,
              zIndex: 998,
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "10px 14px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
            }}
          >
            <p
              style={{
                margin: "0 0 6px",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "#0f2747",
              }}
            >
              Tap a route line on map
            </p>
            {(() => {
              const best = routes.find((r) => r.isRecommended) ?? [...routes].sort((a,b)=>a.riskScore-b.riskScore)[0];
              const displayed = showOnlyBestRoute ? (best ? [best] : routes.slice(0,1)) : routes;
              return displayed;
            })().map((r, i) => (
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
                    background:
                      selectedRoute?.route.id === r.id
                        ? "#f0f9ff"
                        : "transparent",
                    cursor: "pointer",
                    textAlign: "left",
                    marginBottom: 2,
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      height: 4,
                      borderRadius: 2,
                      background: r.color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: 12, color: "#111827" }}>
                    Route {i + 1} — {r.riskScore}% risk{" "}
                    {r.isRecommended ? "⭐" : ""}
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
          style={{
            width: "100%",
            height: showControls ? "calc(100% - 60px)" : "100%",
            minHeight: 280,
          }}
        />
      </div>
    </>
  );
}
