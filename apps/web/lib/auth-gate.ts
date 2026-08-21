import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export function clerkConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY,
  );
}

export function localE2eAuthBypass() {
  return process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_E2E_AUTH_BYPASS === "1";
}

export async function requireSignedIn() {
  if (localE2eAuthBypass()) return true;
  if (!clerkConfigured()) return false;
  const { isAuthenticated } = await auth();
  if (!isAuthenticated) redirect("/sign-in");
  return true;
}
