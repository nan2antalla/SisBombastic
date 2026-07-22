import 'dotenv/config';
import { initDb } from './db/database.js';

await initDb();
console.log('Base de datos inicializada correctamente');
