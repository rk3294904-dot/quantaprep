import test from 'node:test';
import assert from 'node:assert/strict';
import { readStudyActivity, currentStudyStreak, compareStudyActivity, selectLeaderboard } from '../src/lib/study-activity.ts';

test('legacy points never become watch time or study days', () => {
  const activity = readStudyActivity({ points: 700, updatedAt: new Date() });
  assert.equal(activity.lectureMinutesWatched, 0);
  assert.equal(activity.hasMinutes, false);
  assert.equal(activity.hasStudyDays, false);
});

test('reads aliases and preserves explicit canonical zero', () => {
  assert.equal(readStudyActivity({ watchedSeconds: 150 }).lectureMinutesWatched, 2.5);
  assert.equal(readStudyActivity({ pdfOpens: 4 }).pdfsOpened, 4);
  const activity = readStudyActivity({ lectureMinutesWatched: 0, minutesWatched: 55, pdfsOpened: 0, pdfOpened: 9 });
  assert.equal(activity.lectureMinutesWatched, 0);
  assert.equal(activity.pdfsOpened, 0);
  assert.equal(readStudyActivity({ minutesWatched: Infinity, pdfsOpened: -2 }).hasMinutes, false);
});

test('minutes outrank PDF opens; PDF opens resolve equal minutes', () => {
  const entry = (id, minutes, pdfs) => ({ id, ...readStudyActivity({ minutesWatched: minutes, pdfsOpened: pdfs }) });
  const entries = [entry('c', 4, 99), entry('b', 5, 1), entry('a', 5, 3)];
  assert.deepEqual(entries.sort(compareStudyActivity).map(({ id }) => id), ['a', 'b', 'c']);
  assert.ok(compareStudyActivity(entry('a', 5, 3), entry('b', 5, 3)) < 0);
});

test('streak counts unique valid dates, accepts yesterday, and ignores future days', () => {
  const { studyDays } = readStudyActivity({ studyDays: ['2026-10-20', '2026-10-21', '2026-10-21', '2026-02-30', 'bad', '2026-10-23'] });
  assert.equal(studyDays.length, 3);
  assert.equal(currentStudyStreak(studyDays, new Date('2026-10-22T23:59:00Z')), 2);
  assert.equal(currentStudyStreak(studyDays, new Date('2026-10-24T00:00:00Z')), 1);
  assert.equal(currentStudyStreak(studyDays, new Date('2026-10-25T00:00:00Z')), 0);
  assert.equal(currentStudyStreak([], new Date('2026-10-22T00:00:00Z')), 0);
  assert.equal(currentStudyStreak(['2025-12-31', '2026-01-01'], new Date('2026-01-01T00:00:00Z')), 2);
});

test('keeps previous points until positive activity arrives, without mixing units', () => {
  const entry = (id, points, data = {}) => ({ id, points, ...readStudyActivity(data) });
  const previous = [entry('a', 2), entry('b', 10, { minutesWatched: 0 })];
  assert.deepEqual(selectLeaderboard(previous).map(({ id, legacy }) => [id, legacy]), [['b', true], ['a', true]]);
  const updated = selectLeaderboard([...previous, entry('c', 1, { minutesWatched: 3 })]);
  assert.deepEqual(updated.map(({ id, legacy }) => [id, legacy]), [['c', false], ['a', false], ['b', false]]);
  assert.equal(selectLeaderboard([entry('d', 0, { pdfsOpened: 1 })])[0].legacy, false);
  assert.deepEqual(selectLeaderboard([]), []);
});

test('includes every learner beyond ten and keeps zero-activity learners', () => {
  const entries = Array.from({ length: 24 }, (_, index) => ({
    id: String(index).padStart(2, '0'), points: index, ...readStudyActivity({}),
  }));
  const legacy = selectLeaderboard(entries);
  assert.equal(legacy.length, 24);
  assert.equal(legacy[0].points, 23);
  assert.equal(legacy[23].points, 0);
  entries[0] = { ...entries[0], ...readStudyActivity({ minutesWatched: 5 }) };
  const activity = selectLeaderboard(entries);
  assert.equal(activity.length, 24);
  assert.equal(activity[0].id, '00');
  assert.equal(activity[23].rank, 24);
  assert.ok(activity.every((entry) => !entry.legacy));
});
