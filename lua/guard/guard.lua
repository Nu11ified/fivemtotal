-- guard.lua
-- Function hooking and enforcement for FiveMTotal Guard.
-- Hooks dangerous Lua/FiveM globals, enforces policy, and queues events.

-- ---------------------------------------------------------------------------
-- Ensure the global namespace exists (api.lua creates it, but be safe)
-- ---------------------------------------------------------------------------

FiveMTotal = FiveMTotal or {}

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

local function DebugLog(msg)
  if Config.Debug then
    print("[FiveMTotal] " .. msg)
  end
end

-- ---------------------------------------------------------------------------
-- Store original function references BEFORE any hooking
-- ---------------------------------------------------------------------------

local _originalOsExecute       = os.execute
local _originalOsGetenv        = os.getenv
local _originalIoPopen         = io.popen
local _originalLoad            = load
local _originalLoadstring      = loadstring
local _originalPerformHttp     = PerformHttpRequest
local _originalSaveResourceFile = SaveResourceFile
local _originalGetConvar       = GetConvar

-- ---------------------------------------------------------------------------
-- Event construction and queuing
-- ---------------------------------------------------------------------------

--- Build an event table and enqueue it.
---@param eventType string    "blocked" | "allowed" | "logged" | "critical"
---@param resource  string    resource name
---@param funcName  string    hooked function name
---@param details   any       extra context (args, url, etc.)
local function QueueEvent(eventType, resource, funcName, details)
  local event = {
    resourceName  = resource,
    eventType     = eventType,
    functionName  = funcName,
    details       = details,
    timestamp     = os.time(),
  }

  FiveMTotal.EnqueueEvent(event)

  -- Critical events (e.g., host-escape attempts) trigger an immediate flush
  if eventType == "critical" then
    FiveMTotal.FlushEvents()
  end
end

-- ---------------------------------------------------------------------------
-- Policy evaluation
-- ---------------------------------------------------------------------------

--- Determine whether a resource is allowed to call a given function.
---@param resource     string
---@param functionName string
---@return boolean
local function IsAllowed(resource, functionName)
  local policy = FiveMTotal.GetPolicy()
  if not policy then
    -- No policy loaded yet; default to deny for safety
    return false
  end

  -- Check resource-specific policies first
  local resPolicies = policy.resource_policies
  if resPolicies and resPolicies[resource] then
    local rp = resPolicies[resource]

    -- Explicit allow list
    if rp.allow then
      for _, fn in ipairs(rp.allow) do
        if fn == functionName then
          return true
        end
      end
    end

    -- Explicit deny list
    if rp.deny then
      for _, fn in ipairs(rp.deny) do
        if fn == functionName then
          return false
        end
      end
    end
  end

  -- Fall back to default_policy
  local default = policy.default_policy
  if default == "allow" then
    return true
  end

  -- "deny" or anything else defaults to blocked
  return false
end

-- ---------------------------------------------------------------------------
-- Domain checking helper for PerformHttpRequest hook
-- ---------------------------------------------------------------------------

--- Extract the hostname from a URL string.
---@param url string
---@return string|nil
local function ExtractDomain(url)
  -- Match protocol://host or just host
  local domain = url:match("^%w+://([^/:]+)")
  if not domain then
    domain = url:match("^([^/:]+)")
  end
  return domain
end

--- Check whether a domain is on the blocked list.
---@param url string
---@return boolean
local function IsDomainBlocked(url)
  local policy = FiveMTotal.GetPolicy()
  if not policy or not policy.blocked_domains then
    return false
  end

  local domain = ExtractDomain(url)
  if not domain then
    return false
  end

  for _, blocked in ipairs(policy.blocked_domains) do
    -- Simple substring match: the extracted domain contains the blocked entry
    if domain:find(blocked, 1, true) then
      return true
    end
  end

  return false
end

-- ---------------------------------------------------------------------------
-- Install hooks
-- ---------------------------------------------------------------------------

--- os.execute -- blocked by default
os.execute = function(...)
  local resource = GetInvokingResource() or "unknown"
  if IsAllowed(resource, "os.execute") then
    DebugLog("[ALLOWED] " .. resource .. " -> os.execute")
    QueueEvent("allowed", resource, "os.execute", { args = { ... } })
    return _originalOsExecute(...)
  end
  DebugLog("[BLOCKED] " .. resource .. " -> os.execute")
  QueueEvent("critical", resource, "os.execute", { args = { ... } })
  return nil
end

--- os.getenv -- blocked by default
os.getenv = function(...)
  local resource = GetInvokingResource() or "unknown"
  if IsAllowed(resource, "os.getenv") then
    DebugLog("[ALLOWED] " .. resource .. " -> os.getenv")
    QueueEvent("allowed", resource, "os.getenv", { args = { ... } })
    return _originalOsGetenv(...)
  end
  DebugLog("[BLOCKED] " .. resource .. " -> os.getenv")
  QueueEvent("blocked", resource, "os.getenv", { args = { ... } })
  return nil
end

