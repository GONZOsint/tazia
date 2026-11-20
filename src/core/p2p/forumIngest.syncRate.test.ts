import { describe, expect, it } from 'vitest';
import { generateSigningIdentity, signForumEvent } from '../crypto/messageSigning';
import { PROTOCOL_VERSION, MAX_PUBLISH_PER_MINUTE, type ForumEvent } from '../protocol';
import { TrustStore } from '../trust/trustStore';
import { ForumIngest } from './forumIngest';
import { PeerRateLimiter } from './rateLimit';
import { VerifyKeyRegistry } from './verifyKeyRegistry';

describe('ForumIngest sync vs publish rate limit', () => {
  it('ingests more than MAX_PUBLISH_PER_MINUTE events from sync of one author', async () => {
    const identity = await generateSigningIdentity();
    const authorUserId = 'author01abcdefghij';
    const trust = new TrustStore();
    trust.observe(authorUserId, identity.publicKeySpkiB64);
    const registry = new VerifyKeyRegistry({ trustStore: trust });
    await registry.observe(authorUserId, identity.publicKeySpkiB64);

    const rateLimiter = new PeerRateLimiter();
    // Saturate the publish window so live/fallback would reject.
    for (let i = 0; i < MAX_PUBLISH_PER_MINUTE; i++) {
      expect(rateLimiter.allow(authorUserId, MAX_PUBLISH_PER_MINUTE)).toBe(true);
    }
    expect(rateLimiter.allow(authorUserId, MAX_PUBLISH_PER_MINUTE)).toBe(false);

    const ingest = new ForumIngest({
      rateLimiter,
      registry,
      onForumMessage: () => {},
    });

    const count = MAX_PUBLISH_PER_MINUTE + 5;
    let added = 0;
    for (let i = 0; i < count; i++) {
      const msgId = `msg${String(i).padStart(14, '0')}`;
      const base: ForumEvent = {
        protocolVersion: PROTOCOL_VERSION,
        msgId,
        type: 'NEW_THREAD',
        threadId: msgId,
        parentMsgId: null,
        title: `t${i}`,
        body: 'hello',
        createdAtMs: Date.now() - (count - i) * 1000,
        authorUserId,
        sig: '',
      };
      const signed = await signForumEvent(base, identity);
      const ok = await ingest.ingest(signed, { source: 'sync' });
      if (ok) added += 1;
    }

    expect(added).toBe(count);
  });
});
