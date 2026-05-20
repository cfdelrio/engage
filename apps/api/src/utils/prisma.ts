import type { Prisma } from '@engage/database';

export function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

export function asJsonNullable(value: unknown): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
