import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { SecretBox } from './secret-box';

const newBox = () =>
  SecretBox.fromBase64Key(randomBytes(32).toString('base64'));
const SECRET = 'sk-ant-api03-example-secret-value-1234';

describe('SecretBox', () => {
  it('round-trips a secret for the same context', () => {
    const box = newBox();
    const payload = box.encrypt(SECRET, 'user-1:anthropic');
    expect(payload.startsWith('v1.')).toBe(true);
    expect(payload).not.toContain(SECRET);
    expect(box.decrypt(payload, 'user-1:anthropic')).toBe(SECRET);
  });

  it('uses a fresh IV, so the same secret never encrypts to the same payload', () => {
    const box = newBox();
    expect(box.encrypt(SECRET, 'ctx')).not.toBe(box.encrypt(SECRET, 'ctx'));
  });

  it("refuses to decrypt a payload moved to another user's context", () => {
    const box = newBox();
    const payload = box.encrypt(SECRET, 'user-1:anthropic');
    expect(() => box.decrypt(payload, 'user-2:anthropic')).toThrow();
    expect(() => box.decrypt(payload, 'user-1:openai')).toThrow();
  });

  it('detects tampering with the ciphertext', () => {
    const box = newBox();
    const [version, iv, tag, ciphertext] = box
      .encrypt(SECRET, 'ctx')
      .split('.');
    const bytes = Buffer.from(ciphertext, 'base64');
    bytes[0] ^= 0xff;
    const tampered = [version, iv, tag, bytes.toString('base64')].join('.');
    expect(() => box.decrypt(tampered, 'ctx')).toThrow();
  });

  it('cannot be decrypted with a different key', () => {
    const payload = newBox().encrypt(SECRET, 'ctx');
    expect(() => newBox().decrypt(payload, 'ctx')).toThrow();
  });

  it('rejects unknown formats and versions', () => {
    const box = newBox();
    expect(() => box.decrypt('plain-text', 'ctx')).toThrow(/format/);
    const payload = box.encrypt(SECRET, 'ctx').replace(/^v1\./, 'v9.');
    expect(() => box.decrypt(payload, 'ctx')).toThrow(/format/);
  });

  it('requires a 32-byte key', () => {
    expect(() =>
      SecretBox.fromBase64Key(randomBytes(16).toString('base64')),
    ).toThrow(/32/);
    expect(() => SecretBox.fromBase64Key('')).toThrow(/32/);
  });
});
