import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const configured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
const clerkProxy = clerkMiddleware();

export default configured ? clerkProxy : () => NextResponse.next();

export const config = { matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|png|gif|svg|woff2?|ico|mp3)).*)"] };
