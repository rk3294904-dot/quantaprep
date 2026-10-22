export interface StudyActivity {
  lectureMinutesWatched: number;
  pdfsOpened: number;
  studyDays: string[];
  hasMinutes: boolean;
  hasPdfs: boolean;
  hasStudyDays: boolean;
}

function count(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

// Read-only compatibility with existing aggregate records. Points and playback
// positions are deliberately not interpreted as time spent watching.
export function readStudyActivity(data: Record<string, unknown>): StudyActivity {
  const minutes = count(data.lectureMinutesWatched) ?? count(data.minutesWatched)
    ?? (count(data.watchedSeconds) !== undefined ? count(data.watchedSeconds)! / 60 : undefined);
  const pdfs = count(data.pdfsOpened) ?? count(data.pdfOpened) ?? count(data.pdfOpens);
  const studyDays = Array.isArray(data.studyDays) ? [...new Set(data.studyDays.filter((day): day is string =>
    typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day)
    && !Number.isNaN(Date.parse(day)) && new Date(day).toISOString().slice(0, 10) === day
  ))].sort() : [];
  return {
    lectureMinutesWatched: minutes ?? 0,
    pdfsOpened: Math.floor(pdfs ?? 0),
    studyDays,
    hasMinutes: minutes !== undefined,
    hasPdfs: pdfs !== undefined,
    hasStudyDays: Array.isArray(data.studyDays),
  };
}

export function currentStudyStreak(days: string[], now = new Date()): number {
  const recorded = new Set(days);
  const cursor = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (!recorded.has(cursor.toISOString().slice(0, 10))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  let streak = 0;
  while (recorded.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

export function compareStudyActivity(a: StudyActivity & { id: string }, b: StudyActivity & { id: string }) {
  return b.lectureMinutesWatched - a.lectureMinutesWatched || b.pdfsOpened - a.pdfsOpened || a.id.localeCompare(b.id);
}

// Keep one consistent ranking basis for the entire board during transition.
export function selectLeaderboard<T extends StudyActivity & { id: string; points: number }>(entries: T[]) {
  const activityEntries = entries.filter((entry) => entry.lectureMinutesWatched > 0 || entry.pdfsOpened > 0);
  const legacy = activityEntries.length === 0;
  const ranked = [...entries];
  ranked.sort(legacy ? (a, b) => b.points - a.points || a.id.localeCompare(b.id) : compareStudyActivity);
  return ranked.map((entry, index) => ({ ...entry, rank: index + 1, legacy }));
}
