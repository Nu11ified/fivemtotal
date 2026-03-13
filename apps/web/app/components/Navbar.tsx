import { Link } from "@tanstack/react-router";
import { useSession, signOut } from "../lib/auth-client";
import { useState } from "react";

export function Navbar() {
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = session?.user;
  const isAdmin = (user as { role?: string } | undefined)?.role === "admin";

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-xl bg-surface border-b border-surface-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
              <span className="text-white font-bold text-sm">FM</span>
            </div>
            <span className="font-heading font-bold text-lg text-zinc-100">
              FiveM<span className="text-accent">Total</span>
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors [&.active]:text-accent"
            >
              Home
            </Link>
            {user && (
              <Link
                to="/dashboard/"
                className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors [&.active]:text-accent"
              >
                Dashboard
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/admin/"
                className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors [&.active]:text-accent"
              >
                Admin
              </Link>
            )}
          </div>

          {/* Auth buttons */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-zinc-400">{user.name}</span>
                <button
                  onClick={() => signOut()}
                  className="px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-100 border border-white/10 rounded-lg hover:bg-white/5 transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-3 py-1.5 text-sm text-zinc-300 hover:text-zinc-100 transition-colors"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="px-4 py-1.5 text-sm font-medium bg-accent hover:bg-accent-hover text-white rounded-lg transition-colors"
                >
                  Register
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 text-zinc-400 hover:text-zinc-100"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden py-4 border-t border-white/5 space-y-2">
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-white/5"
            >
              Home
            </Link>
            {user && (
              <Link
                to="/dashboard/"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-white/5"
              >
                Dashboard
              </Link>
            )}
            {isAdmin && (
              <Link
                to="/admin/"
                onClick={() => setMobileOpen(false)}
                className="block px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-white/5"
              >
                Admin
              </Link>
            )}
            <div className="pt-2 border-t border-white/5">
              {user ? (
                <button
                  onClick={() => {
                    signOut();
                    setMobileOpen(false);
                  }}
                  className="block w-full text-left px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-white/5"
                >
                  Logout
                </button>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 text-sm text-zinc-400 hover:text-zinc-100 rounded-lg hover:bg-white/5"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 text-sm text-accent hover:text-accent-hover rounded-lg hover:bg-white/5"
                  >
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
