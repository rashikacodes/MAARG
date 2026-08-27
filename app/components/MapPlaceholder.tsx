"use client";

import { useState } from "react";
import Icon from "./Icon";

interface MapPlaceholderProps {
  origin?: string;
  destination?: string;
  recommendedRouteName?: string;
  recommendedRisk?: string;
  recommendedEta?: string;
  /** Called with "route1" | "route2" | "route3" when user clicks a route in the toggle panel */
  onRouteClick?: (routeKey: "route1" | "route2" | "route3") => void;
}

type RouteKey = "route1" | "route2" | "route3";

const ROUTE_HEX = {
  safe: "#16794a",
  warning: "#a65a08",
  danger: "#bb1622",
};

const ROUTE_META: Record<
  RouteKey,
  { label: string; tone: "safe" | "warning" | "danger"; risk: string; eta: string; distance: string }
> = {
  route1: { label: "Route 1 · Safest", tone: "safe", risk: "18%", eta: "8h 05m", distance: "448 km" },
  route2: { label: "Route 2 · Medium", tone: "warning", risk: "46%", eta: "7h 20m", distance: "412 km" },
  route3: { label: "Route 3 · High risk", tone: "danger", risk: "82%", eta: "6h 40m", distance: "385 km" },
};

const TONE_CLASSES = {
  safe: { text: "text-safe", chip: "bg-safe-bg text-safe border-safe-line", dot: "bg-safe" },
  warning: { text: "text-warning", chip: "bg-warning-bg text-warning border-warning-line", dot: "bg-warning" },
  danger: { text: "text-danger", chip: "bg-danger-bg text-danger border-danger-line", dot: "bg-danger" },
};

