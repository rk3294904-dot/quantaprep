import { readStudyActivity, selectLeaderboard } from "./study-activity";
import { getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  increment,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAA6Zm6_9iPp2QxwnQ8v9fKi8GGlhUv-dA",
  authDomain: "quanticalearning.firebaseapp.com",
  projectId: "quanticalearning",
  storageBucket: "quanticalearning.firebasestorage.app",
  messagingSenderId: "585277606664",
  appId: "1:585277606664:web:a651c6249390c68d553abd",
  measurementId: "G-SK7V5YMHPD",
};

const app = getApps()[0] ?? initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);
export const firebaseDb = getFirestore(app);

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export async function signInWithGoogle() {
  try {
    await signInWithPopup(firebaseAuth, googleProvider);
  } catch (reason: unknown) {
    const code = (reason as { code?: string }).code;
    if (code === "auth/popup-blocked" || code === "auth/operation-not-supported-in-this-environment") {
      await signInWithRedirect(firebaseAuth, googleProvider);
      return;
    }
    throw reason;
  }
}

export function finishGoogleRedirect() {
  return getRedirectResult(firebaseAuth);
}

export function signOutUser() {
  return signOut(firebaseAuth);
}

export async function enrollInBatch({
  userId,
  batch,
}: {
  userId: string;
  batch: { id: string; name: string; image?: string; byName?: string };
}) {
  await setDoc(
    doc(firebaseDb, "users", userId, "enrollments", batch.id),
    {
      batchId: batch.id,
      batchName: batch.name,
      batchImage: batch.image ?? "",
      byName: batch.byName ?? "",
      enrolledAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function getEnrolledBatchIds(userId: string): Promise<string[]> {
  const snapshot = await getDocs(collection(firebaseDb, "users", userId, "enrollments"));
  return snapshot.docs.map((item) => item.id);
}

export async function recordLectureProgress({
  userId,
  userName,
  photoURL,
  batchId,
  contentId,
  seconds,
}: {
  userId: string;
  userName: string;
  photoURL?: string | null;
  batchId: string;
  contentId: string;
  seconds: number;
}) {
  await setDoc(
    doc(firebaseDb, "leaderboard", userId),
    {
      userId,
      displayName: userName || "Learner",
      photoURL: photoURL ?? "",
      points: increment(1),
      lastBatchId: batchId,
      lastContentId: contentId,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function registerLeaderboardUser(user = firebaseAuth.currentUser) {
  if (!user) return;
  const response = await fetch("/api/leaderboard-users", {
    method: "POST",
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
  });
  if (!response.ok) throw new Error("Unable to register leaderboard profile");
}

export async function getLeaderboard() {
  // Ensure the current learner is visible even on their very first visit.
  await registerLeaderboardUser();
  const [snapshot, response] = await Promise.all([
    getDocs(collection(firebaseDb, "leaderboard")),
    fetch("/api/leaderboard-users", { cache: "no-store" }),
  ]);
  if (!response.ok) throw new Error("Unable to load leaderboard users");
  const { users } = await response.json() as {
    users: { id: string; displayName: string; photoURL: string }[];
  };
  const entries = new Map(users.map((user) => [user.id, {
    ...user, points: 0, ...readStudyActivity({}),
  }]));
  for (const item of snapshot.docs) {
    const data = item.data();
    const profile = entries.get(item.id);
    entries.set(item.id, {
      id: item.id,
      points: typeof data.points === "number" && Number.isFinite(data.points) ? Math.max(0, data.points) : 0,
      displayName: profile?.displayName ?? (typeof data.displayName === "string" ? data.displayName : "Learner"),
      photoURL: profile?.photoURL ?? (typeof data.photoURL === "string" ? data.photoURL : ""),
      ...readStudyActivity(data),
    });
  }
  return selectLeaderboard([...entries.values()]);
}
