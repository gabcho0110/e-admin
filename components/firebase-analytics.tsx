"use client";

import { useEffect } from "react";

import { initFirebaseAnalytics } from "@/lib/firebase/client";

/**
 * Инициализира Firebase Analytics еднократно в браузъра.
 * Не рендира нищо — стои в root layout-а.
 */
export function FirebaseAnalytics() {
  useEffect(() => {
    void initFirebaseAnalytics();
  }, []);
  return null;
}
