import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="relative">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Radial glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-24 pb-20 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-zinc-400 mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-severity-safe animate-pulse" />
            Scanning FiveM resources since 2024
          </div>

          <h1 className="font-heading text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-50 max-w-4xl mx-auto leading-tight">
            Protect Your{" "}
            <span className="text-accent">FiveM Server</span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
            Advanced malware scanning, runtime protection, and threat intelligence
            for FiveM server resources. Stop malicious scripts before they compromise
            your community.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/register"
              className="conic-border px-8 py-3 text-sm font-semibold text-white bg-accent hover:bg-accent-hover rounded-xl transition-all hover:scale-105 shadow-lg shadow-accent/20"
            >
              Start Scanning Free
            </Link>
            <Link
              to="/dashboard/scan/"
              className="px-8 py-3 text-sm font-medium text-zinc-300 border border-white/10 rounded-xl hover:bg-white/5 transition-colors"
            >
              Upload a Resource
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-zinc-100">
            Everything You Need
          </h2>
          <p className="mt-3 text-zinc-400 max-w-xl mx-auto">
            Comprehensive security tooling designed specifically for FiveM server operators.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            }
            title="Malware Scanner"
            description="Deep analysis of Lua scripts with pattern matching, obfuscation detection, and behavioral analysis."
          />
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            }
            title="Runtime Guard"
            description="Real-time protection with server-side policy enforcement and violation monitoring."
          />
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zM12 12.75h.008v.008H12v-.008z" />
              </svg>
            }
            title="Threat Feed"
            description="Community-driven threat intelligence with malware family tracking and IOC indicators."
          />
          <FeatureCard
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
              </svg>
            }
            title="CI/CD Integration"
            description="Integrate scanning into your deployment pipeline with our REST API and API key management."
          />
        </div>
      </section>

      {/* Pricing Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-20">
        <div className="text-center mb-16">
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-zinc-100">
            Simple Pricing
          </h2>
          <p className="mt-3 text-zinc-400 max-w-xl mx-auto">
            Start free and upgrade when you need more power.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 max-w-3xl mx-auto gap-6">
          {/* Free Plan */}
          <div className="glass rounded-2xl p-8">
            <h3 className="font-heading text-xl font-bold text-zinc-100">Free</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-heading font-extrabold text-zinc-100">$0</span>
              <span className="text-zinc-500">/month</span>
            </div>
            <ul className="mt-8 space-y-3">
              <PricingFeature included>10 scans per day</PricingFeature>
              <PricingFeature included>Basic malware detection</PricingFeature>
              <PricingFeature included>Scan history (30 days)</PricingFeature>
              <PricingFeature included>1 API key</PricingFeature>
              <PricingFeature>Runtime Guard</PricingFeature>
              <PricingFeature>Threat feed alerts</PricingFeature>
              <PricingFeature>Server monitoring</PricingFeature>
            </ul>
            <Link
              to="/register"
              className="mt-8 block w-full text-center px-4 py-2.5 text-sm font-medium border border-white/10 rounded-xl text-zinc-300 hover:bg-white/5 transition-colors"
            >
              Get Started
            </Link>
          </div>

          {/* Pro Plan */}
          <div className="conic-border rounded-2xl p-8 relative">
            <div className="absolute -top-3 right-6 px-3 py-0.5 rounded-full bg-accent text-xs font-semibold text-white">
              Popular
            </div>
            <h3 className="font-heading text-xl font-bold text-zinc-100">Pro</h3>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-4xl font-heading font-extrabold text-zinc-100">$10</span>
              <span className="text-zinc-500">/month</span>
            </div>
            <ul className="mt-8 space-y-3">
              <PricingFeature included>Unlimited scans</PricingFeature>
              <PricingFeature included>Advanced malware detection</PricingFeature>
              <PricingFeature included>Full scan history</PricingFeature>
              <PricingFeature included>Unlimited API keys</PricingFeature>
              <PricingFeature included>Runtime Guard</PricingFeature>
              <PricingFeature included>Threat feed alerts</PricingFeature>
              <PricingFeature included>Server monitoring</PricingFeature>
            </ul>
            <Link
              to="/register"
              className="mt-8 block w-full text-center px-4 py-2.5 text-sm font-semibold bg-accent hover:bg-accent-hover text-white rounded-xl transition-colors"
            >
              Start Pro Trial
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-sm text-zinc-600">
            &copy; {new Date().getFullYear()} FiveMTotal. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="glass rounded-xl p-6 group hover:bg-white/[0.07] transition-all duration-200">
      <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center text-accent mb-4 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="font-heading font-semibold text-zinc-100">{title}</h3>
      <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{description}</p>
    </div>
  );
}

function PricingFeature({
  children,
  included = false,
}: {
  children: React.ReactNode;
  included?: boolean;
}) {
  return (
    <li className="flex items-center gap-3 text-sm">
      {included ? (
        <svg
          className="w-4 h-4 text-severity-safe flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg
          className="w-4 h-4 text-zinc-600 flex-shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      )}
      <span className={included ? "text-zinc-300" : "text-zinc-600"}>
        {children}
      </span>
    </li>
  );
}
