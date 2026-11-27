/**
 * Конфигурация на Firebase за PIG e-ADMIN.
 *
 * Стойностите са публични по природа (те са в клиентския bundle при всяко
 * Firebase приложение) — защитата идва от правилата на Realtime Database,
 * не от скриването на ключа. Затова могат да стоят и като fallback в кода,
 * а при нужда се заместват с променливи на средата (NEXT_PUBLIC_FIREBASE_*).
 */

export const firebaseConfig = {
  apiKey:
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyADmMp1_MBK-3seLmpnpD3yhlDOxWT6k_g",
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "e-admin-ad0bb.firebaseapp.com",
  databaseURL:
    process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ||
    "https://e-admin-ad0bb-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "e-admin-ad0bb",
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "e-admin-ad0bb.firebasestorage.app",
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "620738933677",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:620738933677:web:6b88fce8ad54944ab56724",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-R55B852ZQC",
} as const;

/** URL на Realtime Database без завършваща наклонена черта. */
export function firebaseDatabaseUrl(): string {
  return (firebaseConfig.databaseURL || "").replace(/\/+$/, "");
}
