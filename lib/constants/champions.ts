// Single source of truth for champion titles.
// NBA Season 1 Champion is derived live from the Finals result
// (tournament_matches nba-r4-final) — see /api/champions.
// One-off past-event titles (no tournament module in code) live here.

export const NBA_SEASON_TITLE = "NBA Season 1 Champion";
export const IT_TAKES_TWO_TITLE = "It Takes Two Champion";

export type ManualChampion = {
  userId: string;
  name: string;
  title: string;
};

// It Takes Two champions (Season 1) — verified user ids.
export const MANUAL_CHAMPIONS: ManualChampion[] = [
  { userId: "6a2a5f05-8a3d-475a-ad61-63c2f63939c7", name: "pen", title: IT_TAKES_TWO_TITLE },
  { userId: "6bd78625-eb76-4a87-860e-bedb46e37d93", name: "luisa", title: IT_TAKES_TWO_TITLE },
];

/** All titles for a user: manual titles + NBA title when they hold the Finals crown. */
export function titlesForUser(userId: string | null | undefined, nbaChampionUserId: string | null): string[] {
  if (!userId) return [];
  const titles: string[] = [];
  for (const c of MANUAL_CHAMPIONS) {
    if (c.userId === userId && !titles.includes(c.title)) titles.push(c.title);
  }
  if (nbaChampionUserId && userId === nbaChampionUserId && !titles.includes(NBA_SEASON_TITLE)) {
    titles.push(NBA_SEASON_TITLE);
  }
  return titles;
}
