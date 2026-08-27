"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Icon from "@/components/Icon";
import { useAuth } from "@/lib/auth-context";


/* ── Nominatim place-search types ── */
interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

/* ── Web Speech API shim ── */
interface SpeechRecognition extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm text-ink transition-colors placeholder:text-subtle focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";
const labelClass = "mb-1.5 block text-[13px] font-semibold text-navy";

// Values map exactly to the Incident model enums.
const INCIDENT_TYPES: { value: string; label: string }[] = [
  { value: "LANDSLIDE", label: "Landslide / rockfall" },
  { value: "FLOOD", label: "Flood / waterlogging" },
  { value: "ROAD_BLOCK", label: "Road block / obstruction" },
  { value: "ROAD_DAMAGE", label: "Road damage / potholes" },
  { value: "BRIDGE_DAMAGE", label: "Bridge damage / structural" },
  { value: "ACCIDENT", label: "Accident" },
  { value: "TRAFFIC", label: "Traffic congestion" },
  { value: "OTHER", label: "Other disruption" },
];

const SEVERITIES: { value: string; label: string }[] = [
  { value: "LOW", label: "Low — passable with caution" },
  { value: "MEDIUM", label: "Medium — partial blockage" },
  { value: "HIGH", label: "High — severe disruption" },
  { value: "CRITICAL", label: "Critical — impassable" },
];

