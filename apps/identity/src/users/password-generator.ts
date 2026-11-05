import { randomInt } from 'node:crypto';

const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWERCASE = 'abcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';
const SYMBOLS = '!@#$%^&*';
const ALL = UPPERCASE + LOWERCASE + DIGITS + SYMBOLS;

const LENGTH = 12;

function pick(chars: string): string {
  return chars[randomInt(0, chars.length)] as string;
}

export function generatePassword(): string {
  const required = [
    pick(UPPERCASE),
    pick(LOWERCASE),
    pick(DIGITS),
    pick(SYMBOLS),
  ];
  const rest = Array.from({ length: LENGTH - required.length }, () => pick(ALL));
  const chars = [...required, ...rest];
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j] as string, chars[i] as string];
  }
  return chars.join('');
}
