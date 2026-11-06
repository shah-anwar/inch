import { describe, it, expect } from "@jest/globals";
import { z } from "zod";
import { validate, ValidationError } from "../../src/utils/validate.js";

describe("ValidationError", () => {
  it("sets message, name, and preserves Zod issues from the constructor argument", () => {
    const schema = z.object({ name: z.string() });
    const parsed = schema.safeParse({ name: 1 });
    expect(parsed.success).toBe(false);
    const zodError = parsed.error;

    const err = new ValidationError(zodError);

    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(ValidationError);
    expect(err.message).toBe("Validation failed");
    expect(err.name).toBe("ValidationError");
    expect(err.issues).toBe(zodError.issues);
    expect(err.cause).toBeUndefined();
  });
});

describe("validate", () => {
  const schema = z.object({ name: z.string() });

  it("returns parsed data when the payload satisfies the schema", () => {
    const data = { name: "Ada" };
    expect(validate(schema, data)).toEqual({ name: "Ada" });
  });

  it("throws ValidationError with the original Zod issues when validation fails", () => {
    const bad = { name: 123 };

    try {
      validate(schema, bad);
      throw new Error("expected validate to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      const ve = e as ValidationError;
      expect(ve.message).toBe("Validation failed");
      expect(ve.name).toBe("ValidationError");
      expect(ve.issues.length).toBeGreaterThan(0);
      expect(ve.issues[0]?.path).toContain("name");
    }
  });

  it("rejects via ValidationError when required fields are missing", () => {
    expect(() => validate(schema, {})).toThrow(ValidationError);
  });
});
