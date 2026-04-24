import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Tailwind-aware class-name merge helper, mirrors the cn() utility in
 * cc-agent-ui/src/lib/utils.js. Kept local to the Nolme workspace so nolme-ui
 * stays self-contained (no cross-package imports).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
