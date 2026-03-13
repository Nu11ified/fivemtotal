# FiveMTotal

Open-source malware scanner and runtime protection for FiveM servers.

## What It Does

- **Malware Scanner** — Deep analysis engine for FiveM resource archives. Detects remote loaders (`PerformHttpRequest` + `load` chains), propagators (cross-resource writes), exfiltrators (`GetConvar` + HTTP), host escape (`os.execute`, `io.popen`), and obfuscated payloads. 6-phase pipeline: unpack, hash check, static analysis, deobfuscation, IOC matching, rule engine.
- **Runtime Guard** — Lua resource that hooks dangerous globals on your FiveM server, enforcing per-resource policies and reporting violations. Blocks `os.execute`, `io.popen`, unauthorized `load`/`loadstring`, IOC-blacklisted HTTP requests, and cross-resource file writes.

## Detection Coverage

| Family | Coverage |
|--------|----------|
| Cipher-Panel | Full — loader chain, propagation, exfil, panel URL patterns |
| Blum-Panel | IOC/campaign tracking — known domains, loader conventions |
| Generic Loader | `PerformHttpRequest` + dynamic execution |
| Generic Propagator | Cross-resource writes, manifest tampering |
| Generic Exfiltrator | `GetConvar` + outbound HTTP |
| Host Escape | `os.execute`, `io.popen`, shell execution |

### Deobfuscation

The scanner normalizes obfuscated Lua before re-running analysis:
- Hex array reconstruction (`{0x48, 0x65, ...}` → string)
- `\xNN` escape decoding
- `string.char(...)` folding
- String concatenation folding (`"a" .. "b"` → `"ab"`)
- Base64 detection and decoding
- URL/domain extraction from normalized output

## Project Structure

```
fivemtotal/
├── apps/
│   └── scanner/      # Scan worker (6-phase analysis pipeline)
├── packages/
│   ├── shared/       # Types, constants, Zod schemas
│   └── db/           # Drizzle schema + migrations
└── lua/
    └── guard/        # FiveM runtime protection resource
```

## Getting Started

### Scanner

```bash
# Install dependencies
bun install

# Configure database
cp .env.example .env
# Set DATABASE_URL

# Run migrations and seed threat data
bun run db:migrate
bun run db:seed

# Start the scanner worker
bun run apps/scanner/src/index.ts
```

The scanner polls a PostgreSQL job queue. Feed it scan jobs via the `scan_jobs` table or integrate with your own API.

### FiveM Guard

1. Copy `lua/guard/` to your FiveM server's `resources/` directory
2. Edit `config.lua` with your API endpoint and key
3. Add `ensure fivemtotal-guard` to the **top** of your `server.cfg`

> The guard must load before other resources to hook globals before they're called.

#### What It Blocks

| Function | Default | Notes |
|----------|---------|-------|
| `os.execute` | Blocked | Host escape |
| `os.getenv` | Blocked | Host escape |
| `io.popen` | Blocked | Host escape |
| `load` / `loadstring` | Blocked | Unless resource is allowlisted |
| `PerformHttpRequest` | Logged | Blocked if target domain is on IOC blacklist |
| `SaveResourceFile` | Restricted | Only allowed to own resource path |
| `GetConvar` | Logged | Blocked for non-allowlisted resources |

Per-resource policies can allowlist specific functions for trusted resources like `es_extended`.

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Database | PostgreSQL + [Drizzle ORM](https://orm.drizzle.team) |
| FiveM Guard | Lua |

## License

MIT
