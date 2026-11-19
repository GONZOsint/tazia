export {
  randomAvatarSeed,
  decodeAvatarSeed,
  encodeAvatarSeed,
  isValidAvatarSeed,
  MAX_AVATAR_SEED_CHARS,
  type AvatarSeedParts,
} from './avatarSeed';
export { mountFlameAvatar, type FlameAvatarHandle } from './flameEngine';
export type { FlameThemeMode } from './themeWatch';
export {
  rememberPeerAvatarSeed,
  rememberPeerAvatarSeeds,
  peerAvatarSeed,
  clearPeerAvatarSeeds,
} from './peerSeedCache';
