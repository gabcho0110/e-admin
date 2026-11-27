"use client";

import { getAnalytics, isSupported, type Analytics } from "firebase/analytics";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";

import { firebaseConfig } from "@/lib/firebase/config";

/**
 * Клиентска инициализация на Firebase.
 *
 * initializeApp се вика еднократно (Next.js може да монтира компонента
 * няколко пъти при навигация), а Analytics — само в браузър и само ако
 * средата го поддържа (не работи при блокирани бисквитки/Do Not Track).
 */
export function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

let analyticsPromise: Promise<Analytics | null> | null = null;

export function initFirebaseAnalytics(): Promise<Analytics | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!analyticsPromise) {
    analyticsPromise = (async () => {
      try {
        if (!(await isSupported())) return null;
        return getAnalytics(getFirebaseApp());
      } catch {
        return null;
      }
    })();
  }
  return analyticsPromise;
}
