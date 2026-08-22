import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    { online: true },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
