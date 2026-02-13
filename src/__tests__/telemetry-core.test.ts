import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn().mockResolvedValue(undefined);

vi.mock('@clickhouse/client', () => ({
  createClient: vi.fn(() => ({
    insert: mockInsert,
    ping: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

import { NextRequest } from 'next/server';
import { initTelemetry } from '../init';
import { extractRequestMeta, buildTelemetryContext, recordInvocation } from '../telemetry-core';

// Init once for the module
initTelemetry({ clickhouse: { url: 'http://localhost:8123' } });

function makeRequest(
  path: string,
  options?: { method?: string; headers?: Record<string, string> },
) {
  return new NextRequest(new URL(path, 'https://example.com'), {
    method: options?.method ?? 'GET',
    headers: options?.headers,
  });
}

describe('extractRequestMeta', () => {
  it('extracts identity headers from a request', () => {
    const req = makeRequest('/api/search', {
      method: 'POST',
      headers: {
        'X-Wallet-Address': '0xAbC123',
        'X-Client-ID': 'mcp-client',
        'X-Session-ID': 'sess-42',
        Referer: 'https://app.example.com',
        'content-type': 'application/json',
      },
    });

    const meta = extractRequestMeta(req);

    expect(meta.walletAddress).toBe('0xabc123');
    expect(meta.clientId).toBe('mcp-client');
    expect(meta.sessionId).toBe('sess-42');
    expect(meta.referer).toBe('https://app.example.com');
    expect(meta.requestContentType).toBe('application/json');
    expect(meta.route).toBe('/api/search');
    expect(meta.method).toBe('POST');
    expect(meta.requestId).toBeTruthy();
    expect(meta.startTime).toBeGreaterThan(0);
  });
});

describe('buildTelemetryContext', () => {
  it('setVerifiedWallet mutates meta so recordInvocation sees it', () => {
    const req = makeRequest('/api/test');
    const meta = extractRequestMeta(req);
    const ctx = buildTelemetryContext(meta);

    expect(meta.verifiedWallet).toBeNull();

    ctx.setVerifiedWallet('0xABCD1234');

    expect(meta.verifiedWallet).toBe('0xabcd1234');
    expect(ctx.verifiedWallet).toBe('0xabcd1234');
  });
});

describe('recordInvocation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds invocation and calls insertInvocation with the right shape', () => {
    const req = makeRequest('/api/data', {
      method: 'POST',
      headers: { 'X-Wallet-Address': '0xWallet' },
    });
    const meta = extractRequestMeta(req);
    const ctx = buildTelemetryContext(meta);
    ctx.setVerifiedWallet('0xVerified');

    recordInvocation(meta, '{"query":"test"}', {
      status: 200,
      body: '{"ok":true}',
      headers: '{}',
      contentType: 'application/json',
    });

    expect(mockInsert).toHaveBeenCalledOnce();
    const invocation = mockInsert.mock.calls[0][0].values[0];

    expect(invocation.route).toBe('/api/data');
    expect(invocation.method).toBe('POST');
    expect(invocation.verified_wallet_address).toBe('0xverified');
    expect(invocation.request_body).toBe('{"query":"test"}');
    expect(invocation.status_code).toBe(200);
    expect(invocation.status_text).toBe('OK');
    expect(invocation.response_body).toBe('{"ok":true}');
    expect(invocation.duration).toBeGreaterThanOrEqual(0);
  });
});
