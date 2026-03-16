-- scanner.lua
-- Resource hash checking, blocklist delta sync, and file quarantine
-- for FiveMTotal Guard.
--
-- Loads AFTER api.lua and guard.lua, so the following are available:
--   FiveMTotal._rawHttp    (raw PerformHttpRequest)
--   FiveMTotal.ApiUrl      (URL builder)
--   FiveMTotal.AuthHeaders (auth header builder)
--   FiveMTotal.QueueEvent  (event queuing from guard.lua)
--   FiveMTotal.GetPolicy   (cached policy from api.lua)

FiveMTotal = FiveMTotal or {}

-- ---------------------------------------------------------------------------
-- Internal state
-- ---------------------------------------------------------------------------

local _localBlocklist = {}   -- sha256 (string) -> true
local _lastSyncTime   = "1970-01-01T00:00:00Z"
local _quarantineLog  = {}   -- array of { resource, file, dest, time }

-- Quarantine directory relative to the guard resource
local QUARANTINE_DIR = "quarantine/"

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

local function DebugLog(msg)
  if Config.Debug then
    print("[FiveMTotal] " .. msg)
  end
end

-- ---------------------------------------------------------------------------
-- Blocklist management
-- ---------------------------------------------------------------------------

--- Populate local blocklist from the policy's hash_blacklist field.
function FiveMTotal.UpdateLocalBlocklist()
  local policy = FiveMTotal.GetPolicy()
  if not policy or not policy.hash_blacklist then return end

  local added = 0
  for _, hash in ipairs(policy.hash_blacklist) do
    if not _localBlocklist[hash] then
      _localBlocklist[hash] = true
      added = added + 1
    end
  end
  DebugLog("Local blocklist updated from policy: " .. added .. " new entries")
end

--- Fetch incremental blocklist delta from the API.
--- GET /api/guard/blocklist/delta?since=<ISO8601>
function FiveMTotal.SyncBlocklistDelta()
  local url     = FiveMTotal.ApiUrl("/api/guard/blocklist/delta?since=" .. _lastSyncTime)
  local headers = FiveMTotal.AuthHeaders()

  DebugLog("Fetching blocklist delta since " .. _lastSyncTime)

  FiveMTotal._rawHttp(url, function(statusCode, responseBody)
    if statusCode >= 200 and statusCode < 300 and responseBody then
      local ok, decoded = pcall(json.decode, responseBody)
      if ok and type(decoded) == "table" and decoded.added then
        local count = 0
        for _, entry in ipairs(decoded.added) do
          if entry.sha256 and not _localBlocklist[entry.sha256] then
            _localBlocklist[entry.sha256] = true
            count = count + 1
          end
        end
        _lastSyncTime = os.date("!%Y-%m-%dT%H:%M:%SZ")
        DebugLog("Blocklist delta synced: " .. count .. " new entries (total: " .. FiveMTotal.GetBlocklistSize() .. ")")
      else
        print("[FiveMTotal] [WARN] Failed to parse blocklist delta JSON")
      end
    else
      print("[FiveMTotal] [WARN] Blocklist delta fetch failed (HTTP " .. tostring(statusCode) .. ")")
    end
  end, "GET", "", headers)
end

--- Check whether a SHA-256 hash is in the local blocklist.
---@param sha256 string
---@return boolean
function FiveMTotal.IsBlocked(sha256)
  return _localBlocklist[sha256] == true
end

--- Return the number of entries in the local blocklist.
---@return number
function FiveMTotal.GetBlocklistSize()
  local count = 0
  for _ in pairs(_localBlocklist) do
    count = count + 1
  end
  return count
end

-- ---------------------------------------------------------------------------
-- File reporting
-- ---------------------------------------------------------------------------

--- Report a suspicious file to the API.
--- POST /api/guard/report { hash, fileName, resourceName, content? }
---@param resourceName string
---@param fileName     string
---@param content      string|nil  file content (plain text for Lua files)
function FiveMTotal.ReportFile(resourceName, fileName, content)
  local url     = FiveMTotal.ApiUrl("/api/guard/report")
  local headers = FiveMTotal.AuthHeaders()
  local payload = {
    fileName     = fileName,
    resourceName = resourceName,
  }
  if content then
    payload.content = content
  end

  local body = json.encode(payload)

  FiveMTotal._rawHttp(url, function(statusCode, responseBody)
    if statusCode >= 200 and statusCode < 300 then
      DebugLog("File reported: " .. resourceName .. "/" .. fileName)
    else
      print("[FiveMTotal] [WARN] File report failed for " .. resourceName .. "/" .. fileName .. " (HTTP " .. tostring(statusCode) .. ")")
    end
  end, "POST", body, headers)
