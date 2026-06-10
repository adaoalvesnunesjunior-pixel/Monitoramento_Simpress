const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const { importCsv, clearDatabase } = require('./database');

const CSV_PATH = path.join(__dirname, 'Chamados de Os(OS).csv');
const XLSX_PATH = path.join(__dirname, 'Chamados de Os(OS).xlsx');

async function main() {
  console.log('=== Importador de Chamados OS ===\n');

  let records;
  let sourcePath;

  if (fs.existsSync(XLSX_PATH)) {
    sourcePath = XLSX_PATH;
    try {
      const workbook = XLSX.readFile(XLSX_PATH);
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      records = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      console.log(`Lidos ${records.length} registros do Excel.`);
    } catch (err) {
      console.error('Erro ao ler Excel:', err.message);
      process.exit(1);
    }
  } else if (fs.existsSync(CSV_PATH)) {
    sourcePath = CSV_PATH;
    const content = fs.readFileSync(CSV_PATH, 'latin1');
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
  } else {
    console.error('Nenhum arquivo encontrado. Coloque "Chamados de Os(OS).csv" ou "Chamados de Os(OS).xlsx" na pasta raiz.');
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
