import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const BLOCKED_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".home", ".lan"];

export class UnsafeUrlError extends Error {
  code: "UNSAFE_URL";

  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
    this.code = "UNSAFE_URL";
  }
}

function parseUrl(input: string | URL): URL {
  try {
    return input instanceof URL ? input : new URL(input);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }
}

function ipv4ToInt(ip: string): number {
  const parts = ip.split(".").map((part) => Number(part));
  return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

function isPrivateIPv4(ip: string): boolean {
  const value = ipv4ToInt(ip);
  const ranges: Array<[number, number]> = [
    [0x00000000, 0x00ffffff], // 0.0.0.0/8
    [0x0a000000, 0x0affffff], // 10.0.0.0/8
    [0x64400000, 0x647fffff], // 100.64.0.0/10
    [0x7f000000, 0x7fffffff], // 127.0.0.0/8
    [0xa9fe0000, 0xa9feffff], // 169.254.0.0/16
    [0xac100000, 0xac1fffff], // 172.16.0.0/12
    [0xc0000000, 0xc00000ff], // 192.0.0.0/24
    [0xc0000200, 0xc00002ff], // 192.0.2.0/24
    [0xc0586300, 0xc05863ff], // 192.88.99.0/24
    [0xc0a80000, 0xc0a8ffff], // 192.168.0.0/16
    [0xc6120000, 0xc613ffff], // 198.18.0.0/15
    [0xc6336400, 0xc63364ff], // 198.51.100.0/24
    [0xcb007100, 0xcb0071ff], // 203.0.113.0/24
    [0xe0000000, 0xefffffff], // 224.0.0.0/4
    [0xf0000000, 0xffffffff], // 240.0.0.0/4
  ];

  return ranges.some(([start, end]) => value >= start && value <= end);
}

function parseIPv4Tail(group: string): [number, number] | null {
  const parts = group.split(".");
  if (parts.length !== 4) return null;
  const nums = parts.map((part) => Number(part));
  if (nums.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return null;
  return [(nums[0] << 8) | nums[1], (nums[2] << 8) | nums[3]];
}

function expandIPv6(ip: string): number[] | null {
  const [leftRaw, rightRaw] = ip.split("::");
  if (ip.includes("::") && rightRaw === undefined) return null;

  const left = leftRaw ? leftRaw.split(":").filter(Boolean) : [];
  const right = rightRaw ? rightRaw.split(":").filter(Boolean) : [];

  const normalize = (parts: string[]) => {
    const out: number[] = [];
    for (const part of parts) {
      if (part.includes(".")) {
        const tail = parseIPv4Tail(part);
        if (!tail) return null;
        out.push(...tail);
        continue;
      }
      const value = Number.parseInt(part, 16);
      if (Number.isNaN(value) || value < 0 || value > 0xffff) return null;
      out.push(value);
    }
    return out;
  };

  const leftNums = normalize(left);
  const rightNums = normalize(right);
  if (!leftNums || !rightNums) return null;

  if (!ip.includes("::")) {
    return leftNums.length === 8 ? leftNums : null;
  }

  if (leftNums.length + rightNums.length > 8) return null;
  const zeros = new Array(8 - leftNums.length - rightNums.length).fill(0);
  return [...leftNums, ...zeros, ...rightNums];
}

function isPrivateIPv6(ip: string): boolean {
  const parts = expandIPv6(ip);
  if (!parts) return true;

  const allZero = parts.every((n) => n === 0);
  if (allZero) return true; // ::/128
  if (parts.slice(0, 7).every((n) => n === 0) && parts[7] === 1) return true; // ::1

  const first = parts[0];
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10
  if ((first & 0xff00) === 0xff00) return true; // ff00::/8
  if ((first & 0xffc0) === 0xfec0) return true; // fec0::/10
  if (parts[0] === 0x2001 && parts[1] === 0x0db8) return true; // 2001:db8::/32

  // IPv4-mapped IPv6 (::ffff:127.0.0.1)
  if (
    parts[0] === 0 &&
    parts[1] === 0 &&
    parts[2] === 0 &&
    parts[3] === 0 &&
    parts[4] === 0 &&
    parts[5] === 0xffff
  ) {
    const a = (parts[6] >> 8) & 0xff;
    const b = parts[6] & 0xff;
    const c = (parts[7] >> 8) & 0xff;
    const d = parts[7] & 0xff;
    return isPrivateIPv4(`${a}.${b}.${c}.${d}`);
  }

  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost") return true;
  if (!lower.includes(".")) return true; // block single-label names (often internal DNS)
  return BLOCKED_HOST_SUFFIXES.some((suffix) => lower.endsWith(suffix));
}

function isPrivateIp(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIPv4(address);
  if (version === 6) return isPrivateIPv6(address);
  return true;
}

export async function assertPublicHttpUrl(input: string | URL): Promise<URL> {
  const url = parseUrl(input);

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new UnsafeUrlError("Only HTTP(S) URLs are allowed");
  }

  if (url.username || url.password) {
    throw new UnsafeUrlError("URL auth credentials are not allowed");
  }

  const hostname = url.hostname.replace(/\.$/, "");
  if (!hostname) {
    throw new UnsafeUrlError("URL host is missing");
  }

  const ipVersion = isIP(hostname);
  if (ipVersion !== 0) {
    if (isPrivateIp(hostname)) {
      throw new UnsafeUrlError("Private or local network addresses are not allowed");
    }
    return url;
  }

  if (isBlockedHostname(hostname)) {
    throw new UnsafeUrlError("Local hostnames are not allowed");
  }

  let resolved: Awaited<ReturnType<typeof lookup>>;
  try {
    resolved = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new UnsafeUrlError("Could not resolve URL host");
  }

  if (resolved.length === 0) {
    throw new UnsafeUrlError("Could not resolve URL host");
  }

  for (const record of resolved) {
    if (isPrivateIp(record.address)) {
      throw new UnsafeUrlError("Private or local network addresses are not allowed");
    }
  }

  return url;
}
