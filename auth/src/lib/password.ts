import argon2 from 'argon2';
import zxcvbn from 'zxcvbn';
import { Settings } from '../models/settings.js';

const HASH_OPTS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

export const hashPassword = (plain: string): Promise<string> =>
  argon2.hash(plain, HASH_OPTS);

export const verifyPassword = async (
  hash: string,
  plain: string
): Promise<boolean> => {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
};

export type PasswordPolicyError =
  | { code: 'too_short'; min: number }
  | { code: 'too_weak'; score: number; min: number; suggestions: string[] };

export function validatePassword(
  plain: string,
  userInputs: string[] = []
): PasswordPolicyError | null {
  const s = Settings.get();
  if (plain.length < s.password_min_length) {
    return { code: 'too_short', min: s.password_min_length };
  }
  const result = zxcvbn(plain, userInputs);
  if (result.score < s.password_min_score) {
    return {
      code: 'too_weak',
      score: result.score,
      min: s.password_min_score,
      suggestions: result.feedback.suggestions ?? [],
    };
  }
  return null;
}
