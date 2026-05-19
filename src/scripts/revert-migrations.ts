import dataSource from '../data-source';

async function run() {
  try {
    await dataSource.initialize();
    console.log('DataSource initialized');
    const result = await dataSource.undoLastMigration();
    console.log('Reverted migration:', result ? 'success' : 'no migration to revert');
    await dataSource.destroy();
    process.exit(0);
  } catch (err) {
    console.error('Migration revert failed:', err);
    process.exit(1);
  }
}

run();
