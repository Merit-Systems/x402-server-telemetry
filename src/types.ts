/**
 * ClickHouse row type for mcp_resource_invocations table.
 * This is the real contract — not the DDL.
 */
export interface McpResourceInvocation {
  id: string;
  x_wallet_address: string | null;
  x_client_id: string | null;
  session_id: string | null;
  verified_wallet_address: string | null;

  method: string;
  route: string;
  origin: string;
  referer: string | null;
  request_content_type: string | null;
  request_headers: string | null;
  request_body: string | null;

  status_code: number;
  status_text: string;
  duration: number;
  response_content_type: string | null;
  response_headers: string | null;
  response_body: string | null;

  created_at: Date;
}

/**
 * Telemetry context passed to handler functions.
 */
export interface TelemetryContext {
  /** Wallet address from X-Wallet-Address header (lowercased) */
  walletAddress: string | null;
  /** Client ID from X-Client-ID header */
  clientId: string | null;
  /** Session ID from X-Session-ID header */
  sessionId: string | null;
  /** Verified wallet address (auto-extracted from x402 payment, or set manually) */
  verifiedWallet: string | null;
  /** Manually set the verified wallet address (for SIWX, API-key, or other auth) */
  setVerifiedWallet: (address: string) => void;
}

/**
 * Extracted request metadata — shared mutable state between context and logging.
 * `verifiedWallet` is mutated by `setVerifiedWallet` so `recordInvocation` sees updates.
 */
export interface RequestMeta {
  requestId: string;
  startTime: number;
  walletAddress: string | null;
  clientId: string | null;
  sessionId: string | null;
  verifiedWallet: string | null;
  route: string;
  method: string;
  origin: string;
  referer: string | null;
  requestContentType: string | null;
  requestHeadersJson: string | null;
}

/**
 * ClickHouse connection config for initTelemetry.
 */
export interface TelemetryConfig {
  clickhouse: {
    url: string;
    database?: string;
    username?: string;
    password?: string;
  };
  /** Server's own origin URL (e.g., 'https://enrichx402.com'). Auto-detected from request if not set. */
  origin?: string;
  /** If true, pings ClickHouse on init and logs the result. Never throws or blocks. */
  verify?: boolean;
}
