Config = {
  Endpoint       = "https://your-api.example.com",
  ApiKey         = "your-api-key-here",
  PollInterval   = 300,    -- seconds between policy refreshes
  BatchInterval  = 30,     -- seconds between event batch posts
  MaxLocalEvents = 500,    -- max events queued locally before dropping oldest
  MaxEventsPerPost = 100,  -- max events per POST request
  Debug              = false,  -- enable debug logging
  QuarantineEnabled  = true,   -- enable file quarantine on detection
  DeltaSyncInterval  = 300,    -- seconds between blocklist delta syncs
}