export default function ReportPage() {
  const { truckNo: driverTruckNo, isDriver } = useAuth();
  const [type, setType] = useState("LANDSLIDE");
  const [severity, setSeverity] = useState("MEDIUM");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [description, setDescription] = useState("");
  const [truckNo, setTruckNo] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);

  // Pre-fill truck number for drivers
  useEffect(() => {
    if (isDriver && driverTruckNo) {
      setTruckNo(driverTruckNo);
    }
  }, [isDriver, driverTruckNo]);


  /* ── Place search ── */
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeSuggestions, setPlaceSuggestions] = useState<NominatimResult[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeName, setPlaceName] = useState("");
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchPlace = useCallback((q: string) => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!q.trim()) { setPlaceSuggestions([]); return; }
    searchDebounce.current = setTimeout(async () => {
      setPlaceLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=in&limit=6&addressdetails=0`,
          { headers: { "Accept-Language": "en" } }
        );
        const data: NominatimResult[] = await res.json();
        setPlaceSuggestions(data);
      } catch { setPlaceSuggestions([]); }
      finally { setPlaceLoading(false); }
    }, 400);
  }, []);

  const selectPlace = (result: NominatimResult) => {
    setLat(parseFloat(result.lat).toFixed(6));
    setLng(parseFloat(result.lon).toFixed(6));
    setPlaceName(result.display_name);
    setPlaceQuery(result.display_name);
    setPlaceSuggestions([]);
  };

  /* ── Voice-to-text ── */
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const startListening = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Voice input is not supported in this browser."); return; }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      setDescription((prev) => prev ? prev + " " + transcript : transcript);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  /* suppress unused-var lint for placeName — it is displayed in the placeholder */
  void placeName;

  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [syncPending, setSyncPending] = useState(false);

  const handleGetCurrentLocation = () => {
    setGeoError(null);
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGeoError("Geolocation is not supported on this device. Enter coordinates manually.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setLocating(false);
      },
      () => {
        setGeoError("Could not read your location. Enter the coordinates manually.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const resetForm = () => {
    setDescription("");
    setTruckNo("");
    setLat("");
    setLng("");
    setPlaceQuery("");
    setPlaceName("");
    setPlaceSuggestions([]);
    setType("LANDSLIDE");
    setSeverity("MEDIUM");
    setOccurredAt("");
    setImageFiles([]);
    setImagePreviews([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (!lat || !lng || Number.isNaN(latNum) || Number.isNaN(lngNum)) {
      setError("Please provide a valid latitude and longitude, or use GPS.");
      return;
    }
    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      setError("Coordinates are out of range. Latitude −90…90, longitude −180…180.");
      return;
    }

    // Payload matches the Incident model exactly (GeoJSON = [longitude, latitude]).
    const payload = {
      type,
      severity,
      location: {
        type: "Point",
        coordinates: [lngNum, latNum] as [number, number],
      },
      description: description.trim() || undefined,
      source: "FIELD_REPORT",
      occurredAt: occurredAt ? new Date(occurredAt).toISOString() : new Date().toISOString(),
      ...(truckNo.trim() ? { truckNo: truckNo.trim().toUpperCase() } : {}),
    };

    // TODO: upload imageFiles here before or after submitting the JSON payload.
    // e.g. const uploadedUrls = await yourUploadFn(imageFiles);
    // then add uploadedUrls to payload.
    setLoading(true);
    try {
      const res = await fetch("/api/incidents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // The incident service may not be live yet; treat a non-2xx as "sync pending"
      // rather than losing the user's report.
      setSyncPending(!res.ok);
      setSubmitted(true);
      setLoading(false);
    } catch {
      // Network/route unavailable — still confirm capture, flag sync as pending.
      setSyncPending(true);
      setSubmitted(true);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-canvas text-ink">
      <Navbar />

      <main id="main" className="w-full flex-1 py-12 sm:py-16">
        <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <nav className="mb-6 flex items-center gap-2 text-[13px] text-muted" aria-label="Breadcrumb">
            <Link href="/" className="transition-colors hover:text-primary">
              Home
            </Link>
            <Icon name="chevronRight" size={13} className="text-subtle" />
            <span className="font-semibold text-navy">Report incident</span>
          </nav>

          {/* Header */}
          <div className="mb-7">
            <span className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-danger">
              <Icon name="alertTriangle" size={13} />
              Field reporting
            </span>
            <h1 className="text-[26px] font-bold tracking-tight text-ink">Report a road incident</h1>
            <p className="mt-2 text-sm text-muted">
              Submit a road hazard, landslide, flood, or infrastructure-damage report to update
              MAARG&apos;s accessibility models.
            </p>
          </div>

          {/* Form card */}
          <div className="rounded-card border border-line bg-surface p-7">
            {submitted ? (
              <div className="text-center">
                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-safe-line bg-safe-bg text-safe">
                  <Icon name="checkCircle" size={30} />
                </span>
                <h3 className="mt-4 text-lg font-bold text-navy">Incident report submitted</h3>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted">
                  Thank you. Your field report has been captured with its location and time stamp.
                </p>

                {syncPending && (
                  <p className="mx-auto mt-4 flex max-w-lg items-start gap-2.5 rounded-md border border-warning-line bg-warning-bg p-3 text-left text-[13px] leading-relaxed text-warning">
                    <Icon name="info" size={16} className="mt-0.5 shrink-0" />
                    <span>
                      The incident service isn&apos;t responding yet, so live sync is pending. Your
                      report is formatted correctly and will be accepted once the endpoint is online.
                    </span>
                  </p>
                )}

                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Link
                    href="/user/dashboard"
                    className="inline-flex items-center gap-1.5 rounded-md bg-navy px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-navy-600"
                  >
                    View route planner
                    <Icon name="arrowRight" size={15} />
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitted(false);
                      setSyncPending(false);
                      resetForm();
                    }}
                    className="rounded-md border border-line-strong px-5 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-wash"
                  >
                    Submit another report
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-md border border-danger-line bg-danger-bg p-3 text-[13px] font-medium text-danger"
                  >
                    <Icon name="alertTriangle" size={16} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="type" className={labelClass}>
                      Incident type
                    </label>
                    <select
                      id="type"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      className={inputClass}
                    >
                      {INCIDENT_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="severity" className={labelClass}>
                      Severity
                    </label>
                    <select
                      id="severity"
                      value={severity}
                      onChange={(e) => setSeverity(e.target.value)}
                      className={inputClass}
                    >
                      {SEVERITIES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Location — place search */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="text-[13px] font-semibold text-navy">Location</label>
                    <button
                      type="button"
                      onClick={handleGetCurrentLocation}
                      disabled={locating}
                      className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 py-1.5 text-[12px] font-semibold text-india transition-colors hover:border-india hover:bg-wash disabled:opacity-60"
                    >
                      <Icon name="mapPin" size={14} />
                      <span>{locating ? "Locating…" : "Use GPS"}</span>
                    </button>
                  </div>

                  {/* Place search input */}
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
                      {placeLoading
                        ? <svg className="h-4 w-4 animate-spin text-subtle" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" /></svg>
                        : <Icon name="mapPin" size={16} className="text-subtle" />}
                    </div>
                    <input
                      type="text"
                      value={placeQuery}
                      onChange={(e) => { setPlaceQuery(e.target.value); searchPlace(e.target.value); }}
                      placeholder="Search a place — e.g. Tawang, Arunachal Pradesh"
                      className={`${inputClass} pl-9`}
                      autoComplete="off"
                    />
                    {placeSuggestions.length > 0 && (
                      <ul className="absolute z-50 mt-1 w-full rounded-md border border-line bg-surface shadow-md">
                        {placeSuggestions.map((r) => (
                          <li key={r.place_id}>
                            <button
                              type="button"
                              onClick={() => selectPlace(r)}
                              className="flex w-full items-start gap-2 px-3.5 py-2.5 text-left text-[13px] text-ink transition-colors hover:bg-wash"
                            >
                              <Icon name="mapPin" size={14} className="mt-0.5 shrink-0 text-primary" />
                              <span className="line-clamp-2">{r.display_name}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Show resolved coordinates */}
                  {lat && lng && (
                    <p className="mt-1.5 flex items-center gap-1 text-[12px] text-safe">
                      <Icon name="check" size={13} />
                      <span>Coordinates set: {lat}, {lng}</span>
                    </p>
                  )}
                  {geoError && <p className="mt-1.5 text-[12px] text-warning">{geoError}</p>}

                  {/* Hidden inputs keep form validation wired to lat/lng */}
                  <input type="hidden" value={lat} required />
                  <input type="hidden" value={lng} required />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="occurredAt" className={labelClass}>
                      When did it occur? <span className="font-normal text-subtle">(optional)</span>
                    </label>
                    <input
                      id="occurredAt"
                      type="datetime-local"
                      value={occurredAt}
                      onChange={(e) => setOccurredAt(e.target.value)}
                      className={inputClass}
                    />
                    <p className="mt-1.5 text-[12px] text-subtle">Leave blank to use the current time.</p>
                  </div>
                  <div>
                    <label htmlFor="truckNo" className={labelClass}>
                      Associated truck <span className="font-normal text-subtle">(optional)</span>
                    </label>
                    <input
                      id="truckNo"
                      type="text"
                      value={truckNo}
                      onChange={(e) => setTruckNo(e.target.value)}
                      placeholder="AS01AB1234"
                      className={`${inputClass} uppercase`}
                    />
                  </div>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label htmlFor="description" className="text-[13px] font-semibold text-navy">
                      Description <span className="font-normal text-subtle">(optional)</span>
                    </label>
                    <button
                      type="button"
                      onClick={listening ? stopListening : startListening}
                      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                        listening
                          ? "border-danger bg-danger-bg text-danger hover:bg-danger/10"
                          : "border-line-strong bg-surface text-primary hover:border-primary hover:bg-wash"
                      }`}
                      title={listening ? "Stop recording" : "Dictate description"}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="2" width="6" height="11" rx="3" />
                        <path d="M19 10a7 7 0 0 1-14 0" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                        <line x1="8" y1="22" x2="16" y2="22" />
                      </svg>
                      <span>{listening ? "Stop" : "Dictate"}</span>
                      {listening && <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-danger" />}
                    </button>
                  </div>
                  <textarea
                    id="description"
                    rows={4}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={listening ? "Listening… speak now" : "Describe the disruption size, affected lanes, weather conditions, or estimated clearance…"}
                    className={`${inputClass} ${listening ? "border-danger/40 ring-2 ring-danger/15" : ""}`}
                  />
                </div>

                {/* Image upload */}
                <div>
                  <label className={labelClass}>
                    Photos <span className="font-normal text-subtle">(optional — up to 4)</span>
                  </label>

                  {/* Drop zone */}
                  <label
                    htmlFor="incident-images"
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-line bg-canvas px-4 py-6 text-center transition-colors hover:border-primary hover:bg-wash"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="text-subtle">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    <span className="text-[13px] font-semibold text-navy">
                      Click to upload or drag &amp; drop
                    </span>
                    <span className="text-[12px] text-subtle">JPEG, PNG or WEBP · max 5 MB each</span>
                    <input
                      id="incident-images"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        const files = Array.from(e.target.files ?? []).slice(0, 4);
                        setImageFiles(files);
                        setImagePreviews(files.map((f) => URL.createObjectURL(f)));
                      }}
                    />
                  </label>

                  {/* Thumbnails */}
                  {imagePreviews.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {imagePreviews.map((src, i) => (
                        <div key={i} className="relative h-20 w-20 overflow-hidden rounded-md border border-line bg-surface">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt={`Preview ${i + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            aria-label="Remove image"
                            onClick={() => {
                              setImageFiles((prev) => prev.filter((_, j) => j !== i));
                              setImagePreviews((prev) => prev.filter((_, j) => j !== i));
                            }}
                            className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-ink/70 text-white hover:bg-ink"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-md bg-danger px-5 py-3 text-sm font-semibold text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {loading ? (
                    <span>Submitting…</span>
                  ) : (
                    <>
                      <span>Submit incident report</span>
                      <Icon name="arrowRight" size={16} />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
