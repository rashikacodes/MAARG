"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Icon from "@/components/Icon";
import { useAuth } from "@/lib/auth-context";


const inputClass =
  "w-full rounded-md border border-line bg-surface px-3.5 py-2.5 text-sm text-ink transition-colors placeholder:text-subtle focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/20";
const labelClass = "mb-1.5 block text-[13px] font-semibold text-navy";

export default function LoginPage() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message || "Invalid email or password. Please try again.");
        setLoading(false);
        return;
      }

      // Persist the returned profile for display; the auth token is an httpOnly cookie.
      const user = data?.user;
      // Update auth context so navbar immediately reflects the role
      setUser(user ?? null);


      // Roles are derived server-side; route to the correct portal.
      const roles: string[] = Array.isArray(user?.roles) ? user.roles : [];
      if (roles.includes("admin")) {
        router.push("/government");
      } else if (roles.includes("driver")) {
        router.push("/your-mission");
      } else {
        router.push("/user/dashboard");
      }
    } catch {
      setError("Unable to reach the server. Check your connection and try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full flex-col bg-canvas text-ink">
      <Navbar />

      <main id="main" className="w-full flex-1 py-12 sm:py-16">
        <div className="mx-auto w-full max-w-md px-4 sm:px-6">
          {/* Header */}
          <div className="mb-7 text-center">
            <span className="mb-3 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.12em] text-primary">
              <Icon name="lock" size={13} />
              Portal sign in
            </span>
            <h1 className="text-[26px] font-bold tracking-tight text-ink">Sign in to MAARG</h1>
            <p className="mt-2 text-sm text-muted">
              Enter your registered email and password to access your portal.
            </p>
          </div>

          {/* Form card */}
          <div className="rounded-card border border-line bg-surface p-7">
            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-md border border-danger-line bg-danger-bg p-3 text-[13px] font-medium text-danger"
                >
                  <Icon name="alertTriangle" size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="email" className={labelClass}>
                  Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@department.gov.in"
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className={labelClass}>
                  Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className={inputClass}
                  minLength={6}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {loading ? (
                  <span>Signing in…</span>
                ) : (
                  <>
                    <span>Sign in</span>
                    <Icon name="arrowRight" size={16} />
                  </>
                )}
              </button>
            </form>

            <p className="mt-5 border-t border-line pt-4 text-center text-[13px] text-muted">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-semibold text-primary hover:underline">
                Register or activate
              </Link>
            </p>
          </div>

          {/* Government hint */}
          <p className="mt-5 text-center text-[13px] text-muted">
            Government or authority user?{" "}
            <Link href="/government" className="font-semibold text-india hover:underline">
              Use the official portal
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
