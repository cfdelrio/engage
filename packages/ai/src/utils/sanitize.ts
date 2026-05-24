const INJECTION_PATTERNS = [
  /ignore previous instructions/i,
  /you are now/i,
  /system:\s/i,
  /<\/s>/,
  /\[INST\]/,
  /###\s*human/i,
  /###\s*assistant/i,
];

export function assertNoInjection(input: string): void {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      const err = new Error(
        "Input rejected: contains disallowed pattern",
      ) as Error & { code: string };
      err.code = "INJECTION_DETECTED";
      throw err;
    }
  }
}
