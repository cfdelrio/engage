import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const ENGAGE_API_URL =
  process.env["INTERNAL_API_URL"] ?? "http://localhost:3001";

export async function GET() {
  const cookieStore = await cookies();
  const key = cookieStore.get("engage_session")?.value;
  if (!key) return Response.json({ authenticated: false });
  return Response.json({ authenticated: true, prefix: key.slice(0, 12) });
}

export async function POST(request: NextRequest) {
  const { apiKey } = (await request.json()) as { apiKey: string };
  if (!apiKey?.trim()) {
    return Response.json({ error: "API key is required" }, { status: 400 });
  }

  const validation = await fetch(`${ENGAGE_API_URL}/health`, {
    headers: { "x-api-key": apiKey.trim() },
  }).catch(() => null);

  if (!validation?.ok) {
    return Response.json({ error: "Invalid API key" }, { status: 401 });
  }

  const cookieStore = await cookies();
  cookieStore.set("engage_session", apiKey.trim(), {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });

  return Response.json({ success: true, prefix: apiKey.trim().slice(0, 12) });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("engage_session");
  return Response.json({ success: true });
}
