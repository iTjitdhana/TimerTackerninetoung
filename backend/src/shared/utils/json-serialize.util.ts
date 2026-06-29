export function serializeForJson<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, val) => {
      if (typeof val === "bigint") {
        return val.toString();
      }
      if (
        val &&
        typeof val === "object" &&
        typeof (val as { toNumber?: () => number }).toNumber === "function"
      ) {
        return (val as { toNumber: () => number }).toNumber();
      }
      return val;
    }),
  ) as T;
}
