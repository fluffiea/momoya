import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

const __dir = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.join(__dir, '../.env') });
loadEnv({ path: path.join(__dir, '../../.env') });
