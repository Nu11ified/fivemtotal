import { createAuthClient } from "better-auth/react";

export const authClient: ReturnType<typeof createAuthClient> = createAuthClient({
  baseURL: "http://localhost:3001",
});

export const {
  useSession,
  signIn,
  signUp,
  signOut,
} = authClient;
