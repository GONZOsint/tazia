import { RegionAshOverlay } from './RegionAshOverlay';

interface TalkAshOverlayProps {
  /** When true, extinguish plaza talk / topic ash targets then call onComplete. */
  play: boolean;
  onComplete: () => void;
}

/**
 * Unanimous hoguera delete — cool extinguish front on reader + topic chip
 * (RegionAshOverlay mode=extinguish; zone leave stays mode=burn).
 */
export function TalkAshOverlay({ play, onComplete }: TalkAshOverlayProps) {
  return (
    <RegionAshOverlay
      play={play}
      onComplete={onComplete}
      mode="extinguish"
      canvasId="talk-ash-fire-canvas"
      selectors={['.plaza-talk-ash-target', '.plaza-topic-ash-target']}
      maxEdgePx={[460, 280]}
    />
  );
}
