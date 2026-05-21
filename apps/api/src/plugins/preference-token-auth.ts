import type { FastifyReply, FastifyRequest, FastifyInstance } from "fastify";
import { createHash } from "crypto";

const hashToken = (token: string): string => {
  return createHash("sha256").update(token).digest("hex");
};

export interface PreferenceTokenPayload {
  userId: string;
  tenantId: string;
}

declare module "fastify" {
  interface FastifyRequest {
    preferenceToken?: PreferenceTokenPayload;
  }
}

export async function authenticatePreferenceToken(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const query = request.query as Record<string, string | undefined>;
  const token = request.headers["x-preference-token"] || query.token;

  if (!token || typeof token !== "string") {
    return reply.status(401).send({
      error: "Unauthorized",
      message: "Missing preference token",
    });
  }

  try {
    // Hash the token
    const tokenHash = hashToken(token);

    // Fetch from database
    const app = request.server as FastifyInstance;
    type PreferenceTokenRecord = {
      userId: string;
      tenantId: string;
      revokedAt: Date | null;
      expiresAt: Date | null;
    };
    type PrismaWithPreferenceToken = {
      preferenceToken: {
        findUnique(args: {
          where: { tokenHash: string };
          include: { user: boolean };
        }): Promise<PreferenceTokenRecord | null>;
      };
    };
    const prismaExt = app.prisma as unknown as PrismaWithPreferenceToken;
    const preferenceToken = await prismaExt.preferenceToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!preferenceToken) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Invalid preference token",
      });
    }

    // Check if token is revoked
    if (preferenceToken.revokedAt) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Preference token has been revoked",
      });
    }

    // Check if token is expired
    if (preferenceToken.expiresAt && new Date() > preferenceToken.expiresAt) {
      return reply.status(401).send({
        error: "Unauthorized",
        message: "Preference token has expired",
      });
    }

    // Attach to request
    request.preferenceToken = {
      userId: preferenceToken.userId,
      tenantId: preferenceToken.tenantId,
    };
  } catch {
    return reply.status(500).send({
      error: "Internal Server Error",
      message: "Failed to authenticate preference token",
    });
  }
}

export function generatePreferenceToken(length: number = 32): string {
  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let token = "pref_";
  for (let i = 0; i < length; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

export function getTokenPrefix(token: string): string {
  return token.substring(0, 10);
}
