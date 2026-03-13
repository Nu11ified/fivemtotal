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
            <a
              href="https://github.com/Nu11ified/fivemtotal"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 text-zinc-400 hover:text-zinc-100 transition-colors"
              aria-label="GitHub"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
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
