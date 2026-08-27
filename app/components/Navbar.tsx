"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import BrandMark from "./BrandMark";
import Icon, { type IconName } from "./Icon";
import { useIsClient } from "./useIsClient";
import { useAuth } from "@/lib/auth-context";

interface NavLink {
  href: string;
  label: string;
  icon: IconName;
  match?: string;
  exact?: boolean;
}

// ─── Nav link sets per role ───────────────────────────────────────────────────

const LINKS_PUBLIC: NavLink[] = [
  { href: "/", label: "Home", icon: "navigation", exact: true },
];

const LINKS_USER: NavLink[] = [
  { href: "/", label: "Home", icon: "navigation", exact: true },
  { href: "/user/dashboard", label: "Route planner", icon: "gauge", match: "/user" },
  { href: "/report", label: "Report incident", icon: "alertTriangle", match: "/report" },
];

const LINKS_DRIVER: NavLink[] = [
  { href: "/", label: "Home", icon: "navigation", exact: true },
  { href: "/your-mission", label: "Driver mission", icon: "truck", match: "/your-mission" },
  { href: "/report", label: "Report incident", icon: "alertTriangle", match: "/report" },
];

const LINKS_ADMIN: NavLink[] = [
  { href: "/", label: "Home", icon: "navigation", exact: true },
  { href: "/government", label: "Gov dashboard", icon: "landmark", match: "/government" },
];

/* Text-size control (A- / A / A+) — standard on Indian government portals */
const SIZES = [0.9375, 1, 1.125];

function readSavedStep(): number {
  if (typeof window === "undefined") return 1;
  const saved = Number(window.localStorage.getItem("maarg-text-size"));
  return saved === 0 || saved === 1 || saved === 2 ? saved : 1;
}

