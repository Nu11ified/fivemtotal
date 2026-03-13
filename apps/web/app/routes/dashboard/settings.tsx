import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useSession } from "../../lib/auth-client";
import { api } from "../../lib/api";

export const Route = createFileRoute("/dashboard/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const subscription = (user as { subscription?: string } | undefined)
    ?.subscription || "free";

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await api("/api/user/profile", {
        method: "PATCH",
        body: { name },
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // handle error
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <h1 className="font-heading text-2xl font-bold text-zinc-100">
          Settings
        </h1>
        <p className="text-sm text-zinc-400 mt-1">
          Manage your account and subscription
        </p>
      </div>

      {/* Profile */}
      <div className="glass rounded-xl p-6 mb-6">
        <h2 className="font-heading text-lg font-semibold text-zinc-200 mb-4">
          Profile
        </h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-accent/50"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={user?.email || ""}
              disabled
              className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-zinc-500 cursor-not-allowed"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
            {saved && (
              <span className="text-sm text-severity-safe">Saved!</span>
            )}
          </div>
        </form>
      </div>

      {/* Subscription */}
      <div className="glass rounded-xl p-6">
        <h2 className="font-heading text-lg font-semibold text-zinc-200 mb-4">
          Subscription
        </h2>
        <div className="flex items-center justify-between p-4 bg-black/30 rounded-lg border border-white/5">
          <div>
            <p className="text-sm font-medium text-zinc-200 capitalize">
              {subscription} Plan
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {subscription === "pro"
                ? "Unlimited scans, runtime guard, and more"
                : "10 scans per day, basic features"}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              subscription === "pro"
                ? "bg-accent/10 text-accent"
                : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {subscription === "pro" ? "Active" : "Free"}
          </span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          {subscription === "pro" ? (
            <button className="px-4 py-2 border border-white/10 text-zinc-400 text-sm font-medium rounded-lg hover:bg-white/5 transition-colors">
              Cancel Subscription
            </button>
          ) : (
            <button className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors">
              Upgrade to Pro - $10/mo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
