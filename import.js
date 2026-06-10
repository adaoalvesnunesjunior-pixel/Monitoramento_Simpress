const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { importCsv, clearDatabase } = require('./database');

const CSV_PATH = path.join(__dirname, '..', 'Chamados de Os(OS).csv');

async function main() {
  console.log('=== Importador de Chamados OS ===\n');

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`Arquivo CSV não encontrado: ${CSV_PATH}`);
    console.error('Coloque o arquivo "Chamados de Os(OS).csv" na pasta raiz do projeto.');
    process.exit(1);
  }

  const content = fs.readFileSync(CSV_PATH, 'latin1');

  let records;
  try {
    records = parse(content, {
      delimiter: ';',
      columns: true,
      skip_empty_lines: true,
      relax_column_count: true,
      bom: true,
    });
    console.log(`Lidos ${records.length} registros do CSV.`);
  } catch (err) {
    console.error('Erro ao parsear CSV:', err.message);
    process.exit(1);
  }

  console.log('Limpando banco de dados...');
  await clearDatabase();

  console.log('Importando registros...');
  const count = await importCsv(records);
  console.log(`Importados ${count} registros com sucesso!`);

  const { getStats } = require('./database');
  const stats = await getStats();
  console.log(`\nResumo:`);
  console.log(`Total de chamados: ${stats.total?.total || 0}`);
  console.log(`Abertos: ${stats.abertos?.total || 0}`);
  console.log(`Finalizados: ${stats.finalizados?.total || 0}`);
  console.log(`Cancelados: ${stats.cancelados?.total || 0}`);

  if (stats.status_agrupado) {
    console.log('\nPor status:');
    stats.status_agrupado.forEach(s => {
      console.log(`  ${s.status}: ${s.count}`);
    });
  }

  process.exit(0);
}

main();