function TextSizeControl() {
  const isClient = useIsClient();
  const [step, setStep] = useState<number>(readSavedStep);

  useEffect(() => {
    document.documentElement.style.fontSize = `${SIZES[step] * 100}%`;
    window.localStorage.setItem("maarg-text-size", String(step));
  }, [step]);

  const shownStep = isClient ? step : 1;
  const btn =
    "flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-white/15 disabled:opacity-35 disabled:hover:bg-transparent";

  return (
    <div className="flex items-center gap-1" role="group" aria-label="Text size">
      <button
        type="button"
        onClick={() => setStep((s) => Math.max(0, s - 1))}
        disabled={shownStep === 0}
        className={btn}
        aria-label="Decrease text size"
      >
        <span className="text-[11px] font-bold">A−</span>
      </button>
      <button
        type="button"
        onClick={() => setStep(1)}
        className={`${btn} ${shownStep === 1 ? "bg-white/15" : ""}`}
        aria-label="Reset text size"
      >
        <span className="text-[13px] font-bold">A</span>
      </button>
      <button
        type="button"
        onClick={() => setStep((s) => Math.min(2, s + 1))}
        disabled={shownStep === 2}
        className={btn}
        aria-label="Increase text size"
      >
        <span className="text-[15px] font-bold">A+</span>
      </button>
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const { user, isLoggedIn, isAdmin, isDriver, isUser, logout } = useAuth();
  const isClient = useIsClient();

  // Choose nav links based on role
  let navLinks: NavLink[] = LINKS_PUBLIC;
  if (isClient && isLoggedIn) {
    if (isAdmin) navLinks = LINKS_ADMIN;
    else if (isDriver) navLinks = LINKS_DRIVER;
    else if (isUser) navLinks = LINKS_USER;
    else navLinks = LINKS_USER; // default for any logged-in user
  }

  const isActive = (link: NavLink) => {
    if (link.exact) return pathname === link.href;
    if (link.match) return pathname.startsWith(link.match);
    return false;
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await logout();
    setSigningOut(false);
    router.push("/");
  };

  // Display name for the user chip
  const displayName = user?.name?.split(" ")[0] ?? user?.email?.split("@")[0] ?? "Account";

  return (
    <div className="w-full">
      {/* Official identity band */}
      <div className="hidden bg-navy-800 text-white/80 sm:block">
        <div className="mx-auto flex h-8 w-full max-w-[1600px] items-center justify-between px-4 text-[11.5px] sm:px-8 lg:px-12">
          <div className="flex items-center gap-2">
            <span className="tricolor-rail h-3 w-0.75 rounded-full" aria-hidden="true" />
            <span>North Eastern Region · Smart Logistics &amp; Accessibility Mission</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-white/60 md:inline">Prototype · SIH 2026</span>
            <span className="hidden text-white/25 md:inline" aria-hidden="true">|</span>
            <TextSizeControl />
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-50 w-full">
        <div className="tricolor-strip" aria-hidden="true" />
        <div className="border-b border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex h-16.5 w-full max-w-[1600px] items-center justify-between px-4 sm:px-8 lg:px-12">
            {/* Brand */}
            <Link href="/" className="flex shrink-0 items-center gap-2.5">
              <BrandMark size={38} />
              <span className="flex flex-col leading-none">
                <span className="text-lg font-bold tracking-tight text-navy">MAARG</span>
                <span className="mt-0.5 hidden text-[10px] font-medium uppercase tracking-[0.12em] text-subtle sm:block">
                  NER Logistics Intelligence
                </span>
              </span>
            </Link>

            {/* Desktop navigation */}
            <nav className="hidden items-center gap-1 lg:flex">
              {navLinks.map((link) => {
                const active = isActive(link);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative inline-flex items-center border-b-2 px-3 py-2 text-[13px] transition-colors ${
                      active
                        ? "border-saffron font-semibold text-navy"
                        : "border-transparent font-medium text-muted hover:text-primary"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            {/* Desktop actions */}
            <div className="hidden shrink-0 items-center gap-2 lg:flex">
              {isClient && isLoggedIn ? (
                <>
                  {/* User chip */}
                  <span className="inline-flex items-center gap-2 rounded-full border border-line bg-wash px-3 py-1.5 text-[13px] font-semibold text-navy">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white uppercase">
                      {displayName[0]}
                    </span>
                    <span className="max-w-30 truncate">{displayName}</span>
                    {isAdmin && (
                      <span className="rounded-full bg-india/10 px-1.5 py-0.5 text-[10px] font-semibold text-india">
                        Admin
                      </span>
                    )}
                    {isDriver && (
                      <span className="rounded-full bg-teal/10 px-1.5 py-0.5 text-[10px] font-semibold text-teal">
                        Driver
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={signingOut}
                    className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3.5 py-2 text-[13px] font-semibold text-navy transition-colors hover:border-danger hover:text-danger disabled:opacity-60"
                  >
                    <Icon name="logout" size={14} />
                    {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="inline-flex items-center rounded-md border border-line-strong bg-surface px-4 py-2 text-[13px] font-semibold text-navy transition-colors hover:border-primary hover:text-primary"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-primary-600"
                  >
                    Register
                    <Icon name="arrowRight" size={15} />
                  </Link>
                </>
              )}
            </div>

            {/* Mobile toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-navy hover:bg-wash lg:hidden"
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
            >
              <Icon name={mobileMenuOpen ? "close" : "menu"} size={24} />
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="animate-fadeIn border-b border-line bg-surface px-4 pb-6 pt-3 shadow-sm lg:hidden">
            <nav className="flex flex-col gap-1">
              {navLinks.map((link) => {
                const active = isActive(link);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-[15px] font-medium ${
                      active ? "bg-wash font-semibold text-navy" : "text-muted hover:bg-wash hover:text-navy"
                    }`}
                  >
                    <Icon name={link.icon} size={18} className={active ? "text-primary" : "text-subtle"} />
                    {link.label}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-4 border-t border-line pt-4">
              {isClient && isLoggedIn ? (
                <div className="space-y-2">
                  <p className="px-1 text-[13px] text-muted">
                    Signed in as <strong className="text-navy">{displayName}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => { setMobileMenuOpen(false); handleSignOut(); }}
                    className="flex w-full items-center justify-center gap-2 rounded-md border border-line-strong py-2.5 text-sm font-semibold text-navy hover:border-danger hover:text-danger"
                  >
                    <Icon name="logout" size={15} />
                    Sign out
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5">
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-md border border-line-strong py-2.5 text-center text-sm font-semibold text-navy"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-md bg-primary py-2.5 text-center text-sm font-semibold text-white"
                  >
                    Register
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>
    </div>
  );
}
