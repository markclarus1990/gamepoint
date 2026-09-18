/**
 * GET /api/agent/version
 * Returns the latest GamepointAgent release info.
 *
 * Query:  ?current=1.0.42  (optional — current agent version for comparison)
 * Headers: x-agent-key      (optional — if present, validates the caller)
 *
 * Response: { version, tag, downloadUrl, publishedAt, updateAvailable }
 *
 * Data source priority:
 *  1. GitHub Releases API for markclarus1990/gamepoint (requires GITHUB_TOKEN for private repos)
 *  2. Falls back to env AGENT_VERSION / AGENT_DOWNLOAD_URL if GitHub is unreachable
 */

const GITHUB_REPO = process.env.GITHUB_REPO || "markclarus1990/gamepoint";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";

function parseVersion(v: string): number[] {
  return v
    .replace(/^v/, "")
    .replace(/^agent-v/, "")
    .split(".")
    .map((n) => parseInt(n, 10) || 0);
}

function isNewer(latest: string, current: string): boolean {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}

interface GhRelease {
  tag_name: string;
  name: string;
  published_at: string;
  assets: { name: string; browser_download_url: string; size: number }[];
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const current = url.searchParams.get("current") || url.searchParams.get("v") || "";

  // Allow unauthenticated polling — agents check frequently.
  // If you want to restrict, uncomment:
  // const agentKey = req.headers.get("x-agent-key");
  // if (!agentKey) return Response.json({ error: "Missing agent key" }, { status: 401 });

  let version = process.env.AGENT_VERSION || "";
  let tag = version ? `agent-v${version}` : "";
  let downloadUrl = process.env.AGENT_DOWNLOAD_URL || "";
  let publishedAt: string | null = null;
  let releaseNotes: string | null = null;

  // Try GitHub Releases first (works for public repos without token; private needs token)
  try {
    const headers: Record<string, string> = {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "GamepointAgent-VersionCheck",
    };
    if (GITHUB_TOKEN) headers.Authorization = `Bearer ${GITHUB_TOKEN}`;

    // Prefer the latest release that has GamepointAgent.exe
    const ghRes = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=10`,
      { headers, next: { revalidate: 60 } } as RequestInit
    );

    if (ghRes.ok) {
      const releases: GhRelease[] = await ghRes.json();
      // Find first release with the exe asset — tags are agent-v*
      const rel =
        releases.find((r) => r.assets.some((a) => a.name === "GamepointAgent.exe")) ||
        releases[0] ||
        null;

      if (rel) {
        tag = rel.tag_name;
        // Strip agent-v prefix for pure version
        version = rel.tag_name.replace(/^agent-v/, "").replace(/^v/, "");
        publishedAt = rel.published_at;
        const exe = rel.assets.find((a) => a.name === "GamepointAgent.exe");
        if (exe) downloadUrl = exe.browser_download_url;
        // Keep tag for display even if asset missing
      }
    } else {
      // Fallback: try /releases/latest if list fails (e.g. private repo 404 without token)
      console.warn(`[agent/version] GitHub releases list ${ghRes.status}: ${await ghRes.text()}`);
    }
  } catch (e) {
    console.warn("[agent/version] GitHub fetch failed:", e);
  }

  // Final fallback if GitHub gave nothing
  if (!version) {
    version = "0.0.0";
    tag = "";
  }

  const updateAvailable = current ? isNewer(version, current) : false;

  return Response.json(
    {
      version,
      tag,
      downloadUrl: downloadUrl || null,
      publishedAt,
      releaseNotes,
      updateAvailable,
      current: current || null,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60",
      },
    }
  );
}
