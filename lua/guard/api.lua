-- api.lua
-- HTTP communication module for FiveMTotal Guard
-- Handles policy fetching and event posting with exponential backoff.

FiveMTotal = FiveMTotal or {}

-- ---------------------------------------------------------------------------
-- Internal state
-- ---------------------------------------------------------------------------

local _eventQueue    = {}   -- array of event tables
local _currentPolicy = nil  -- last successfully fetched policy

-- Exponential-backoff state for event POST
local _backoffDelay    = 30   -- current delay in seconds (doubles on failure)
local _backoffMin      = 30
local _backoffMax      = 300  -- 5 minutes cap

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Capture the original PerformHttpRequest at load time, before guard.lua hooks
-- it.  This ensures the guard's own HTTP calls are never intercepted by itself.
local _rawPerformHttpRequest = PerformHttpRequest

local function DebugLog(msg)
  if Config.Debug then
    print("[FiveMTotal] " .. msg)
  end
end

--- Build the full URL for a given API path.
---@param path string  e.g. "/api/guard/policy"
---@return string
local function ApiUrl(path)
  -- Strip trailing slash from Endpoint to avoid double-slash
  local base = Config.Endpoint:gsub("/$", "")
  return base .. path
end

--- Return standard headers used for every API call.
---@return table
local function AuthHeaders()
  return {
    ["Authorization"] = "Bearer " .. Config.ApiKey,
    ["Content-Type"]  = "application/json",
  }
end

-- ---------------------------------------------------------------------------
-- Policy fetching
-- ---------------------------------------------------------------------------

--- GET /api/guard/policy
--- On success: stores the decoded policy table.
--- On failure: logs a warning and keeps the last-known policy.
function FiveMTotal.FetchPolicy()
  local url     = ApiUrl("/api/guard/policy")
  local headers = AuthHeaders()

  DebugLog("Fetching policy from " .. url)

  _rawPerformHttpRequest(url, function(statusCode, responseBody, _responseHeaders)
    if statusCode >= 200 and statusCode < 300 and responseBody then
      local ok, decoded = pcall(json.decode, responseBody)
      if ok and type(decoded) == "table" then
        _currentPolicy = decoded
        DebugLog("Policy updated successfully")
      else
        print("[FiveMTotal] [WARN] Failed to parse policy JSON: " .. tostring(responseBody))
      end
    else
      print("[FiveMTotal] [WARN] Policy fetch failed (HTTP " .. tostring(statusCode) .. ")")
    end
  end, "GET", "", headers)
end

--- Return the current in-memory policy table (may be nil before first fetch).
---@return table|nil
function FiveMTotal.GetPolicy()
  return _currentPolicy
end

-- ---------------------------------------------------------------------------
-- Event queue management
-- ---------------------------------------------------------------------------

--- Add an event to the local queue, dropping oldest if over capacity.
---@param event table
function FiveMTotal.EnqueueEvent(event)
  _eventQueue[#_eventQueue + 1] = event

  -- Drop oldest events when the queue exceeds the configured maximum
  while #_eventQueue > Config.MaxLocalEvents do
    table.remove(_eventQueue, 1)
  end
end

--- Return the current queue length (useful for debugging).
---@return number
function FiveMTotal.GetQueueLength()
  return #_eventQueue
end

-- ---------------------------------------------------------------------------
-- Event posting with exponential backoff
-- ---------------------------------------------------------------------------

--- POST /api/guard/events
--- Sends up to MaxEventsPerPost events from the front of the queue.
--- On success: removes posted events, resets backoff.
--- On failure: keeps events, doubles backoff delay (capped at 5 min).
function FiveMTotal.PostEvents()
  if #_eventQueue == 0 then
    return
  end

  local count = math.min(#_eventQueue, Config.MaxEventsPerPost)
  local batch = {}
  for i = 1, count do
    batch[i] = _eventQueue[i]
  end

  local url     = ApiUrl("/api/guard/events")
  local headers = AuthHeaders()
  local body    = json.encode(batch)

  DebugLog("Posting " .. count .. " events to " .. url)

  _rawPerformHttpRequest(url, function(statusCode, _responseBody, _responseHeaders)
    if statusCode >= 200 and statusCode < 300 then
      -- Remove the successfully posted events from the front of the queue
      for _ = 1, count do
        table.remove(_eventQueue, 1)
      end
      _backoffDelay = _backoffMin
      DebugLog("Event POST success, " .. #_eventQueue .. " events remaining in queue")
    else
      -- Double the backoff delay, capped at max
      _backoffDelay = math.min(_backoffDelay * 2, _backoffMax)
      print("[FiveMTotal] [WARN] Event POST failed (HTTP " .. tostring(statusCode) .. "), next retry in " .. _backoffDelay .. "s")
    end
  end, "POST", body, headers)
end

--- Trigger an immediate POST (used for critical events).
function FiveMTotal.FlushEvents()
  FiveMTotal.PostEvents()
end

--- Return the current backoff delay (exposed for the timer in guard.lua).
---@return number seconds
function FiveMTotal.GetBackoffDelay()
  return _backoffDelay
end
