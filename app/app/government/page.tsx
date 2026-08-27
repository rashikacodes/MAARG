"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Icon, { type IconName } from "@/components/Icon";
import { useIsClient } from "@/components/useIsClient";
import { useAuth, type AuthUser } from "@/lib/auth-context";
import dynamic from "next/dynamic";


const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="flex h-120 w-full items-center justify-center rounded-card border border-line bg-canvas text-sm text-muted">
      Loading fleet map…
    </div>
  ),
});

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm text-ink transition-colors placeholder:text-subtle focus:border-india focus:outline-none focus-visible:ring-2 focus-visible:ring-india/20";
const labelClass = "mb-1.5 block text-[13px] font-semibold text-navy";

const CAPABILITIES: { label: string; icon: IconName }[] = [
  { label: "Create and assign critical logistics missions", icon: "route" },
  { label: "Register trucks, drivers and cargo priorities", icon: "truck" },
  { label: "Live fleet positioning via NavIC / GNSS", icon: "navigation" },
  { label: "Issue real-time road hazard and landslide advisories", icon: "alertTriangle" },
];

const CARGO_TYPES: { value: string; label: string }[] = [
  { value: "MEDICAL", label: "Medical supplies" },
  { value: "FOOD", label: "Food grains" },
  { value: "FUEL", label: "Fuel" },
  { value: "AGRICULTURAL", label: "Agricultural" },
  { value: "CONSTRUCTION", label: "Construction material" },
  { value: "RELIEF", label: "Relief material" },
  { value: "GENERAL", label: "General cargo" },
];

interface Mission {
  _id?: string;
  missionId?: string;
  truckNo?: string;
  cargoType?: string;
  cargoQuantity?: string;
  origin?: string;
  destination?: string;
  targetArrival?: string;
  status?: string;
  createdAt?: string;
}

interface CreatedMission {
  missionId?: string;
  truckNo?: string;
  cargoType?: string;
  origin?: string;
  destination?: string;
  status?: string;
}

