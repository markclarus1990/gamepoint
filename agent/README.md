# Gamepoint PC Agent

Locks/unlocks a cafe PC based on the player's active session in GAMEPOINT.

## Build (once, on the admin/server machine)

Requires .NET 8 SDK.

```powershell
.\build-agent.ps1
# or with explicit version:
.\build-agent.ps1 -Version 1.0.1
```

Output: `dist\GamepointAgent.exe` (self-contained, single file — no install needed on cafe PCs) + `dist\VERSION`.

## Install on a cafe PC (first time only)

1. Copy `GamepointAgent.exe` and `config.json` from `dist\` to the PC (e.g. `C:\GamepointAgent\`).
2. Edit `config.json`:
   - `serverUrl` — your GAMEPOINT app URL (e.g. `https://gamepoint.example.com`)
   - `agentKey` — the station's agent key (Admin Dashboard → Stations → "Key" button)
   - `stationName` — must match the station name created in the admin dashboard (e.g. `PC-1`)
   - `githubRepo` — (optional) GitHub repo for direct update fallback, default `markclarus1990/gamepoint`
   - `githubToken` — (only if repo is private) a fine-grained PAT with `contents:read`
   - `updateCheckMinutes` — how often to check for updates (default 60)
3. Run `install-agent.ps1` (from this folder, with `dist\` populated) to copy the files to `%LOCALAPPDATA%\GamepointAgent` and add a startup shortcut, OR just run `GamepointAgent.exe` once — it auto-starts at every login after step 1 if you put a shortcut in the Startup folder.

## Auto-Update (no more manual copy)

### How it works

1. **Push to GitHub** — every push to `main` that touches `agent/**` triggers `.github/workflows/build-agent.yml`:
   - Builds `GamepointAgent.exe` on Windows with `dotnet publish`
   - Creates a GitHub Release `agent-v1.0.<run_number>` with `GamepointAgent.exe` + `VERSION`
   - You can also trigger manually: `git tag agent-v1.0.1 && git push origin agent-v1.0.1`

2. **Server proxies the version** — `GET {serverUrl}/api/agent/version?current=1.0.3` proxies GitHub Releases (uses `GITHUB_TOKEN` env if the repo is private, otherwise public). No DB migration needed.

3. **Agent self-updates** — the PC agent checks every `updateCheckMinutes` (default 60m) + 15s after startup:
   - Calls `GET {serverUrl}/api/agent/version?current=<itsVersion>` (falls back to direct GitHub if server has no release)
   - If newer version available, shows an **"Update to vX.Y.Z"** banner/button on both screens:
     - Lock screen (fullscreen) — bottom-left `v1.0.3` label + `Check for Update` + `Update to vX.Y.Z`
     - Countdown widget (corner) — `vX.Y.Z available` + `Update Now` / `Check`
   - Clicking **Update** downloads the new exe to `%TEMP%\GamepointAgentUpdate\`, writes a batch helper, and restarts via the new exe. `config.json` is preserved. No manual copy needed.
   - Admin can also push a remote update via `POST /api/stations/command` with `command: "update"` (add a button in your admin Stations page to send this to all PCs at once).

### Manual update trigger (on the PC)

- Click the version label (`v1.0.x`) or **Check for Update** — polls the server immediately and shows `up to date` or the banner.
- Or via admin dashboard: send the `update` command — each agent will check and auto-install.

### Environment for the server (Vercel / .env)

```env
GITHUB_REPO=markclarus1990/gamepoint
GITHUB_TOKEN=ghp_xxx   # only if repo is private; for public repos leave empty
# Optional overrides if you don't use GitHub Releases:
AGENT_VERSION=1.0.42
AGENT_DOWNLOAD_URL=https://example.com/GamepointAgent.exe
```

## How it works (runtime)

- Polls `GET {serverUrl}/api/agent/status` every 10s with the `x-agent-key` header.
- **Locked** (no active session): shows a fullscreen black overlay — "PC LOCKED — go to the counter".
- **Unlocked** (active session): hides the overlay, shows a small countdown widget in the corner.
- Exposes `http://localhost:3987/station` on the PC so the GAMEPOINT web page auto-detects which PC the player is on.
- If the server is unreachable, it keeps the previous lock state (doesn't unlock or lock unexpectedly).
- Update check is independent — doesn't affect locking.

## Notes / limitations

- The agent must be running while the PC is logged into Windows. Install it as a startup shortcut on every cafe PC.
- `Ctrl+Alt+Del` can't be intercepted by normal apps (Windows security). This is a limitation of any timer-style agent without a custom shell.
- To quit the agent: Task Manager → GamepointAgent → End task.
- The web page must be able to reach `http://localhost:3987` — browsers allow this from HTTPS pages for localhost.
- The updater can't overwrite a running exe directly — it downloads to `%TEMP%\GamepointAgentUpdate\`, launches a batch file that waits for the PID to exit, copies, and restarts. This is normal on Windows.