export default function MapPlaceholder({
  origin = "Guwahati",
  destination = "Tawang",
  onRouteClick,
}: MapPlaceholderProps) {
  const [selectedRoute, setSelectedRoute] = useState<RouteKey>("route1");
  const meta = ROUTE_META[selectedRoute];
  const tone = TONE_CLASSES[meta.tone];

  return (
    <div className="relative overflow-hidden rounded-card border border-line bg-surface">
      {/* Map Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface px-5 py-4">
        <div>
          <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
            <Icon name="navigation" size={13} />
            Live route intelligence
          </span>
          <h3 className="mt-0.5 text-lg font-semibold text-navy">
            Accessibility map · {origin} to {destination}
          </h3>
        </div>
      </div>

      {/* Map Visualization Area */}
      <div className="relative min-h-110 w-full overflow-hidden bg-linear-to-br from-wash via-canvas to-wash sm:min-h-125">
        {/* Decorative Grid Lines */}
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage: `linear-gradient(rgba(146, 160, 180, 0.22) 1px, transparent 1px), linear-gradient(90deg, rgba(146, 160, 180, 0.22) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Abstract Terrain Topography Lines */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-30" xmlns="http://www.w3.org/2000/svg">
          <path d="M 0 100 Q 200 40 400 120 T 800 100 T 1200 140" fill="none" stroke="#8a99ad" strokeWidth="1.5" strokeDasharray="4 4" />
          <path d="M 0 220 Q 300 150 600 240 T 1200 200" fill="none" stroke="#8a99ad" strokeWidth="1.5" strokeDasharray="4 4" />
          <path d="M 0 340 Q 250 300 500 380 T 1000 320" fill="none" stroke="#8a99ad" strokeWidth="1.5" strokeDasharray="4 4" />
        </svg>

        {/* Alternate Route 2 (Medium) */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M 120 360 C 220 280, 380 320, 520 230 C 620 170, 700 150, 820 120"
            fill="none"
            stroke={ROUTE_HEX.warning}
            strokeWidth={selectedRoute === "route2" ? "6" : "3"}
            strokeDasharray="8 6"
            className="transition-all duration-300"
            opacity={selectedRoute === "route2" ? 0.95 : 0.55}
          />
        </svg>

        {/* Alternate Route 3 (High) */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M 120 360 C 260 400, 480 380, 640 280 C 720 220, 780 180, 820 120"
            fill="none"
            stroke={ROUTE_HEX.danger}
            strokeWidth={selectedRoute === "route3" ? "6" : "3"}
            strokeDasharray="6 4"
            className="transition-all duration-300"
            opacity={selectedRoute === "route3" ? 0.95 : 0.5}
          />
        </svg>

        {/* Recommended Route 1 (Safe) */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M 120 360 C 180 260, 320 200, 460 220 C 580 240, 680 160, 820 120"
            fill="none"
            stroke={ROUTE_HEX.safe}
            strokeWidth={selectedRoute === "route1" ? "7" : "4"}
            strokeLinecap="round"
            className="drop-shadow-md filter transition-all duration-300"
            opacity={selectedRoute === "route1" ? 1 : 0.7}
          />
        </svg>

        {/* Origin Marker */}
        <div className="absolute bottom-[20%] left-[12%] z-10 flex flex-col items-center sm:bottom-[22%] sm:left-[14%]">
          <span className="z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-primary text-white shadow-sm">
            <Icon name="mapPin" size={15} />
          </span>
          <div className="mt-2 rounded-md border border-line bg-surface/95 px-2.5 py-1 text-xs font-semibold text-navy shadow-sm backdrop-blur">
            {origin}
          </div>
        </div>

        {/* Destination Marker */}
        <div className="absolute right-[12%] top-[18%] z-10 flex flex-col items-center sm:right-[15%] sm:top-[20%]">
          <span className="z-10 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-saffron text-white shadow-sm">
            <Icon name="flag" size={14} />
          </span>
          <div className="mt-2 rounded-md border border-line bg-surface/95 px-2.5 py-1 text-xs font-semibold text-navy shadow-sm backdrop-blur">
            {destination}
          </div>
        </div>

        {/* Live Truck Marker */}
        <div className="absolute left-[44%] top-[45%] z-20 flex flex-col items-center transition-all">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary bg-surface text-primary shadow-sm ring-4 ring-primary/10">
            <Icon name="truck" size={19} />
          </span>
          <div className="mt-1 rounded border border-primary/25 bg-navy px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-white">
            AS01AB1234
          </div>
        </div>

        {/* Disruption Warning */}
        <div className="absolute bottom-[28%] right-[32%] z-10 flex items-center gap-1 rounded-lg border border-danger-line bg-surface/90 px-2 py-1 shadow-sm backdrop-blur">
          <Icon name="alertTriangle" size={13} className="text-danger" />
          <span className="text-[10px] font-bold text-danger">Landslide risk</span>
        </div>

        {/* Info Card Overlay */}
        <div className="absolute left-4 top-4 z-20 w-48 rounded-xl border border-line bg-surface/95 p-3.5 shadow-md backdrop-blur sm:w-56">
          <div className="mb-2 flex items-center justify-between border-b border-line pb-2">
            <span className="text-xs font-bold text-navy">{meta.label}</span>
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase ${tone.text}`}>
              <span className={`h-2 w-2 rounded-full ${tone.dot}`} />
              {meta.tone === "safe" ? "Safe" : meta.tone === "warning" ? "Medium" : "High"}
            </span>
          </div>

          <div className="space-y-1.5 text-xs text-muted">
            <div className="flex justify-between">
              <span>Risk score</span>
              <strong className={`font-mono tabular-nums ${tone.text}`}>{meta.risk}</strong>
            </div>
            <div className="flex justify-between">
              <span>Estimated ETA</span>
              <strong className="font-mono tabular-nums text-ink">{meta.eta}</strong>
            </div>
            <div className="flex justify-between">
              <span>Total distance</span>
              <strong className="font-mono tabular-nums text-ink">{meta.distance}</strong>
            </div>
          </div>
        </div>

        {/* Route Selector — bottom-right */}
        <div className="absolute bottom-4 right-4 z-20 flex flex-col gap-1.5 rounded-xl border border-line bg-surface/90 p-2 shadow-md backdrop-blur">
          <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-subtle">
            Toggle map view
          </span>
          {(Object.keys(ROUTE_META) as RouteKey[]).map((key) => {
            const rm = ROUTE_META[key];
            const rt = TONE_CLASSES[rm.tone];
            const active = selectedRoute === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedRoute(key);
                  onRouteClick?.(key);
                }}
                className={`flex items-center justify-between gap-3 rounded-md px-2.5 py-1 text-left text-xs font-semibold transition-colors ${
                  active ? `border ${rt.chip}` : "text-muted hover:bg-canvas"
                }`}
              >
                <span>{key.replace("route", "Route ")}</span>
                <span className={`h-2 w-2 rounded-full ${rt.dot}`} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
