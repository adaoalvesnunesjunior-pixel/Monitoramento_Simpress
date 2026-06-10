const { createClient } = require('@libsql/client');

let client = null;
let initialized = false;

function getClient() {
  if (client) return client;
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  if (!url) throw new Error('TURSO_DATABASE_URL environment variable is required');
  client = createClient({ url, authToken });
  return client;
}

async function ensureTable() {
  if (initialized) return;
  const c = getClient();
  await c.execute(`CREATE TABLE IF NOT EXISTS chamados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero_os TEXT,
    numero_serie TEXT,
    modelo TEXT,
    cep TEXT,
    loja_localidade TEXT,
    abertura TEXT,
    previsao TEXT,
    finalizado TEXT,
    descricao TEXT,
    observacao TEXT,
    status TEXT,
    ocorrencia TEXT
  )`);
  initialized = true;
}

async function importCsv(records) {
  const c = getClient();
  await ensureTable();

  await c.execute('BEGIN TRANSACTION');
  let count = 0;
  for (const row of records) {
    await c.execute({
      sql: `INSERT INTO chamados (numero_os, numero_serie, modelo, cep, loja_localidade, abertura, previsao, finalizado, descricao, observacao, status, ocorrencia) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        row['Nº da OS'] || row['N� da OS'] || '',
        row['Número de Série'] || row['N�mero de S�rie'] || '',
        row['Modelo'] || '',
        row['CEP'] || '',
        row['Loja/Localidade'] || row['Loja/Localidade'] || '',
        row['Abertura'] || '',
        row['Previsão'] || row['Previs�o'] || '',
        row['Finalizado'] || '',
        row['Descrição'] || row['Descri��o'] || '',
        row['Observação'] || row['Observa��o'] || '',
        row['Status'] || '',
        row['ocorrência'] || row['ocorr�ncia'] || ''
      ]
    });
    count++;
  }
  await c.execute('COMMIT');
  return count;
}

async function getChamados(filters = {}) {
  const c = getClient();
  await ensureTable();

  let sql = 'SELECT * FROM chamados WHERE 1=1';
  const args = [];

  if (filters.status) {
    sql += ' AND status LIKE ?';
    args.push(`%${filters.status}%`);
  }
  if (filters.modelo) {
    sql += ' AND modelo LIKE ?';
    args.push(`%${filters.modelo}%`);
  }
  if (filters.loja) {
    sql += ' AND loja_localidade LIKE ?';
    args.push(`%${filters.loja}%`);
  }
  if (filters.search) {
    sql += ' AND (numero_os LIKE ? OR numero_serie LIKE ? OR descricao LIKE ? OR observacao LIKE ? OR ocorrencia LIKE ?)';
    const s = `%${filters.search}%`;
    args.push(s, s, s, s, s);
  }

  sql += ' ORDER BY id DESC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    args.push(parseInt(filters.limit));
  }
  if (filters.offset) {
    sql += ' OFFSET ?';
    args.push(parseInt(filters.offset));
  }

  const result = await c.execute({ sql, args });
  return result.rows;
}

async function getStats() {
  const c = getClient();
  await ensureTable();

  const stats = {};
  const queries = {
    total: 'SELECT COUNT(*) as total FROM chamados',
    abertos: "SELECT COUNT(*) as total FROM chamados WHERE status LIKE 'Aberto'",
    finalizados: "SELECT COUNT(*) as total FROM chamados WHERE status LIKE 'Finalizada'",
    cancelados: "SELECT COUNT(*) as total FROM chamados WHERE status LIKE 'Cancelado'",
    modelos: 'SELECT modelo, COUNT(*) as count FROM chamados GROUP BY modelo ORDER BY count DESC',
    lojas: 'SELECT loja_localidade, COUNT(*) as count FROM chamados GROUP BY loja_localidade ORDER BY count DESC',
    status_agrupado: 'SELECT status, COUNT(*) as count FROM chamados GROUP BY status ORDER BY count DESC',
    ocorrencias: 'SELECT ocorrencia, COUNT(*) as count FROM chamados GROUP BY ocorrencia ORDER BY count DESC',
  };

  for (const [key, sql] of Object.entries(queries)) {
    const result = await c.execute(sql);
    if (key === 'modelos' || key === 'lojas' || key === 'status_agrupado' || key === 'ocorrencias') {
      stats[key] = result.rows;
    } else {
      stats[key] = result.rows[0] || {};
    }
  }

  return stats;
}

async function getChamadoById(id) {
  const c = getClient();
  await ensureTable();
  const result = await c.execute({ sql: 'SELECT * FROM chamados WHERE id = ?', args: [id] });
  return result.rows[0] || null;
}

async function clearDatabase() {
  const c = getClient();
  await ensureTable();
  await c.execute('DELETE FROM chamados');
}

module.exports = { getDb: getClient, importCsv, getChamados, getStats, getChamadoById, clearDatabase };
