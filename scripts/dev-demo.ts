// Starts the server in demo mode on every OS (no shell-specific env syntax needed):
// TWINT / card show up in the order app as a simulation. No money moves.
import { fileURLToPath } from 'node:url';

process.env.DEMO_PAYMENTS = process.env.DEMO_PAYMENTS || '1';
process.argv[1] = fileURLToPath(new URL('../src/server.ts', import.meta.url));
await import('../src/server.ts');
