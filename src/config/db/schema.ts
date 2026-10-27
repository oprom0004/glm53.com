import { envConfigs } from '@/config';

import * as mysql from './schema.mysql';
import * as postgres from './schema.postgres';
import * as sqlite from './schema.sqlite';

// Runtime tables must use the same dialect as the connection. The PostgreSQL
// types describe the common model fields; SQLite remains available for tests.
const schema = (
  ['sqlite', 'turso', 'd1'].includes(envConfigs.database_provider)
    ? sqlite
    : envConfigs.database_provider === 'mysql'
      ? mysql
      : postgres
) as typeof postgres;

export const {
  user,
  session,
  account,
  verification,
  config,
  taxonomy,
  post,
  order,
  subscription,
  credit,
  apikey,
  role,
  permission,
  rolePermission,
  userRole,
  aiTask,
  chat,
  chatMessage,
} = schema;
