# FiveMTotal

Open-source malware scanning, runtime protection, and threat intelligence for FiveM servers.

## What It Does

- **Malware Scanner** — Upload FiveM resource archives for deep analysis. Detects remote loaders, propagators, exfiltrators, and host escape patterns with deobfuscation support.
- **Runtime Guard** — Lua script that hooks dangerous globals on your FiveM server, enforcing per-resource policies and reporting violations in real-time.
- **Threat Feed** — Community-driven hash reputation database and IOC indicators tracking known malware families (Cipher-Panel, Blum, and more).
- **API & CI/CD** — REST API with key management for integrating scans into your build pipeline or GitHub Actions.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Frontend | [TanStack Start](https://tanstack.com/start) + [Tailwind CSS](https://tailwindcss.com) |
| API | [ElysiaJS](https://elysiajs.com) |
| Database | PostgreSQL + [Drizzle ORM](https://orm.drizzle.team) |
| Auth | [Better Auth](https://www.better-auth.com) |
| Billing | [Polar](https://polar.sh) |
| FiveM Guard | Lua |

## Project Structure

```
fivemtotal/
├── apps/
│   ├── api/          # ElysiaJS backend
│   ├── scanner/      # Scan worker (6-phase analysis pipeline)
│   └── web/          # TanStack Start frontend
├── packages/
│   ├── shared/       # Types, constants, Zod schemas
│   └── db/           # Drizzle schema + migrations
└── lua/
    └── guard/        # FiveM runtime protection resource
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) (v1.0+)
- PostgreSQL

### Setup

```bash
# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env with your DATABASE_URL and BETTER_AUTH_SECRET

# Run database migrations and seed data
bun run db:migrate
bun run db:seed

# Start the API server
bun run apps/api/src/index.ts

# Start the scan worker (separate terminal)
bun run apps/scanner/src/index.ts

# Start the frontend (separate terminal)
cd apps/web && bun run dev
```

### FiveM Guard Setup

1. Copy `lua/guard/` to your FiveM server's `resources/` directory
2. Edit `config.lua` with your API endpoint and key
3. Add `ensure fivemtotal-guard` to the **top** of your `server.cfg` (must load before other resources)

## Pricing

| Feature | Free | Pro ($10/mo) |
|---------|------|-------------|
| Web UI scans | Unlimited | Unlimited |
| API calls/day | 5 | Unlimited |
| CI/CD integration | No | Yes |
| Runtime Guard | No | Yes |
| Threat alerts | No | Yes |
| Priority queue | No | Yes |

## License

MIT
