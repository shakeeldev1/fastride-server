import { DataSource } from 'typeorm';
import { join } from 'path';
import { getBaseDatabaseConfig, getMigrationDatabaseCandidates } from '../config/database.config';

function createMigrationDataSource(databaseName: string): DataSource {
  return new DataSource({
    ...getBaseDatabaseConfig(),
    database: databaseName,
    synchronize: false,
    logging: process.env.NODE_ENV === 'development',
    entities: [join(__dirname, '..', '**', 'entities', '*.entity.{ts,js}')],
    migrations: [join(__dirname, '..', 'migrations', '*.{ts,js}')],
  });
}

async function run() {
  const candidates = getMigrationDatabaseCandidates();

  for (let index = 0; index < candidates.length; index += 1) {
    const databaseName = candidates[index];
    const dataSource = createMigrationDataSource(databaseName);

    try {
      await dataSource.initialize();
      console.log(`DataSource initialized for database: ${databaseName}`);
      const result = await dataSource.runMigrations();
      console.log('Migrations run:', result.map((m) => m.name));
      await dataSource.destroy();
      process.exit(0);
    } catch (err: any) {
      const code = err?.code;
      const canRetry = code === '3D000' && index < candidates.length - 1;

      if (canRetry) {
        console.warn(
          `Database ${databaseName} does not exist. Retrying with ${candidates[index + 1]}...`,
        );
        continue;
      }

      console.error('Migration run failed:', err);
      process.exit(1);
    }
  }
}

run();
