import { getOne, getAll, query } from '../db/database.js';

export async function listarClientes() {
  return getAll('SELECT * FROM clientes ORDER BY nombre ASC');
}

export async function crearCliente(data) {
  const nombre = String(data.nombre || '').trim();
  if (!nombre) throw new Error('El nombre del cliente es obligatorio');

  const existente = await getOne(
    'SELECT * FROM clientes WHERE LOWER(nombre) = LOWER($1)',
    [nombre]
  );
  if (existente) return existente;

  const res = await query(
    `INSERT INTO clientes (nombre, whatsapp, ciudad, notas, preferencias)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [
      nombre,
      data.whatsapp || null,
      data.ciudad || null,
      data.notas || null,
      data.preferencias || null,
    ]
  );
  return getOne('SELECT * FROM clientes WHERE id = $1', [res.rows[0].id]);
}

export async function obtenerOCrearPorNombre(nombre, extras = {}) {
  const n = String(nombre || '').trim();
  if (!n) return null;
  return crearCliente({ nombre: n, ...extras });
}
