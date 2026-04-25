import type { Session } from './models/sessions.js';
import type { User } from './models/users.js';

export type AppEnv = {
  Variables: {
    session: Session | null;
    user: User | null;
    csrfToken: string | null;
  };
  Bindings: {
    // node-server attache req/res raw ici
    incoming: import('node:http').IncomingMessage;
    outgoing: import('node:http').ServerResponse;
  };
};
