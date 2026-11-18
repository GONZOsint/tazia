import type { en } from './en';

export type Locale = 'es' | 'en';

export type MessageKey = keyof typeof en;

export type Messages = Record<MessageKey, string>;
