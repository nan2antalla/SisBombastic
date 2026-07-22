import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import './db/database.js';

import comprasRoutes from './routes/compras.routes.js';
import inventarioRoutes from './routes/inventario.routes.js';
import ventasRoutes from './routes/ventas.routes.js';
import gastosRoutes from './routes/gastos.routes.js';
import cajaRoutes from './routes/caja.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import backupRoutes from './routes/backup.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/compras', comprasRoutes);
app.use('/api/inventario', inventarioRoutes);
app.use('/api/ventas', ventasRoutes);
app.use('/api/gastos', gastosRoutes);
app.use('/api/caja', cajaRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/backup', backupRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', nombre: 'Bombastic Dreamers' });
});

const frontendDist = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDist));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Ruta no encontrada' });
  }
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) res.status(404).send('Frontend no compilado. Ejecuta: npm run dev');
  });
});

const server = app.listen(PORT, () => {
  console.log(`\n  Bombastic Dreamers - Sistema local`);
  console.log(`  API: http://localhost:${PORT}/api`);
  console.log(`  App: http://localhost:${PORT}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ERROR: El puerto ${PORT} ya está en uso.`);
    console.error(`  Cierra la otra instancia o ejecuta: npm run stop\n`);
    process.exit(1);
  }
  throw err;
});
