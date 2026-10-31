/**
 * Stand-in for `next/headers` in tests. Services call headers() only for
 * audit metadata (IP, user agent); outside a request that's simply empty.
 */
export async function headers() {
  return new Headers();
}

const jar = new Map<string, string>();
export async function cookies() {
  return {
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  };
}
