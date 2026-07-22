import { getOne, query } from '../db/database.js';
import { hashPassword, verifyPassword, createToken } from '../utils/auth.js';

export async function ensureAdminUser() {
  const existente = await getOne('SELECT id FROM usuarios WHERE usuario = $1', [
    process.env.ADMIN_USER || 'admin',
  ]);
  if (existente) return;

  const usuario = process.env.ADMIN_USER || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'bombastic2026';
  const { hash, salt } = hashPassword(password);

  await query(
    `INSERT INTO usuarios (usuario, password_hash, salt) VALUES ($1, $2, $3)`,
    [usuario, hash, salt]
  );
  console.log(`Usuario admin creado: ${usuario} (cambia ADMIN_PASSWORD en Render)`);
}

export async function login(usuario, password) {
  const user = await getOne(
    'SELECT * FROM usuarios WHERE usuario = $1 AND activo = TRUE',
    [usuario]
  );
  if (!user) {
    const err = new Error('Usuario o contraseña incorrectos');
    err.status = 401;
    throw err;
  }

  if (!verifyPassword(password, user.password_hash, user.salt)) {
    const err = new Error('Usuario o contraseña incorrectos');
    err.status = 401;
    throw err;
  }

  const token = createToken({ id: user.id, usuario: user.usuario });
  return { token, usuario: user.usuario };
}

export async function me(userId) {
  return getOne('SELECT id, usuario, created_at FROM usuarios WHERE id = $1 AND activo = TRUE', [userId]);
}
