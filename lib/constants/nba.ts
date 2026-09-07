// Single source of truth for NBA 30 teams + conferences/divisions
// Keep "OKC Thunder" alias for compatibility (code historically used "OKC Thunder" not "Oklahoma City Thunder")

export const NBA_TEAMS = [
  "Atlanta Hawks",
  "Boston Celtics",
  "Brooklyn Nets",
  "Charlotte Hornets",
  "Chicago Bulls",
  "Cleveland Cavaliers",
  "Dallas Mavericks",
  "Denver Nuggets",
  "Detroit Pistons",
  "Golden State Warriors",
  "Houston Rockets",
  "Indiana Pacers",
  "LA Clippers",
  "LA Lakers",
  "Memphis Grizzlies",
  "Miami Heat",
  "Milwaukee Bucks",
  "Minnesota Timberwolves",
  "New Orleans Pelicans",
  "New York Knicks",
  "OKC Thunder",
  "Orlando Magic",
  "Philadelphia 76ers",
  "Phoenix Suns",
  "Portland Trail Blazers",
  "Sacramento Kings",
  "San Antonio Spurs",
  "Toronto Raptors",
  "Utah Jazz",
  "Washington Wizards",
] as const;

export type NbaTeam = (typeof NBA_TEAMS)[number];
export type Conference = "East" | "West";
export type Division =
  | "Atlantic"
  | "Central"
  | "Southeast"
  | "Northwest"
  | "Pacific"
  | "Southwest";

export const TEAM_CONFERENCES: Record<string, { conference: Conference; division: Division }> = {
  // East - Atlantic
  "Boston Celtics": { conference: "East", division: "Atlantic" },
  "Brooklyn Nets": { conference: "East", division: "Atlantic" },
  "New York Knicks": { conference: "East", division: "Atlantic" },
  "Philadelphia 76ers": { conference: "East", division: "Atlantic" },
  "Toronto Raptors": { conference: "East", division: "Atlantic" },

  // East - Central
  "Chicago Bulls": { conference: "East", division: "Central" },
  "Cleveland Cavaliers": { conference: "East", division: "Central" },
  "Detroit Pistons": { conference: "East", division: "Central" },
  "Indiana Pacers": { conference: "East", division: "Central" },
  "Milwaukee Bucks": { conference: "East", division: "Central" },

  // East - Southeast
  "Atlanta Hawks": { conference: "East", division: "Southeast" },
  "Charlotte Hornets": { conference: "East", division: "Southeast" },
  "Miami Heat": { conference: "East", division: "Southeast" },
  "Orlando Magic": { conference: "East", division: "Southeast" },
  "Washington Wizards": { conference: "East", division: "Southeast" },

  // West - Northwest
  "Denver Nuggets": { conference: "West", division: "Northwest" },
  "Minnesota Timberwolves": { conference: "West", division: "Northwest" },
  "OKC Thunder": { conference: "West", division: "Northwest" },
  "Oklahoma City Thunder": { conference: "West", division: "Northwest" },
  "Portland Trail Blazers": { conference: "West", division: "Northwest" },
  "Utah Jazz": { conference: "West", division: "Northwest" },

  // West - Pacific
  "Golden State Warriors": { conference: "West", division: "Pacific" },
  "LA Clippers": { conference: "West", division: "Pacific" },
  "LA Lakers": { conference: "West", division: "Pacific" },
  "Phoenix Suns": { conference: "West", division: "Pacific" },
  "Sacramento Kings": { conference: "West", division: "Pacific" },

  // West - Southwest
  "Dallas Mavericks": { conference: "West", division: "Southwest" },
  "Houston Rockets": { conference: "West", division: "Southwest" },
  "Memphis Grizzlies": { conference: "West", division: "Southwest" },
  "New Orleans Pelicans": { conference: "West", division: "Southwest" },
  "San Antonio Spurs": { conference: "West", division: "Southwest" },
};

export function getTeamInfo(team: string): { conference: Conference; division: Division } | null {
  return TEAM_CONFERENCES[team] ?? null;
}

export const MAX_NBA_PLAYERS = 16;
export const EAST_SLOTS = 8;
export const WEST_SLOTS = 8;

// Lightweight CDN logos — gist jerhinesmith/download.rb pattern, Turner is dead (404) → use ESPN CDN
// ESPN: https://a.espncdn.com/i/teamlogos/nba/500/{abbr}.png — 500x500 PNG, CORS *
export const TEAM_ABBR: Record<string, string> = {
  "Atlanta Hawks": "atl",
  "Boston Celtics": "bos",
  "Brooklyn Nets": "bkn",
  "Charlotte Hornets": "cha",
  "Chicago Bulls": "chi",
  "Cleveland Cavaliers": "cle",
  "Dallas Mavericks": "dal",
  "Denver Nuggets": "den",
  "Detroit Pistons": "det",
  "Golden State Warriors": "gsw",
  "Houston Rockets": "hou",
  "Indiana Pacers": "ind",
  "LA Clippers": "lac",
  "LA Lakers": "lal",
  "Memphis Grizzlies": "mem",
  "Miami Heat": "mia",
  "Milwaukee Bucks": "mil",
  "Minnesota Timberwolves": "min",
  "New Orleans Pelicans": "nop",
  "New York Knicks": "nyk",
  "OKC Thunder": "okc",
  "Oklahoma City Thunder": "okc",
  "Orlando Magic": "orl",
  "Philadelphia 76ers": "phi",
  "Phoenix Suns": "phx",
  "Portland Trail Blazers": "por",
  "Sacramento Kings": "sac",
  "San Antonio Spurs": "sas",
  "Toronto Raptors": "tor",
  "Utah Jazz": "uta",
  "Washington Wizards": "was",
};

// ESPN uses nop->no, uta->utah (others same; gsw/gs, nyk/ny, sas/sa, was/wsh all 200 on ESPN)
const ESPN_ABBR_FIX: Record<string, string> = { nop: "no", uta: "utah" };

export const getTeamLogo = (team: string): string => {
  const ab = TEAM_ABBR[team];
  if (!ab) return "/window.svg";
  const espnAb = ESPN_ABBR_FIX[ab] ?? ab;
  return `https://a.espncdn.com/i/teamlogos/nba/500/${espnAb}.png`;
};
