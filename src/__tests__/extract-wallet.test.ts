import { describe, it, expect } from 'vitest';
import { extractVerifiedWallet } from '../extract-wallet';

function headers(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

function base64(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64');
}

describe('extractVerifiedWallet', () => {
  it('returns x-payer-address when present (lowercased)', () => {
    const result = extractVerifiedWallet(
      headers({ 'x-payer-address': '0xAbCdEf1234567890AbCdEf1234567890AbCdEf12' }),
    );
    expect(result).toBe('0xabcdef1234567890abcdef1234567890abcdef12');
  });

  it('decodes verified wallet from base64 PAYMENT-SIGNATURE header', () => {
    const payment = {
      payload: {
        authorization: { from: '0xDeAdBeEf00000000000000000000000000000001' },
        signature: '0xfakesig',
      },
    };
    const result = extractVerifiedWallet(headers({ 'PAYMENT-SIGNATURE': base64(payment) }));
    expect(result).toBe('0xdeadbeef00000000000000000000000000000001');
  });

  it('falls back to payload.from when authorization.from is missing', () => {
    const payment = {
      payload: { from: '0x1111111111111111111111111111111111111111' },
    };
    const result = extractVerifiedWallet(headers({ 'X-PAYMENT': base64(payment) }));
    expect(result).toBe('0x1111111111111111111111111111111111111111');
  });

  it('returns null when no relevant headers are present', () => {
    expect(extractVerifiedWallet(headers({}))).toBeNull();
    expect(extractVerifiedWallet(headers({ 'content-type': 'application/json' }))).toBeNull();
  });

  it('returns null for malformed base64 / invalid JSON', () => {
    expect(extractVerifiedWallet(headers({ 'PAYMENT-SIGNATURE': 'not-base64!!!' }))).toBeNull();
    expect(
      extractVerifiedWallet(
        headers({ 'PAYMENT-SIGNATURE': Buffer.from('not json').toString('base64') }),
      ),
    ).toBeNull();
  });
});
