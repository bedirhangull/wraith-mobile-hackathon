import { useEffect } from "react";
import { useRouter } from "expo-router";

import { useSession } from "./session";

/** Redirects to /welcome if there's no active session — guards screens that must not be reachable via a deep link while signed out. */
export function useRequireSession(): void {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session === null) {
      router.replace("/welcome");
    }
  }, [session, router]);
}
