const express = require('express');
const path = require('path');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');
const { importCsv, clearDatabase, getChamados, getStats, getChamadoById } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const upload = multer({ storage: multer.memoryStorage() });

app.use(express.json());

const isNetlify = process.env.NETLIFY === 'true' || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
if (!isNetlify) {
  app.use(express.static(path.join(__dirname, 'public')));
}

app.get('/api/stats', async (req, res) => {
  try {
    const stats = await getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/chamados', async (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      modelo: req.query.modelo,
      loja: req.query.loja,
      search: req.query.search,
      limit: req.query.limit || 100,
      offset: req.query.offset || 0,
    };
    const chamados = await getChamados(filters);
    res.json(chamados);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/chamados/:id', async (req, res) => {
  try {
    const chamado = await getChamadoById(req.params.id);
    if (!chamado) return res.status(404).json({ error: 'Chamado não encontrado' });
    res.json(chamado);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado' });

    let records;
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (ext === '.csv') {
      const content = req.file.buffer.toString('latin1');
      records = parse(content, {
        delimiter: ';',
        columns: true,
        skip_empty_lines: true,
        relax_column_count: true,
        bom: true,
      });
    } else if (ext === '.xlsx' || ext === '.xls') {
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      records = jsonData;
    } else {
      return res.status(400).json({ error: 'Formato inválido. Use .csv ou .xlsx' });
    }

    await clearDatabase();
    const count = await importCsv(records);

    res.json({ success: true, count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (!isNetlify) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });
}

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Monitor de Chamados rodando em http://localhost:${PORT}`);
    console.log(`Para importar o CSV: node import.js`);
  });
}

module.exports = app;
