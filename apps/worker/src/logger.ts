const isProd = process.env["NODE_ENV"] === "production";

function log(
  level: "info" | "warn" | "error",
  msg: string,
  ctx?: Record<string, unknown>,
) {
  if (isProd) {
    process.stdout.write(
      JSON.stringify({ time: new Date().toISOString(), level, msg, ...ctx }) +
        "\n",
    );
  } else {
    const prefix = level === "error" ? "✗" : level === "warn" ? "⚠" : "•";
    const ctxStr = ctx ? ` ${JSON.stringify(ctx)}` : "";

    console.log(`[${level.toUpperCase()}] ${prefix} ${msg}${ctxStr}`);
  }
}

export const logger = {
  info: (msg: string, ctx?: Record<string, unknown>) => log("info", msg, ctx),
  warn: (msg: string, ctx?: Record<string, unknown>) => log("warn", msg, ctx),
  error: (msg: string, ctx?: Record<string, unknown>) => log("error", msg, ctx),
};
