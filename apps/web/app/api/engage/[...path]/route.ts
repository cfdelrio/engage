import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const ENGAGE_API_URL =
  process.env["INTERNAL_API_URL"] ?? "http://localhost:3001";

async function handler(
  request: NextRequest,
  ctx: RouteContext<"/api/engage/[...path]">,
) {
  const cookieStore = await cookies();
  const apiKey = cookieStore.get("engage_session")?.value;
  if (!apiKey) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { path } = await ctx.params;
  const upstreamUrl = `${ENGAGE_API_URL}/${path.join("/")}${request.nextUrl.search}`;

  const HOP_BY_HOP = new Set([
    "connection",
    "keep-alive",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "proxy-authenticate",
    "proxy-authorization",
  ]);

  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (key !== "host" && key !== "cookie" && !HOP_BY_HOP.has(key))
      headers.set(key, value);
  });
  headers.set("x-api-key", apiKey);

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();

  const upstream = await fetch(upstreamUrl, {
    method: request.method,
    headers,
    body,
  });

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (key !== "transfer-encoding") responseHeaders.set(key, value);
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
export const PATCH = handler;
