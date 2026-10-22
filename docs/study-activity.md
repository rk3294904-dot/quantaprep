# Study activity and Firestore rules

This update reads existing Firestore `leaderboard/{uid}` documents. It does not add activity writes or migrate old points. A Netlify Database registry now records public profiles on sign-in so users without activity also appear. The existing legacy points writer remains compatible and points determine rank until activity aggregates arrive.

Supported aggregate fields:

| Field | Meaning | Read compatibility |
| --- | --- | --- |
| `lectureMinutesWatched` | Nonnegative total actual lecture minutes watched | `minutesWatched`, then `watchedSeconds / 60` |
| `pdfsOpened` | Nonnegative count of PDF opens | `pdfOpened`, then `pdfOpens` |
| `studyDays` | Array of unique lecture study dates, `YYYY-MM-DD`, UTC | No fallback; a last-update timestamp cannot establish a streak |
| `displayName`, `photoURL` | Public learner identity | Existing fields |

Canonical fields take precedence, including explicit zero values. Missing/invalid values count as zero for sorting and appear as unrecorded in the interface. When no records have positive minutes or PDF opens, the previous points leaderboard remains visible with explicit points labels. Once positive activity becomes available, the board switches to minutes/PDF ordering and all registered learners remain visible, including those with no activity. Old points and seek positions cannot reliably establish watched time, PDF usage, or daily study history and are never converted. Existing records containing only points therefore retain the previous points rankings until activity aggregates are available.

Sort order is minutes descending, PDF opens descending, then document ID for deterministic equal totals. All registered users and existing leaderboard entries are merged by Firebase UID and displayed after sorting, with no top-ten limit. No composite index is needed. This compatibility strategy reads the whole collection; a large deployment should replace it with a server-maintained indexed ranking query after all aggregates have been populated.

The activity button subscribes to the signed-in learner’s aggregate while open. The streak counts consecutive recorded UTC days ending today or yesterday. Missing study dates display an unavailable state rather than an invented streak. Search remains directly accessible below the mobile navbar.

## Applying rules

Copy the complete repository `firestore.rules` into Firebase Console → Firestore Database → Rules and publish it, or deploy that file using your existing Firebase CLI project configuration. The rules have not been published by this change.

The supplied rules preserve private owner-only profiles and enrollments, allow public leaderboard reads, and protect all activity ranking fields from client writes. Existing legacy point increments are restricted to the owner and one point per write, but rules cannot prove actual video playback or distinguish an increment transform from an equivalent absolute value. Legacy points are not an anti-cheat mechanism.

Any activity aggregates already supplied by a trusted server remain readable. A trusted Admin SDK process can maintain aggregates while bypassing client rules; no such new process is added here. Do not put private data into public leaderboard documents. New persistent activity tracking is outside this read-only integration and must use the platform’s supported storage when implemented.

## Signed-in users

On sign-in (including a restored session), the app registers the learner through `/api/leaderboard-users`. The server verifies the existing Firebase ID token signature, project issuer, audience, and expiry before upserting a Netlify Database public profile. It accepts no client-supplied UID or scores. Only UID, display name, photo URL, and registration time are stored; emails and tokens are never stored. The public GET response exposes only UID, display name, and photo URL, matching the public leaderboard policy.

The leaderboard merges this registry with existing Firestore scores by UID, retaining existing learners and including zero-activity users. Registration failures do not block access to the website; opening or retrying the leaderboard retries registration, and roster-loading failures show the existing recoverable error state rather than silently omitting users. No private Firestore profile reads or new Firestore rules are required.

Firebase Authentication does not expose a client-side list of all historical accounts. Accounts with no existing leaderboard record join the registry when they next visit signed in; historical accounts were not bulk imported. The included database migration is applied by the platform during deployment.
