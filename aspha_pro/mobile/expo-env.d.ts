/// <reference types="expo-router/types" />

// Declares EXPO_PUBLIC_* env vars used at runtime.
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_URL?: string;
  }
}
