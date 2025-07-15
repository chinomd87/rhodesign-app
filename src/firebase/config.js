// cSpell:ignore firestore firebaseapp firebasestorage BXSEN BCPJ Artj Uzaj
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { getAnalytics } from "firebase/analytics";

// Your Firebase configuration
const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyChhE9RoI99XArtjUzajLJ107U8vZ3WVEc",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    "signet-e-signature.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "signet-e-signature",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "signet-e-signature.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "638581875808",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:638581875808:web:49be64589c54ebcae7cf05",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-BCPJ3BXSEN",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
export const functions = getFunctions(app);

// Initialize Analytics (only in production and in browser)
const analytics =
  typeof window !== "undefined" && import.meta.env.PROD
    ? getAnalytics(app)
    : null;

export { analytics };

export default app;
