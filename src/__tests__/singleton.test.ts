import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn().mockResolvedValue(undefined);
const mockPing = vi.fn().mockResolvedValue({ success: true });

vi.mock('@clickhouse/client', () => ({
  createClient: vi.fn(() => ({
    insert: mockInsert,
    ping: mockPing,
  })),
}));

// Import AFTER mock is set up
import { initTelemetry } from '../init';
import { insertInvocation } from '../clickhouse';
import type { McpResourceInvocation } from '../types';

const fakeInvocation: McpResourceInvocation = {
  id: 'test-id',
  x_wallet_address: '0xabc',
  x_client_id: 'client-1',
  session_id: 'session-1',
  verified_wallet_address: '0xdef',
  method: 'POST',
  route: '/api/test',
  origin: 'https://example.com',
  referer: null,
  request_content_type: 'application/json',
  request_headers: '{}',
  request_body: '{"query":"test"}',
  status_code: 200,
  status_text: 'OK',
  duration: 42,
  response_content_type: 'application/json',
  response_headers: '{}',
  response_body: '{"success":true}',
  created_at: new Date('2025-01-01'),
};

describe('singleton lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initTelemetry sets up client so insertInvocation can use it', () => {
    initTelemetry({
      clickhouse: {
        url: 'http://localhost:8123',
        database: 'testdb',
        username: 'user',
        password: 'pass',
      },
    });

    insertInvocation(fakeInvocation);

    expect(mockInsert).toHaveBeenCalledOnce();
    expect(mockInsert).toHaveBeenCalledWith({
      table: 'mcp_resource_invocations',
      values: [fakeInvocation],
      format: 'JSONEachRow',
    });
  });

  it('verify: true triggers a ping after init', () => {
    initTelemetry({
      clickhouse: { url: 'http://localhost:8123' },
      verify: true,
    });

    expect(mockPing).toHaveBeenCalledOnce();
  });
});