--- io.popen -- blocked by default
io.popen = function(...)
  local resource = GetInvokingResource() or "unknown"
  if IsAllowed(resource, "io.popen") then
    DebugLog("[ALLOWED] " .. resource .. " -> io.popen")
    QueueEvent("allowed", resource, "io.popen", { args = { ... } })
    return _originalIoPopen(...)
  end
  DebugLog("[BLOCKED] " .. resource .. " -> io.popen")
  QueueEvent("critical", resource, "io.popen", { args = { ... } })
  return nil
end

--- load -- blocked unless allowlisted
load = function(...)
  local resource = GetInvokingResource() or "unknown"
  if IsAllowed(resource, "load") then
    DebugLog("[ALLOWED] " .. resource .. " -> load")
    QueueEvent("allowed", resource, "load", {})
    return _originalLoad(...)
  end
  DebugLog("[BLOCKED] " .. resource .. " -> load")
  QueueEvent("blocked", resource, "load", {})
  return nil
end

--- loadstring -- blocked unless allowlisted
loadstring = function(...)
  local resource = GetInvokingResource() or "unknown"
  if IsAllowed(resource, "loadstring") then
    DebugLog("[ALLOWED] " .. resource .. " -> loadstring")
    QueueEvent("allowed", resource, "loadstring", {})
    return _originalLoadstring(...)
  end
  DebugLog("[BLOCKED] " .. resource .. " -> loadstring")
  QueueEvent("blocked", resource, "loadstring", {})
  return nil
end

--- PerformHttpRequest -- allowed but logged; blocked domains are suppressed
PerformHttpRequest = function(url, callback, method, data, headers, ...)
  local resource = GetInvokingResource() or "unknown"

  if IsDomainBlocked(url) then
    DebugLog("[BLOCKED] " .. resource .. " -> PerformHttpRequest (" .. tostring(url) .. ")")
    QueueEvent("blocked", resource, "PerformHttpRequest", { url = url, reason = "blocked_domain" })
    -- Suppress the request entirely; do not invoke callback
    return nil
  end

  DebugLog("[LOGGED] " .. resource .. " -> PerformHttpRequest (" .. tostring(url) .. ")")
  QueueEvent("logged", resource, "PerformHttpRequest", { url = url, method = method })
  return _originalPerformHttp(url, callback, method, data, headers, ...)
end

--- SaveResourceFile -- allowed only to own resource path
SaveResourceFile = function(resourceName, fileName, data, dataLength, ...)
  local resource = GetInvokingResource() or "unknown"

  -- Determine the invoking resource's own path
  local ownPath = GetResourcePath(resource)
  local targetPath = GetResourcePath(resourceName)

  -- If the target resource path differs from the invoking resource's path, block it
  if ownPath and targetPath and ownPath ~= targetPath then
    DebugLog("[BLOCKED] " .. resource .. " -> SaveResourceFile (target: " .. tostring(resourceName) .. ")")
    QueueEvent("blocked", resource, "SaveResourceFile", {
      target_resource = resourceName,
      file_name       = fileName,
      reason          = "cross_resource_write",
    })
    return nil
  end

  DebugLog("[ALLOWED] " .. resource .. " -> SaveResourceFile")
  QueueEvent("logged", resource, "SaveResourceFile", {
    target_resource = resourceName,
    file_name       = fileName,
  })
  return _originalSaveResourceFile(resourceName, fileName, data, dataLength, ...)
end

--- GetConvar -- logged, blocked for non-allowlisted resources
GetConvar = function(...)
  local resource = GetInvokingResource() or "unknown"
  if IsAllowed(resource, "GetConvar") then
    DebugLog("[ALLOWED] " .. resource .. " -> GetConvar")
    QueueEvent("logged", resource, "GetConvar", { args = { ... } })
    return _originalGetConvar(...)
  end
  DebugLog("[BLOCKED] " .. resource .. " -> GetConvar")
  QueueEvent("blocked", resource, "GetConvar", { args = { ... } })
  return nil
end

-- ---------------------------------------------------------------------------
-- Expose QueueEvent for use by scanner.lua and other guard modules
-- ---------------------------------------------------------------------------

FiveMTotal.QueueEvent = QueueEvent
FiveMTotal._rawSaveResourceFile = _originalSaveResourceFile

-- ---------------------------------------------------------------------------
-- Timers: policy refresh and event batch POST
-- ---------------------------------------------------------------------------

--- Periodic policy refresh thread
Citizen.CreateThread(function()
  -- Initial policy fetch on resource start
  FiveMTotal.FetchPolicy()

  while true do
    Citizen.Wait(Config.PollInterval * 1000)
    FiveMTotal.FetchPolicy()
  end
end)

--- Periodic event batch POST thread (respects exponential backoff on failure)
Citizen.CreateThread(function()
  while true do
    local delay = math.max(Config.BatchInterval, FiveMTotal.GetBackoffDelay())
    Citizen.Wait(delay * 1000)
    FiveMTotal.PostEvents()
  end
end)

-- ---------------------------------------------------------------------------
-- Startup banner
-- ---------------------------------------------------------------------------

print("[FiveMTotal] Guard v1.0.0 loaded - " .. 7 .. " function hooks active")
