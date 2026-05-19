import dataSource from '../data-source';

async function run() {
  try {
    await dataSource.initialize();
    console.log('DataSource initialized');
    const result = await dataSource.runMigrations();
    console.log('Migrations run:', result.map((m) => m.name));
    await dataSource.destroy();
    process.exit(0);
  } catch (err) {
    console.error('Migration run failed:', err);
    process.exit(1);
  }
}

run();