end

-- ---------------------------------------------------------------------------
-- Quarantine
-- ---------------------------------------------------------------------------

--- Quarantine a file by copying it into the guard resource's quarantine/
--- directory and reporting it to the API.
---@param resourceName string  source resource
---@param filePath     string  relative path within the source resource
---@return boolean success
function FiveMTotal.QuarantineFile(resourceName, filePath)
  if not Config.QuarantineEnabled then
    DebugLog("Quarantine disabled, skipping: " .. resourceName .. "/" .. filePath)
    return false
  end

  local content = LoadResourceFile(resourceName, filePath)
  if not content then
    print("[FiveMTotal] [WARN] Cannot read file for quarantine: " .. resourceName .. "/" .. filePath)
    return false
  end

  -- Build a filesystem-safe destination name
  local safeName = (resourceName .. "_" .. filePath):gsub("[/\\:*?\"<>|]", "_")
  local destPath = QUARANTINE_DIR .. safeName .. "." .. os.time()
  local guardResource = GetCurrentResourceName()

  FiveMTotal._rawSaveResourceFile(guardResource, destPath, content, -1)
  print("[FiveMTotal] Quarantined: " .. resourceName .. "/" .. filePath .. " -> " .. destPath)

  -- Track in the quarantine log
  _quarantineLog[#_quarantineLog + 1] = {
    resource = resourceName,
    file     = filePath,
    dest     = destPath,
    time     = os.time(),
  }

  -- Report to API
  FiveMTotal.ReportFile(resourceName, filePath, content)

  -- Queue a critical event
  FiveMTotal.QueueEvent("critical", resourceName, "quarantine", {
    file        = filePath,
    destination = destPath,
  })

  return true
end

--- Return the list of quarantined file records.
---@return table[]
function FiveMTotal.GetQuarantineLog()
  return _quarantineLog
end

-- ---------------------------------------------------------------------------
-- Console commands
-- ---------------------------------------------------------------------------

--- guard-quarantine <list|count>
RegisterCommand("guard-quarantine", function(source, args)
  if source ~= 0 then return end   -- server console only

  local sub = args[1]

  if sub == "list" then
    if #_quarantineLog == 0 then
      print("[FiveMTotal] No files have been quarantined yet.")
    else
      print("[FiveMTotal] Quarantined files (" .. #_quarantineLog .. "):")
      for i, entry in ipairs(_quarantineLog) do
        print(("  %d. %s/%s -> %s (at %s)"):format(
          i,
          entry.resource,
          entry.file,
          entry.dest,
          os.date("!%Y-%m-%dT%H:%M:%SZ", entry.time)
        ))
      end
    end

  elseif sub == "count" then
    print("[FiveMTotal] Quarantined files: " .. #_quarantineLog)
    print("[FiveMTotal] Local blocklist size: " .. FiveMTotal.GetBlocklistSize())

  else
    print("[FiveMTotal] Usage: guard-quarantine <list|count>")
  end
end, true)

--- guard-sync  -- force an immediate blocklist delta sync
RegisterCommand("guard-sync", function(source)
  if source ~= 0 then return end   -- server console only
  print("[FiveMTotal] Forcing blocklist delta sync...")
  FiveMTotal.SyncBlocklistDelta()
end, true)

-- ---------------------------------------------------------------------------
-- Periodic threads
-- ---------------------------------------------------------------------------

--- Initial bootstrap + periodic delta sync
Citizen.CreateThread(function()
  -- Wait for the initial policy fetch (guard.lua fires it immediately)
  Citizen.Wait(10000)   -- 10-second grace period

  -- Seed the local blocklist from the policy's hash_blacklist
  FiveMTotal.UpdateLocalBlocklist()

  -- First full delta sync (since=1970 fetches everything)
  FiveMTotal.SyncBlocklistDelta()

  -- Periodic delta sync loop
  local interval = (Config.DeltaSyncInterval or 300) * 1000
  while true do
    Citizen.Wait(interval)
    FiveMTotal.SyncBlocklistDelta()
  end
end)

-- ---------------------------------------------------------------------------
-- Startup
-- ---------------------------------------------------------------------------

print("[FiveMTotal] Scanner module loaded - blocklist sync & quarantine ready")
