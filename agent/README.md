# Gamepoint PC Agent

Locks/unlocks a cafe PC based on the player's active session in GAMEPOINT.

## Build (once, on the admin/server machine)

Requires .NET 8 SDK.

```powershell
.\build-agent.ps1
```

Output: `dist\GamepointAgent.exe` (self-contained, single file — no install needed on cafe PCs).

## Install on a cafe PC

1. Copy `GamepointAgent.exe` and `config.json` from `dist\` to the PC (e.g. `C:\GamepointAgent\`).
2. Edit `config.json`:
   - `serverUrl` — your GAMEPOINT app URL (e.g. `https://gamepoint.example.com`)
   - `agentKey` — the station's agent key (Admin Dashboard → Stations → "Key" button)
   - `stationName` — must match the station name created in the admin dashboard (e.g. `PC-1`)
3. Run `install-agent.ps1` (from this folder, with `dist\` populated) to copy the files to `%LOCALAPPDATA%\GamepointAgent` and add a startup shortcut, OR just run `GamepointAgent.exe` once — it auto-starts at every login after step 1 if you put a shortcut in the Startup folder.

## How it works

- Polls `GET {serverUrl}/api/agent/status` every 10s with the `x-agent-key` header.
- **Locked** (no active session): shows a fullscreen black overlay — "PC LOCKED — go to the counter".
- **Unlocked** (active session): hides the overlay, shows a small countdown widget in the corner.
- Exposes `http://localhost:3987/station` on the PC so the GAMEPOINT web page auto-detects which PC the player is on.
- If the server is unreachable, it keeps the previous lock state (doesn't unlock or lock unexpectedly).

## Notes / limitations

- The agent must be running while the PC is logged into Windows. Install it as a startup shortcut on every cafe PC.
- `Ctrl+Alt+Del` can't be intercepted by normal apps (Windows security). This is a limitation of any timer-style agent without a custom shell.
- To quit the agent: Task Manager → GamepointAgent → End task.
- The web page must be able to reach `http://localhost:3987` — browsers allow this from HTTPS pages for localhost.
