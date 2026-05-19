import dataSource from '../data-source';

async function run() {
  try {
    await dataSource.initialize();
    console.log('DataSource initialized');
    await dataSource.undoLastMigration();
    console.log('Reverted last migration');
    await dataSource.destroy();
    process.exit(0);
  } catch (err) {
    console.error('Migration revert failed:', err);
    process.exit(1);
  }
}

run();
