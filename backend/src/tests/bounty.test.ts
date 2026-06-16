import { encrypt, decrypt } from '../services/encryption';
import { parseBountyAmount } from '../services/github';

describe('Encryption Service', () => {
  it('should encrypt and decrypt a string value correctly', () => {
    const testPat = 'ghp_1234567890abcdefghijklmnopqrstuvwxyz';
    const encrypted = encrypt(testPat);
    
    expect(encrypted.encryptedPat).toBeDefined();
    expect(encrypted.iv).toBeDefined();
    expect(encrypted.tag).toBeDefined();
    
    const decrypted = decrypt(encrypted.encryptedPat, encrypted.iv, encrypted.tag);
    expect(decrypted).toBe(testPat);
  });
});

describe('Bounty Parsing Service', () => {
  // ────────────────────────────────────────────────────────────────────
  // Label detection
  // ────────────────────────────────────────────────────────────────────

  it('detects exact label "Bounty" (case-insensitive)', () => {
    const r = parseBountyAmount('title', '', ['Bounty']);
    expect(r.hasBounty).toBe(true);
  });

  it('detects exact label "bounty" lowercase', () => {
    const r = parseBountyAmount('title', '', ['bounty']);
    expect(r.hasBounty).toBe(true);
  });

  it('detects label "💎 Bounty" (Algora-style with leading emoji)', () => {
    const r = parseBountyAmount('title', '', ['💎 Bounty']);
    expect(r.hasBounty).toBe(true);
  });

  it('detects label "💰 Reward"', () => {
    const r = parseBountyAmount('title', '', ['💰 Reward']);
    expect(r.hasBounty).toBe(true);
  });

  it('detects exact label "Reward" (case-insensitive)', () => {
    const r = parseBountyAmount('title', '', ['Reward']);
    expect(r.hasBounty).toBe(true);
  });

  it('does NOT detect "rewarded" — only "bounty" and "reward" are valid', () => {
    const r = parseBountyAmount('title', '', ['rewarded']);
    expect(r.hasBounty).toBe(false);
  });

  it('does NOT detect "paid-issue" label', () => {
    const r = parseBountyAmount('title', '', ['paid-issue']);
    expect(r.hasBounty).toBe(false);
  });

  it('does NOT detect "algora" label alone', () => {
    const r = parseBountyAmount('title', '', ['algora', 'bug']);
    expect(r.hasBounty).toBe(false);
  });

  it('does NOT detect "monetize" label', () => {
    const r = parseBountyAmount('title', '', ['monetize', 'enhancement']);
    expect(r.hasBounty).toBe(false);
  });

  it('returns false with no labels at all', () => {
    const r = parseBountyAmount('Fix bug', 'We pay $500 for this.', []);
    expect(r.hasBounty).toBe(false);
    expect(r.amount).toBeNull();
  });

  // ────────────────────────────────────────────────────────────────────
  // Amount parsing
  // ────────────────────────────────────────────────────────────────────

  it('parses amount from body when bounty label present', () => {
    const r = parseBountyAmount('Fix memory leaks', 'We offer a reward of $250 for fixing this.', ['bounty']);
    expect(r.hasBounty).toBe(true);
    expect(r.amount).toBe(250);
  });

  it('parses amount from body when reward label present', () => {
    const r = parseBountyAmount('Add postgres adapter', 'Bounty is 500 USD for verified PR.', ['reward']);
    expect(r.hasBounty).toBe(true);
    expect(r.amount).toBe(500);
  });

  it('parses amount from title when bounty label present', () => {
    const r = parseBountyAmount('[$500] Fix race condition in cache layer', 'Details below.', ['Bounty']);
    expect(r.hasBounty).toBe(true);
    expect(r.amount).toBe(500);
  });

  it('parses amount from $-prefix title pattern', () => {
    const r = parseBountyAmount('$250: Improve search indexing', '', ['bounty']);
    expect(r.hasBounty).toBe(true);
    expect(r.amount).toBe(250);
  });

  it('returns highest amount when multiple values are present', () => {
    const r = parseBountyAmount('Bounty $150: Fix styling', 'Increase reward to $300.', ['bounty']);
    expect(r.hasBounty).toBe(true);
    expect(r.amount).toBe(300);
  });

  it('returns null amount when bounty label exists but no dollar amount anywhere', () => {
    const r = parseBountyAmount('Implement MFA', 'Discuss the scope here.', ['bounty', 'enhancement']);
    expect(r.hasBounty).toBe(true);
    expect(r.amount).toBeNull();
  });

  it('does not pick up unrelated dollar amounts in body without monetary context', () => {
    const r = parseBountyAmount(
      'Update pricing page copy',
      'The product now costs $9 per month for basic users.',
      ['bounty']
    );
    expect(r.hasBounty).toBe(true); // label present → bounty issue
    expect(r.amount).toBeNull();    // but $9 has no bounty context
  });

});

