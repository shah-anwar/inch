import type { ZodType, ZodError } from "zod";

/**
 * Error wrapper that preserves Zod validation issues for API-safe error handling.
 */
export class ValidationError extends Error {
  public readonly issues: ZodError["issues"];

  constructor(error: ZodError) {
    super("Validation failed");
    this.name = "ValidationError";
    this.issues = error.issues;
  }
}

/**
 * Validates unknown input against a Zod schema and returns typed data.
 *
 * @param schema Zod schema that defines the expected payload shape.
 * @param data Unknown input to validate.
 * @returns Parsed and type-safe value when validation succeeds.
 * @throws {ValidationError} Thrown when the payload does not satisfy the schema.
 */
export function validate<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(result.error);
  }
  return result.data;
}
