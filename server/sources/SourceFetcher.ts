import { isIP } from 'node:net';
import { lookup as dnsLookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Readable } from 'node:stream';
import { canonicalizeSourceUrl } from '../../shared/来源去重.js';

type FetchImplementation = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
type LookupResult = { address: string; family: number };
type LookupImplementation = (hostname: string) => Promise<LookupResult[]>;

interface SourceFetcherOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  fetchImplementation?: FetchImplementation;
  lookup?: LookupImplementation;
  cacheTtlMs?: number;
}

export interface FetchedSource {
  finalUrl: string;
  contentType: string;
  body: string;
  retrievedAt: string;
  cached: boolean;
}

const parseIpv4 = (address: string) => address.split('.').map(Number);
const isBlockedIpv4 = (address: string) => {
  const [a, b] = parseIpv4(address);
  return a === 0 || a === 10 || a === 127 ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) ||
    a >= 224;
};
const isBlockedIp = (address: string) => {
  const normalized = address.toLowerCase().split('%')[0];
  if (isIP(normalized) === 4) return isBlockedIpv4(normalized);
  if (isIP(normalized) === 6) {
    if (normalized === '::1' || normalized === '::' ||
      normalized.startsWith('fc') || normalized.startsWith('fd') ||
      /^(?:fe[89ab])[0-9a-f]:/u.test(normalized) || normalized.startsWith('ff')) return true;
    if (normalized.startsWith('::ffff:')) {
      const mapped = normalized.slice(7);
      if (isIP(mapped) === 4) return isBlockedIpv4(mapped);
      const hex = mapped.split(':');
      if (hex.length === 2 && hex.every((part) => /^[0-9a-f]{1,4}$/u.test(part))) {
        const first = Number.parseInt(hex[0], 16);
        const second = Number.parseInt(hex[1], 16);
        return isBlockedIpv4(`${first >> 8}.${first & 255}.${second >> 8}.${second & 255}`);
      }
    }
    return false;
  }
  return true;
};

export function fetchPinnedUrl(
  url: URL,
  address: LookupResult,
  signal: AbortSignal,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)({
      protocol: url.protocol,
      hostname: address.address,
      family: address.family,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: 'GET',
      headers: {
        Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8',
        Host: url.host,
        'User-Agent': 'NewsPilot-EvidenceFetcher/1.0',
      },
      signal,
      ...(url.protocol === 'https:' ? { servername: url.hostname } : {}),
    }, (incoming) => {
      const headers = new Headers();
      for (const [name, value] of Object.entries(incoming.headers)) {
        if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
        else if (value !== undefined) headers.set(name, value);
      }
      const status = incoming.statusCode || 500;
      const hasBody = ![204, 205, 304].includes(status);
      resolve(new Response(
        hasBody ? Readable.toWeb(incoming) as ReadableStream<Uint8Array> : null,
        { status, statusText: incoming.statusMessage, headers },
      ));
    });
    request.once('error', reject);
    request.end();
  });
}

export class SourceFetcher {
  private readonly timeoutMs: number;
  private readonly maxBytes: number;
  private readonly maxRedirects: number;
  private readonly fetchImplementation?: FetchImplementation;
  private readonly lookup: LookupImplementation;
  private readonly cacheTtlMs: number;
  private readonly cache = new Map<string, { expiresAt: number; value: FetchedSource }>();
  private readonly maxCacheEntries = 200;

  constructor(options: SourceFetcherOptions = {}) {
    this.timeoutMs = options.timeoutMs || 10_000;
    this.maxBytes = options.maxBytes || 2 * 1024 * 1024;
    this.maxRedirects = Math.min(5, Math.max(0, options.maxRedirects ?? 3));
    this.fetchImplementation = options.fetchImplementation;
    this.lookup = options.lookup || (async (hostname) =>
      (await dnsLookup(hostname, { all: true, verbatim: true })).map((item) => ({ address: item.address, family: item.family })));
    this.cacheTtlMs = options.cacheTtlMs || 60_000;
  }

  private async validateUrl(value: string) {
    let url: URL;
    try { url = new URL(value); } catch { throw new Error('来源 URL 无效。'); }
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('来源 URL 只允许 HTTP 或 HTTPS。');
    if (url.username || url.password) throw new Error('来源 URL 不允许包含账号信息。');
    const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/gu, '');
    if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
      throw new Error('不允许访问本机或局域网地址。');
    }
    if (hostname === 'metadata.google.internal' || hostname.endsWith('.internal')) {
      throw new Error('不允许访问云服务元数据或内部地址。');
    }
    const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await this.lookup(hostname);
    if (!addresses.length || addresses.some((item) => isBlockedIp(item.address))) {
      throw new Error('不允许访问本机、内网或云服务元数据地址。');
    }
    return { url, addresses };
  }

  private async readLimited(response: Response) {
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > this.maxBytes) throw new Error('来源页面内容过大。');
    if (!response.body) return '';
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > this.maxBytes) {
        await reader.cancel();
        throw new Error('来源页面内容过大。');
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }

  async fetch(value: string, options: { forceRefresh?: boolean } = {}): Promise<FetchedSource> {
    let cacheKey: string;
    try { cacheKey = canonicalizeSourceUrl(value); } catch { cacheKey = value; }
    const cached = this.cache.get(cacheKey);
    if (!options.forceRefresh && cached && cached.expiresAt > Date.now()) {
      return { ...structuredClone(cached.value), cached: true };
    }
    let target = await this.validateUrl(value);
    for (let redirects = 0; redirects <= this.maxRedirects; redirects += 1) {
      const controller = new AbortController();
      const timeout = globalThis.setTimeout(() => controller.abort(), this.timeoutMs);
      let response: Response;
      try {
        response = this.fetchImplementation
          ? await this.fetchImplementation(target.url, {
              method: 'GET', redirect: 'manual', signal: controller.signal,
              headers: { Accept: 'text/html,application/xhtml+xml,text/plain;q=0.8', 'User-Agent': 'NewsPilot-EvidenceFetcher/1.0' },
            })
          : await fetchPinnedUrl(target.url, target.addresses[0], controller.signal);
      } finally {
        globalThis.clearTimeout(timeout);
      }
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        if (redirects >= this.maxRedirects) throw new Error('来源页面重定向次数过多。');
        const location = response.headers.get('location');
        if (!location) throw new Error('来源页面返回无目标重定向。');
        await response.body?.cancel();
        target = await this.validateUrl(new URL(location, target.url).toString());
        continue;
      }
      if (!response.ok) throw new Error(`来源页面获取失败（HTTP ${response.status}）。`);
      const contentType = (response.headers.get('content-type') || '').split(';', 1)[0].trim().toLowerCase();
      if (!['text/html', 'application/xhtml+xml', 'text/plain'].includes(contentType)) {
        throw new Error(`不支持的来源内容类型 Content-Type：${contentType || '未知'}。`);
      }
      const result: FetchedSource = { finalUrl: target.url.toString(), contentType, body: await this.readLimited(response), retrievedAt: new Date().toISOString(), cached: false };
      if (this.cache.size >= this.maxCacheEntries) {
        const oldestKey = this.cache.keys().next().value;
        if (typeof oldestKey === 'string') this.cache.delete(oldestKey);
      }
      this.cache.set(cacheKey, { expiresAt: Date.now() + this.cacheTtlMs, value: structuredClone(result) });
      return result;
    }
    throw new Error('来源页面重定向次数过多。');
  }
}
