"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Icon from "@/components/Icon";

const inputClass =
  "w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm text-ink transition-colors placeholder:text-subtle focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";
const labelClass = "mb-1.5 block text-[13px] font-semibold text-navy";

type Tab = "user" | "driver";

export default function SignupPage() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("user");

  // Shared account fields (match the User model + register schema)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Driver profile fields (driverProfile in the register schema)
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [truckNo, setTruckNo] = useState("");
  const [vehicleType, setVehicleType] = useState<"truck" | "van" | "other">("truck");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const resetError = () => setError(null);

  const switchTab = (next: Tab) => {
    setTab(next);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter them.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    // Build a payload that matches the register schema exactly.
    const payload: Record<string, unknown> = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password,
      role: tab, // "user" | "driver"
    };

    if (tab === "driver") {
      payload.driverProfile = {
        licenseNumber: licenseNumber.trim(),
        licenseExpiry, // YYYY-MM-DD → coerced to Date server-side
        truckNo: truckNo.trim().toUpperCase(),
        vehicleType,
      };
    }

    setLoading(true);
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 409) {
          setError(data?.message || "An account with this email or phone already exists.");
        } else if (res.status === 400) {
          setError(data?.message || "Please check the highlighted fields and try again.");
        } else {
          setError(data?.message || "Registration failed. Please try again.");
        }
        setLoading(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-canvas text-ink">
      <Navbar />

      <main id="main" className="w-full flex-1 py-12 sm:py-16">
        <div className="mx-auto w-full max-w-2xl px-4 sm:px-6">
          {/* Header */}
          <div className="mb-7 text-center">
            <span className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-primary">
              <Icon name="user" size={13} />
              Registration &amp; activation
            </span>
            <h1 className="text-[26px] font-bold tracking-tight text-ink">
              Create your MAARG account
            </h1>
            <p className="mt-2 text-sm text-muted">
              Register as a public user, or activate your government-assigned driver account.
            </p>
          </div>

          {submitted ? (
            <div className="rounded-card border border-line bg-surface p-8 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-safe-line bg-safe-bg text-safe">
                <Icon name="checkCircle" size={30} />
              </span>
              <h3 className="mt-4 text-lg font-bold text-navy">
                {tab === "user" ? "Account created" : "Driver account registered"}
              </h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted">
                Your account has been created successfully. Sign in with your email and password to
                access your portal.
              </p>
              <button
                type="button"
                onClick={() => router.push("/login")}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600"
              >
                <span>Continue to sign in</span>
                <Icon name="arrowRight" size={16} />
              </button>
            </div>
          ) : (
            <>
              {/* Tabs */}
              <div className="mb-6 grid grid-cols-2 gap-2 rounded-card border border-line bg-surface p-1.5">
                <button
                  type="button"
                  onClick={() => switchTab("user")}
                  className={`flex items-center justify-center gap-1.5 rounded-md py-2.5 text-[13px] font-semibold transition-colors ${
                    tab === "user" ? "bg-primary text-white" : "text-muted hover:text-navy"
                  }`}
                >
                  <Icon name="user" size={15} />
                  Public user
                </button>
                <button
                  type="button"
                  onClick={() => switchTab("driver")}
                  className={`flex items-center justify-center gap-1.5 rounded-md py-2.5 text-[13px] font-semibold transition-colors ${
                    tab === "driver" ? "bg-india text-white" : "text-muted hover:text-navy"
                  }`}
                >
                  <Icon name="truck" size={15} />
                  Driver activation
                </button>
              </div>

              {/* Form card */}
              <div className="rounded-card border border-line bg-surface p-7">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="border-b border-line pb-3">
                    <h3 className="text-base font-semibold text-navy">
                      {tab === "user" ? "Public user details" : "Driver account details"}
                    </h3>
                    <p className="mt-0.5 text-[13px] text-muted">
                      {tab === "user"
                        ? "For citizens planning journeys and checking route accessibility."
                        : "Register your assigned truck and licence to receive missions."}
                    </p>
                  </div>

                  {error && (
                    <div
                      role="alert"
                      className="flex items-start gap-2.5 rounded-md border border-danger-line bg-danger-bg p-3 text-[13px] font-medium text-danger"
                    >
                      <Icon name="alertTriangle" size={16} className="mt-0.5 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* Identity */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="name" className={labelClass}>
                        Full name
                      </label>
                      <input
                        id="name"
                        type="text"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          resetError();
                        }}
                        placeholder="Ramesh Kumar"
                        className={inputClass}
                        minLength={2}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="phone" className={labelClass}>
                        Phone number
                      </label>
                      <input
                        id="phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+91 98765 43210"
                        className={inputClass}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="email" className={labelClass}>
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={inputClass}
                      required
                    />
                  </div>

                  {/* Driver-only profile */}
                  {tab === "driver" && (
                    <div className="space-y-4 rounded-md border border-line bg-canvas p-4">
                      <p className="flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-widest text-india-600">
                        <Icon name="truck" size={14} />
                        Driver &amp; vehicle profile
                      </p>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="licenseNumber" className={labelClass}>
                            Driving licence number
                          </label>
                          <input
                            id="licenseNumber"
                            type="text"
                            value={licenseNumber}
                            onChange={(e) => setLicenseNumber(e.target.value)}
                            placeholder="AS-01-2022-009182"
                            className={inputClass}
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="licenseExpiry" className={labelClass}>
                            Licence expiry date
                          </label>
                          <input
                            id="licenseExpiry"
                            type="date"
                            value={licenseExpiry}
                            onChange={(e) => setLicenseExpiry(e.target.value)}
                            className={inputClass}
                            required
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label htmlFor="truckNo" className={labelClass}>
                            Truck / vehicle number
                          </label>
                          <input
                            id="truckNo"
                            type="text"
                            value={truckNo}
                            onChange={(e) => setTruckNo(e.target.value)}
                            placeholder="AS01AB1234"
                            className={`${inputClass} uppercase`}
                            required
                          />
                        </div>
                        <div>
                          <label htmlFor="vehicleType" className={labelClass}>
                            Vehicle type
                          </label>
                          <select
                            id="vehicleType"
                            value={vehicleType}
                            onChange={(e) =>
                              setVehicleType(e.target.value as "truck" | "van" | "other")
                            }
                            className={inputClass}
                          >
                            <option value="truck">Truck</option>
                            <option value="van">Van</option>
                            <option value="other">Other</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Passwords */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label htmlFor="password" className={labelClass}>
                        Password
                      </label>
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        className={inputClass}
                        minLength={6}
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="confirmPassword" className={labelClass}>
                        Confirm password
                      </label>
                      <input
                        id="confirmPassword"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-enter password"
                        className={inputClass}
                        minLength={6}
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className={`mt-2 flex w-full items-center justify-center gap-2 rounded-md px-5 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-70 ${
                      tab === "driver" ? "bg-india hover:bg-india-600" : "bg-primary hover:bg-primary-600"
                    }`}
                  >
                    {loading ? (
                      <span>Creating account…</span>
                    ) : (
                      <>
                        <span>{tab === "driver" ? "Register driver account" : "Create account"}</span>
                        <Icon name="arrowRight" size={16} />
                      </>
                    )}
                  </button>

                  <p className="border-t border-line pt-4 text-center text-[13px] text-muted">
                    Already registered?{" "}
                    <Link href="/login" className="font-semibold text-primary hover:underline">
                      Sign in
                    </Link>
                  </p>
                </form>
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
