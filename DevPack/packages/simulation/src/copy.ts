/** Deep copy of JSON-like plain data (objects, arrays, primitives). Used so no internal reference escapes. */
export function clonePlain<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item: unknown) => clonePlain(item)) as T;
  if (typeof value === "object" && value !== null) {
    const copy: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) copy[key] = clonePlain(item);
    return copy as T;
  }
  return value;
}
