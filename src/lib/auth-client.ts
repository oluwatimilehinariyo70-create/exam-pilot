"use client";

import { createAuthClient } from "better-auth/react";

// NEXT_PUBLIC_BETTER_AUTH_URL is optional and isn't documented in .env.example — only the
// server-side BETTER_AUTH_URL is. Without it, this used to hardcode "http://localhost:3000",
// so every auth request cross-origin-failed the moment the dev server ran on any other port
// (e.g. Next.js falling back to 3001 because 3000 was already in use). Falling back to the
// browser's own origin instead means auth keeps working no matter which port the app is on.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"),
});
