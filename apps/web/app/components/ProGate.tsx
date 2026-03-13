import type { ReactNode } from "react";

interface ProGateProps {
  children: ReactNode;
  isPro: boolean;
  feature?: string;
}

export function ProGate({
  children,
  isPro,
  feature = "This feature",
}: ProGateProps) {
  if (isPro) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="pointer-events-none select-none opacity-30 blur-[2px]">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="glass rounded-xl p-6 text-center max-w-sm">
          <div className="mx-auto w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-3">
            <svg
              className="w-6 h-6 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
              />
            </svg>
          </div>
          <h3 className="font-heading font-semibold text-zinc-100">
            Pro Feature
          </h3>
          <p className="text-sm text-zinc-400 mt-1">
            {feature} requires a Pro subscription.
          </p>
          <a
            href="/dashboard/settings"
            className="inline-block mt-4 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors"
          >
            Upgrade to Pro
          </a>
        </div>
      </div>
    </div>
  );
}
