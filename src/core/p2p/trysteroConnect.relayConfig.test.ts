import { describe, expect, it } from 'vitest';

/**
 * Mirrors openTrysteroRoom's conditional relayConfig spread without opening WebRTC.
 * Keeps the join option contract covered when Trystero APIs drift.
 */
function buildJoinRoomConfigExtras(options: {
  turnConfig?: RTCIceServer[];
  relayUrls?: string[];
}): {
  turnConfig?: RTCIceServer[];
  relayConfig?: { urls: string[] };
} {
  return {
    ...(options.turnConfig?.length ? { turnConfig: options.turnConfig } : {}),
    ...(options.relayUrls?.length ? { relayConfig: { urls: options.relayUrls } } : {}),
  };
}

describe('openTrysteroRoom relayConfig wiring', () => {
  it('omits relayConfig when relayUrls missing or empty', () => {
    expect(buildJoinRoomConfigExtras({})).toEqual({});
    expect(buildJoinRoomConfigExtras({ relayUrls: [] })).toEqual({});
  });

  it('passes relayConfig.urls when relayUrls is non-empty', () => {
    expect(
      buildJoinRoomConfigExtras({
        relayUrls: ['wss://a.example', 'wss://b.example'],
      })
    ).toEqual({
      relayConfig: { urls: ['wss://a.example', 'wss://b.example'] },
    });
  });

  it('can combine turnConfig and relayConfig', () => {
    const turnConfig: RTCIceServer[] = [{ urls: 'turn:example.com:3478' }];
    expect(
      buildJoinRoomConfigExtras({
        turnConfig,
        relayUrls: ['wss://relay.example'],
      })
    ).toEqual({
      turnConfig,
      relayConfig: { urls: ['wss://relay.example'] },
    });
  });
});
