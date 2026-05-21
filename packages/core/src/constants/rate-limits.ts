export interface RateLimitRule {
  limit: number;
  windowSeconds: number;
  priority: "critical" | "high" | "medium" | "low";
}

export interface RateLimitConfig {
  [endpoint: string]: RateLimitRule;
}

const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  "POST /v1/events": {
    limit: 1000,
    windowSeconds: 60,
    priority: "critical",
  },
  "GET /v1/events": {
    limit: 500,
    windowSeconds: 60,
    priority: "high",
  },
  "POST /v1/campaigns": {
    limit: 50,
    windowSeconds: 60,
    priority: "high",
  },
  "GET /v1/campaigns": {
    limit: 200,
    windowSeconds: 60,
    priority: "medium",
  },
  "PUT /v1/campaigns": {
    limit: 100,
    windowSeconds: 60,
    priority: "medium",
  },
  "POST /v1/users": {
    limit: 100,
    windowSeconds: 60,
    priority: "high",
  },
  "GET /v1/users": {
    limit: 300,
    windowSeconds: 60,
    priority: "medium",
  },
  "POST /admin": {
    limit: 100,
    windowSeconds: 60,
    priority: "high",
  },
  "GET /admin": {
    limit: 200,
    windowSeconds: 60,
    priority: "medium",
  },
  DEFAULT: {
    limit: 300,
    windowSeconds: 60,
    priority: "low",
  },
};

export function getRateLimitRule(method: string, path: string): RateLimitRule {
  const key = `${method} ${path}`;

  // Try exact match
  if (DEFAULT_RATE_LIMITS[key]) {
    return DEFAULT_RATE_LIMITS[key];
  }

  // Try prefix match (e.g., POST /v1/events matches POST /v1/events/:id)
  const pathParts = path.split("/").slice(0, 3).join("/"); // /v1/events
  const prefixKey = `${method} ${pathParts}`;
  if (DEFAULT_RATE_LIMITS[prefixKey]) {
    return DEFAULT_RATE_LIMITS[prefixKey];
  }

  // Try method prefix match
  const methodPrefixParts = method.split(" ");
  const methodPrefix = methodPrefixParts[0] || "";
  for (const [confKey, rule] of Object.entries(DEFAULT_RATE_LIMITS)) {
    const confKeyParts = confKey.split(" ");
    const confMethod = confKeyParts[0] || "";
    const confPath = confKeyParts[1] || "";
    if (confMethod.startsWith(methodPrefix) && path.startsWith(confPath)) {
      return rule;
    }
  }

  const defaultRule = DEFAULT_RATE_LIMITS["DEFAULT"];
  if (!defaultRule) throw new Error("DEFAULT rate limit rule not configured");
  return defaultRule;
}

export const RATE_LIMITS = DEFAULT_RATE_LIMITS;
