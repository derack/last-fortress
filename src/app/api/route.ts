import { NextResponse } from "next/server";

// برای خروجی استاتیک (Capacitor) — پاسخ ثابت در زمان بیلد
export const dynamic = "force-static";

export async function GET() {
  return NextResponse.json({ message: "Hello, world!" });
}