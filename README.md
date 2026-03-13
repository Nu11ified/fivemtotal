# FiveMTotal Guard

Open-source runtime protection for FiveM servers. Hooks dangerous Lua globals to prevent malware from executing on your server.

## What It Does

The guard resource hooks into FiveM's Lua environment **before** other resources load, intercepting dangerous function calls and enforcing per-resource security policies.

| Function | Default | Notes |
|----------|---------|-------|
| `os.execute` | Blocked | Host escape prevention |
| `os.getenv` | Blocked | Host escape prevention |
| `io.popen` | Blocked | Host escape prevention |
| `load` / `loadstring` | Blocked | Dynamic code execution — allowlist trusted resources |
| `PerformHttpRequest` | Logged | Blocked if target domain is on threat blacklist |
| `SaveResourceFile` | Restricted | Only allowed to write to own resource path |
| `GetConvar` | Logged | Blocked for non-allowlisted resources |

### Features

- **Per-resource policies** — Allowlist specific functions for trusted resources (e.g., `es_extended`)
- **Domain blacklisting** — Blocks HTTP requests to known malware panel domains
- **Cross-resource write protection** — Prevents resources from modifying other resources
- **Violation reporting** — Batches and reports violations to the FiveMTotal platform
- **Exponential backoff** — Graceful handling of API connectivity issues
- **Zero dependencies** — Pure Lua, no external libraries required

## Installation

1. Copy the `lua/guard/` folder into your server's `resources/` directory
2. Edit `config.lua` with your FiveMTotal API endpoint and key
3. Add to the **top** of your `server.cfg`:

```
ensure fivemtotal-guard
```

> **Important:** The guard must load before all other resources so it can hook globals before they're called.

## Configuration

Edit `lua/guard/config.lua`:

```lua
Config = {
  Endpoint = "https://api.fivemtotal.com",  -- FiveMTotal API
  ApiKey = "your-api-key-here",              -- From your dashboard
  PollInterval = 300,                        -- Policy refresh (seconds)
  BatchInterval = 30,                        -- Event batch POST (seconds)
  MaxLocalEvents = 500,                      -- Max queued events
  MaxEventsPerPost = 100,                    -- Max events per POST
  Debug = false,                             -- Console logging
}
```

## How It Works

1. On server start, fetches security policy from the FiveMTotal API
2. Stores original function references, then replaces globals with wrapped versions
3. Each wrapped function checks the policy before allowing execution
4. Blocked calls return `nil` and queue a violation event
5. Events are batched and reported to the platform every 30 seconds
6. Policy refreshes every 5 minutes

## Get a Free Account

Sign up at [fivemtotal.com](https://fivemtotal.com) to get your API key and access the scanning platform.

## License

MIT
