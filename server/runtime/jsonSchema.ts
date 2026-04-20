import { z } from "zod";

/**
 * Minimal Zod → JSON Schema converter sufficient for the OpenAI-style `tools`
 * payload (string, number, boolean, enum, array, object, optional, nullable).
 * Avoids a third-party dependency; extend as new Zod types are needed.
 */
export function zodToJsonSchema(schema: z.ZodType<unknown>): Record<string, unknown> {
  const def = (schema as unknown as { _def: { typeName: string } })._def;
  const typeName = def.typeName;

  switch (typeName) {
    case "ZodString": {
      const description = (schema as unknown as { description?: string }).description;
      return description ? { type: "string", description } : { type: "string" };
    }
    case "ZodNumber":
      return { type: "number" };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodEnum": {
      const values = (def as unknown as { values: string[] }).values;
      return { type: "string", enum: values };
    }
    case "ZodArray": {
      const inner = (def as unknown as { type: z.ZodType<unknown> }).type;
      return { type: "array", items: zodToJsonSchema(inner) };
    }
    case "ZodObject": {
      const shape = (schema as unknown as { shape: Record<string, z.ZodType<unknown>> }).shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        const valueDef = (value as unknown as { _def: { typeName: string } })._def;
        const isOptional =
          valueDef.typeName === "ZodOptional" || valueDef.typeName === "ZodDefault";
        const unwrapped = isOptional
          ? ((valueDef as unknown as { innerType: z.ZodType<unknown> }).innerType)
          : value;
        properties[key] = zodToJsonSchema(unwrapped);
        if (!isOptional) required.push(key);
        const desc = (value as unknown as { description?: string }).description;
        if (desc) (properties[key] as Record<string, unknown>).description = desc;
      }
      const result: Record<string, unknown> = { type: "object", properties };
      if (required.length > 0) result.required = required;
      return result;
    }
    case "ZodOptional":
    case "ZodDefault":
    case "ZodNullable": {
      const inner = (def as unknown as { innerType: z.ZodType<unknown> }).innerType;
      return zodToJsonSchema(inner);
    }
    default:
      return {};
  }
}
