/**
 * Shared telemetry primitives used by withTelemetry and the route builder.
 * Extracts request metadata, builds telemetry context, and records invocations.
 */

import { type NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import type { TelemetryContext, McpResourceInvocation, RequestMeta } from './types';
import { insertInvocation } from './clickhouse';
import { extractVerifiedWallet } from './extract-wallet';
import { getOrigin } from './init';

/**
 * Extract identity headers, route info, and verified wallet from a request.
 * All wrapped in try/catch — returns safe defaults on failure.
 */
export function extractRequestMeta(request: NextRequest): RequestMeta {
  const meta: RequestMeta = {
    requestId: randomUUID(),
    startTime: Date.now(),
    walletAddress: null,
    clientId: null,
    sessionId: null,
    verifiedWallet: null,
    route: '',
    method: '',
    origin: '',
    referer: null,
    requestContentType: null,
    requestHeadersJson: null,
  };

  try {
    meta.walletAddress = request.headers.get('X-Wallet-Address')?.toLowerCase() ?? null;
    meta.clientId = request.headers.get('X-Client-ID') ?? null;
    meta.sessionId = request.headers.get('X-Session-ID') ?? null;
    meta.referer = request.headers.get('Referer') ?? null;
    meta.requestContentType = request.headers.get('content-type') ?? null;
    meta.route = request.nextUrl.pathname;
    meta.method = request.method;
    meta.origin = getOrigin() ?? request.nextUrl.origin;
    meta.verifiedWallet = extractVerifiedWallet(request.headers);
    meta.requestHeadersJson = JSON.stringify(Object.fromEntries(request.headers.entries()));
  } catch {
    // Header extraction failed — continue with defaults
  }

  return meta;
}

/**
 * Build a TelemetryContext from extracted request metadata.
 * setVerifiedWallet mutates meta.verifiedWallet so recordInvocation sees the update.
 */
export function buildTelemetryContext(meta: RequestMeta): TelemetryContext {
  const ctx: TelemetryContext = {
    walletAddress: meta.walletAddress,
    clientId: meta.clientId,
    sessionId: meta.sessionId,
    verifiedWallet: meta.verifiedWallet,
    setVerifiedWallet: (address: string) => {
      meta.verifiedWallet = address.toLowerCase();
      ctx.verifiedWallet = meta.verifiedWallet;
    },
  };
  return ctx;
}

/**
 * Record an invocation to ClickHouse. Fire-and-forget, fully wrapped in try/catch.
 */
export function recordInvocation(
  meta: RequestMeta,
  requestBody: string | null,
  response: {
    status: number;
    body: string | null;
    headers: string | null;
    contentType: string | null;
  },
): void {
  try {
    const invocation: McpResourceInvocation = {
      id: meta.requestId,
      x_wallet_address: meta.walletAddress,
      x_client_id: meta.clientId,
      session_id: meta.sessionId,
      verified_wallet_address: meta.verifiedWallet,
      method: meta.method,
      route: meta.route,
      origin: meta.origin,
      referer: meta.referer,
      request_content_type: meta.requestContentType,
      request_headers: meta.requestHeadersJson,
      request_body: requestBody,
      status_code: response.status,
      status_text: statusTextFromCode(response.status),
      duration: Date.now() - meta.startTime,
      response_content_type: response.contentType,
      response_headers: response.headers,
      response_body: response.body,
      created_at: new Date(),
    };
    insertInvocation(invocation);
  } catch {
    // Never affects the response
  }
}

function statusTextFromCode(code: number): string {
  switch (code) {
    case 200:
      return 'OK';
    case 201:
      return 'Created';
    case 204:
      return 'No Content';
    case 400:
      return 'Bad Request';
    case 401:
      return 'Unauthorized';
    case 402:
      return 'Payment Required';
    case 403:
      return 'Forbidden';
    case 404:
      return 'Not Found';
    case 500:
      return 'Internal Server Error';
    case 504:
      return 'Gateway Timeout';
    default:
      return String(code);
  }
}
