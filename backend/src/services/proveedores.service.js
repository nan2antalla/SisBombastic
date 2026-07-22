import { getOne, getAll, query } from '../db/database.js';

export async function listarProveedores() {
  return getAll('SELECT * FROM proveedores ORDER BY nombre ASC');
}

export async function crearProveedor(data) {
  const nombre = String(data.nombre || '').trim();
  if (!nombre) throw new Error('El nombre del proveedor es obligatorio');

  const existente = await getOne(
    'SELECT * FROM proveedores WHERE LOWER(nombre) = LOWER($1)',
    [nombre]
  );
  if (existente) return existente;

  const res = await query(
    `INSERT INTO proveedores (nombre, contacto, notas) VALUES ($1, $2, $3) RETURNING id`,
    [nombre, data.contacto || null, data.notas || null]
  );
  return getOne('SELECT * FROM proveedores WHERE id = $1', [res.rows[0].id]);
}

export async function obtenerOCrearPorNombre(nombre) {
  const n = String(nombre || '').trim();
  if (!n) return null;
  return crearProveedor({ nombre: n });
}
