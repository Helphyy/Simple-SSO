import { randomBytes, randomUUID } from 'node:crypto';

export const newId = () => randomUUID();

export const newToken = (bytes = 32) => randomBytes(bytes).toString('hex');
