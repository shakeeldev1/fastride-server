import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { join } from 'path';
import { getBaseDatabaseConfig } from './config/database.config';

export default new DataSource({
  ...getBaseDatabaseConfig(),
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  entities: [join(__dirname, '**', 'entities', '*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations', '*.{ts,js}')],
});