interface FleetTruck {
  truckNo: string;
  lat: number;
  lng: number;
  missionId?: string;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusMeta(status?: string): { label: string; chip: string } {
  switch (status) {
    case "IN_PROGRESS": return { label: "In transit", chip: "border-primary/25 bg-primary/8 text-primary" };
    case "COMPLETED": return { label: "Completed", chip: "border-safe-line bg-safe-bg text-safe" };
    case "CANCELLED": return { label: "Cancelled", chip: "border-danger-line bg-danger-bg text-danger" };
    default: return { label: "Pending", chip: "border-warning-line bg-warning-bg text-warning" };
  }
}

type Tab = "create" | "missions" | "fleet";

export default function GovernmentPage() {
  const isClient = useIsClient();
  const { user, isAdmin, setUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("create");


  // Login state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Mission form state
  const [truckNo, setTruckNo] = useState("");
  const [cargoType, setCargoType] = useState("MEDICAL");
  const [cargoQuantity, setCargoQuantity] = useState("");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [targetArrival, setTargetArrival] = useState("");
  const [missionLoading, setMissionLoading] = useState(false);
  const [missionError, setMissionError] = useState<string | null>(null);
  const [createdMission, setCreatedMission] = useState<CreatedMission | null>(null);

  // Missions list state
  const [missions, setMissions] = useState<Mission[]>([]);
  const [missionsLoading, setMissionsLoading] = useState(false);
  const [missionsError, setMissionsError] = useState<string | null>(null);

  // Fleet map state
  const [fleetTrucks, setFleetTrucks] = useState<FleetTruck[]>([]);
  const [fleetPolling, setFleetPolling] = useState(false);

  // ── Fetch all missions ─────────────────────────────────────────────────────
  const fetchMissions = useCallback(async () => {
    setMissionsLoading(true);
    setMissionsError(null);
    try {
      const res = await fetch("/api/missions");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMissionsError(data?.message || "Could not load missions.");
        setMissions([]);
      } else {
        setMissions(Array.isArray(data.missions) ? data.missions : []);
      }
    } catch {
      setMissionsError("Unable to reach the server.");
    } finally {
      setMissionsLoading(false);
    }
  }, []);

  // ── Poll fleet locations for active missions ───────────────────────────────
  const fetchFleet = useCallback(async (missionList: Mission[]) => {
    const activeMissions = missionList.filter((m) => m.status === "IN_PROGRESS" || m.status === "PENDING");
    const uniqueTrucks = [...new Set(activeMissions.map((m) => m.truckNo).filter(Boolean))] as string[];

    const results = await Promise.allSettled(
      uniqueTrucks.map(async (tn) => {
        const res = await fetch(`/api/truck/${tn}`);
        if (!res.ok) return null;
        const d = await res.json();
        if (!d.success || !d.data) return null;
        const mission = activeMissions.find((m) => m.truckNo === tn);
        return {
          truckNo: tn,
          lat: d.data.lat,
          lng: d.data.lng,
          missionId: mission?.missionId,
        } as FleetTruck;
      })
    );

    const trucks = results
      .filter((r): r is PromiseFulfilledResult<FleetTruck | null> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter((t): t is FleetTruck => t !== null);

    setFleetTrucks(trucks);
  }, []);

  // Load missions when "missions" or "fleet" tab becomes active
  useEffect(() => {
    if (!isAdmin) return;
    if (activeTab === "missions" || activeTab === "fleet") {
      fetchMissions();
    }
  }, [activeTab, isAdmin, fetchMissions]);

  // Update fleet from missions list whenever missions change and fleet tab is open
  useEffect(() => {
    if (activeTab === "fleet" && missions.length > 0) {
      fetchFleet(missions);
    }
  }, [activeTab, missions, fetchFleet]);

  // Poll fleet every 15 seconds when fleet tab is open
  useEffect(() => {
    if (activeTab !== "fleet" || !isAdmin) return;
    setFleetPolling(true);
    const interval = setInterval(() => fetchFleet(missions), 15000);
    return () => {
      clearInterval(interval);
      setFleetPolling(false);
    };
  }, [activeTab, isAdmin, missions, fetchFleet]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setLoginError(data?.message || "Invalid credentials."); setLoginLoading(false); return; }
      const loggedIn: AuthUser | undefined = data?.user;
      const roles = Array.isArray(loggedIn?.roles) ? loggedIn!.roles! : [];
      if (!roles.includes("admin")) {
        setLoginError("This portal requires an administrator account. Use the standard sign-in for your role.");
        setLoginLoading(false);
        return;
      }
      setUser(loggedIn ?? null);
      setLoginLoading(false);
    } catch {
      setLoginError("Unable to reach the server. Check your connection.");
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setCreatedMission(null);
    setEmail(""); setPassword("");
    setMissions([]); setFleetTrucks([]);
  };

  const handleCreateMission = async (e: React.FormEvent) => {
    e.preventDefault();
    setMissionError(null);
    setCreatedMission(null);
    setMissionLoading(true);
    const payload = {
      truckNo: truckNo.trim().toUpperCase(),
      cargoType,
      cargoQuantity: cargoQuantity.trim(),
      origin: origin.trim(),
      destination: destination.trim(),
      targetArrival,
    };
    try {
      const res = await fetch("/api/missions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMissionError(data?.message || "Could not create the mission. Please review the fields.");
        setMissionLoading(false);
        return;
      }
      setCreatedMission(data?.mission ?? { truckNo: payload.truckNo });
      setTruckNo(""); setCargoQuantity(""); setOrigin(""); setDestination(""); setTargetArrival(""); setCargoType("MEDICAL");
      setMissionLoading(false);
    } catch {
      setMissionError("Unable to reach the server.");
      setMissionLoading(false);
    }
  };

  // ─── Tab UI ───────────────────────────────────────────────────────────────

  const tabs: { id: Tab; label: string; icon: IconName }[] = [
    { id: "create", label: "Create mission", icon: "route" },
    { id: "missions", label: "Active missions", icon: "layers" },
    { id: "fleet", label: "Live fleet map", icon: "navigation" },
  ];

  return (
    <div className="flex min-h-screen w-full flex-col bg-canvas text-ink">
      <Navbar />

      <main id="main" className="w-full flex-1 py-12 sm:py-16">
        <div className="mx-auto w-full max-w-[1600px] px-4 sm:px-8 lg:px-12">
          {!isClient ? (
            <div className="mx-auto max-w-md py-20 text-center text-sm text-muted">Loading…</div>
          ) : isAdmin ? (
            /* ═══════════════════ ADMIN CONSOLE ═══════════════════ */
            <div>
              {/* Admin header */}
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-india/20 bg-india/8 text-india">
                    <Icon name="landmark" size={20} />
                  </span>
                  <div>
                    <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-india">Authority console</p>
                    <p className="text-sm font-semibold text-navy">{user?.name || user?.email || "Administrator"}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3.5 py-2 text-[13px] font-semibold text-navy transition-colors hover:border-danger hover:text-danger"
                >
                  <Icon name="logout" size={15} />
                  Sign out
                </button>
              </div>

              {/* Tab strip */}
              <div className="mb-6 flex gap-1 rounded-card border border-line bg-surface p-1.5">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-md py-2.5 text-[13px] font-semibold transition-colors ${
                      activeTab === tab.id ? "bg-india text-white" : "text-muted hover:text-navy"
                    }`}
                  >
                    <Icon name={tab.icon} size={15} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* ── Tab: Create mission ── */}
              {activeTab === "create" && (
                <div className="mx-auto max-w-2xl rounded-card border border-line bg-surface p-7">
                  <div className="mb-5 border-b border-line pb-4">
                    <h1 className="text-xl font-bold tracking-tight text-navy">Create logistics mission</h1>
                    <p className="mt-1 text-sm text-muted">Assign a truck to a priority cargo route.</p>
                  </div>

                  {createdMission && (
                    <div className="mb-5 rounded-md border border-safe-line bg-safe-bg p-4">
                      <p className="flex items-center gap-2 text-sm font-semibold text-safe">
                        <Icon name="checkCircle" size={17} />
                        Mission created — driver will see it immediately on their mission screen.
                      </p>
                      <div className="mt-2.5 grid grid-cols-2 gap-x-6 gap-y-1 text-[13px] text-ink">
                        {createdMission.missionId && <p><span className="text-muted">ID: </span><strong className="font-mono">{createdMission.missionId}</strong></p>}
                        {createdMission.truckNo && <p><span className="text-muted">Truck: </span><strong className="font-mono">{createdMission.truckNo}</strong></p>}
                        {createdMission.origin && <p><span className="text-muted">From: </span><strong>{createdMission.origin}</strong></p>}
                        {createdMission.destination && <p><span className="text-muted">To: </span><strong>{createdMission.destination}</strong></p>}
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleCreateMission} className="space-y-4">
                    {missionError && (
                      <div role="alert" className="flex items-start gap-2.5 rounded-md border border-danger-line bg-danger-bg p-3 text-[13px] font-medium text-danger">
                        <Icon name="alertTriangle" size={16} className="mt-0.5 shrink-0" />
                        <span>{missionError}</span>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="truckNo" className={labelClass}>Truck number</label>
                        <input id="truckNo" type="text" value={truckNo} onChange={(e) => setTruckNo(e.target.value)} placeholder="AS01AB1234" className={`${inputClass} uppercase`} required />
                      </div>
                      <div>
                        <label htmlFor="cargoType" className={labelClass}>Cargo type</label>
                        <select id="cargoType" value={cargoType} onChange={(e) => setCargoType(e.target.value)} className={inputClass}>
                          {CARGO_TYPES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="cargoQuantity" className={labelClass}>Cargo quantity</label>
                        <input id="cargoQuantity" type="text" value={cargoQuantity} onChange={(e) => setCargoQuantity(e.target.value)} placeholder="e.g. 12 tonnes / 500 units" className={inputClass} required />
                      </div>
                      <div>
                        <label htmlFor="targetArrival" className={labelClass}>Target arrival</label>
                        <input id="targetArrival" type="datetime-local" value={targetArrival} onChange={(e) => setTargetArrival(e.target.value)} className={inputClass} required />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label htmlFor="origin" className={labelClass}>Origin</label>
                        <input id="origin" type="text" value={origin} onChange={(e) => setOrigin(e.target.value)} placeholder="Guwahati" className={inputClass} required />
                      </div>
                      <div>
                        <label htmlFor="destination" className={labelClass}>Destination</label>
                        <input id="destination" type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="Tawang" className={inputClass} required />
                      </div>
                    </div>
                    <button type="submit" disabled={missionLoading} className="mt-1 flex w-full items-center justify-center gap-2 rounded-md bg-india px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-india-600 disabled:cursor-not-allowed disabled:opacity-70">
                      {missionLoading ? <span>Creating mission…</span> : <><span>Create &amp; assign mission</span><Icon name="arrowRight" size={16} /></>}
                    </button>
                  </form>
                </div>
              )}

              {/* ── Tab: Active missions list ── */}
              {activeTab === "missions" && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-navy">All missions</h2>
                    <button onClick={fetchMissions} disabled={missionsLoading} className="inline-flex items-center gap-1.5 rounded-md border border-line px-3.5 py-2 text-[13px] font-semibold text-navy hover:bg-wash disabled:opacity-60">
                      <Icon name="activity" size={14} />
                      {missionsLoading ? "Refreshing…" : "Refresh"}
                    </button>
                  </div>
                  {missionsError && (
                    <p className="rounded-md border border-danger-line bg-danger-bg p-3 text-[13px] text-danger">{missionsError}</p>
                  )}
                  {!missionsLoading && missions.length === 0 && !missionsError && (
                    <div className="rounded-card border border-line bg-surface p-8 text-center text-sm text-muted">No missions found.</div>
                  )}
                  {missions.length > 0 && (
                    <div className="overflow-hidden rounded-card border border-line bg-surface">
                      <table className="w-full text-sm">
                        <thead className="border-b border-line bg-wash text-left text-[12px] font-semibold uppercase tracking-wider text-muted">
                          <tr>
                            <th className="px-5 py-3">Mission ID</th>
                            <th className="px-5 py-3">Truck</th>
                            <th className="px-5 py-3">Route</th>
                            <th className="px-5 py-3">Cargo</th>
                            <th className="px-5 py-3">Target Arrival</th>
                            <th className="px-5 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {missions.map((m) => {
                            const s = statusMeta(m.status);
                            return (
                              <tr key={m._id} className="hover:bg-wash">
                                <td className="px-5 py-3 font-mono text-[13px] font-semibold text-navy">{m.missionId || "—"}</td>
                                <td className="px-5 py-3 font-mono">{m.truckNo || "—"}</td>
                                <td className="px-5 py-3">{m.origin} → {m.destination}</td>
                                <td className="px-5 py-3">{m.cargoType} · {m.cargoQuantity}</td>
                                <td className="px-5 py-3 text-[13px]">{formatDate(m.targetArrival)}</td>
                                <td className="px-5 py-3">
                                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${s.chip}`}>
                                    {s.label}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab: Live fleet map ── */}
              {activeTab === "fleet" && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-navy">Live fleet map</h2>
                      <p className="text-[13px] text-muted">
                        Showing {fleetTrucks.length} active truck{fleetTrucks.length !== 1 ? "s" : ""} · Auto-refreshes every 15 seconds
                        {fleetPolling && <span className="ml-2 text-safe">● Live</span>}
                      </p>
                    </div>
                    <button onClick={() => fetchFleet(missions)} className="inline-flex items-center gap-1.5 rounded-md border border-line px-3.5 py-2 text-[13px] font-semibold text-navy hover:bg-wash">
                      <Icon name="navigation" size={14} />
                      Refresh
                    </button>
                  </div>
                  {fleetTrucks.length === 0 && (
                    <div className="mb-4 rounded-md border border-warning-line bg-warning-bg p-3 text-[13px] text-warning">
                      No active truck locations available yet. Trucks will appear once drivers start reporting their GPS position via <code>/api/truck/[truckNo]</code>.
                    </div>
                  )}
                  <div className="overflow-hidden rounded-card border border-line">
                    <MapComponent
                      mode="fleet"
                      fleetTrucks={fleetTrucks}
                      height="560px"
                      showControls={false}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ═══════════════════ LOGIN ═══════════════════ */
            <div className="mx-auto grid max-w-5xl grid-cols-1 items-center gap-10 md:grid-cols-12">
              {/* Left info */}
              <div className="space-y-5 md:col-span-6">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-india/20 bg-india/8 px-3.5 py-1 text-xs font-semibold text-india">
                  <Icon name="landmark" size={13} />
                  Official authority portal
                </div>
                <h1 className="text-[30px] font-bold leading-tight tracking-tight text-ink sm:text-[36px]">
                  Government &amp; Logistics Authority Portal
                </h1>
                <div className="tricolor-strip h-1 w-24 rounded-full" aria-hidden="true" />
                <p className="text-[15px] leading-relaxed text-muted">
                  Restricted portal for state transport departments, disaster-response authorities, and essential-goods supply managers.
                </p>
                <div className="rounded-card border border-line bg-surface p-5">
                  <h4 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-navy">Authority capabilities</h4>
                  <ul className="mt-3 space-y-2.5 text-sm text-muted">
                    {CAPABILITIES.map((cap) => (
                      <li key={cap.label} className="flex items-start gap-2.5">
                        <Icon name={cap.icon} size={16} className="mt-0.5 shrink-0 text-india" />
                        <span>{cap.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <p className="flex gap-2.5 rounded-md border border-warning-line bg-warning-bg p-4 text-[13px] leading-relaxed text-warning">
                  <Icon name="lock" size={15} className="mt-0.5 shrink-0" />
                  <span>Government accounts are provisioned internally by authorised administrators. Public registration is disabled.</span>
                </p>
              </div>

              {/* Right login form */}
              <div className="md:col-span-6">
                <div className="rounded-card border border-line bg-surface p-7">
                  <div className="mb-6 text-center">
                    <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-navy text-white">
                      <Icon name="landmark" size={24} />
                    </span>
                    <h2 className="text-xl font-bold text-navy">Government sign in</h2>
                    <p className="mt-1 text-sm text-muted">Enter your official administrator credentials.</p>
                  </div>
                  <form onSubmit={handleLogin} className="space-y-4">
                    {loginError && (
                      <div role="alert" className="flex items-start gap-2.5 rounded-md border border-danger-line bg-danger-bg p-3 text-[13px] font-medium text-danger">
                        <Icon name="alertTriangle" size={16} className="mt-0.5 shrink-0" />
                        <span>{loginError}</span>
                      </div>
                    )}
                    <div>
                      <label htmlFor="gov-email" className={labelClass}>Official email address</label>
                      <input id="gov-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="official@transport.gov.in" className={inputClass} required />
                    </div>
                    <div>
                      <label htmlFor="gov-password" className={labelClass}>Password</label>
                      <input id="gov-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" className={inputClass} minLength={6} required />
                    </div>
                    <button type="submit" disabled={loginLoading} className="flex w-full items-center justify-center gap-2 rounded-md bg-india px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-india-600 disabled:cursor-not-allowed disabled:opacity-70">
                      {loginLoading ? <span>Verifying…</span> : <><span>Sign in to authority portal</span><Icon name="arrowRight" size={16} /></>}
                    </button>
                  </form>
                  <p className="mt-5 border-t border-line pt-4 text-center text-[13px] text-muted">
                    Not an administrator?{" "}
                    <Link href="/login" className="font-semibold text-primary hover:underline">Standard sign in</Link>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
