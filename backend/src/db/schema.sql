-- Bombastic Dreamers - Esquema SQLite

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS proveedores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  contacto TEXT,
  notas TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS compras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  proveedor_id INTEGER,
  proveedor_nombre TEXT,
  tipo_compra TEXT NOT NULL CHECK (tipo_compra IN (
    'mainline', 'premium', 'rlc', 'protector', 'sticker', 'tarjeta', 'accesorio', 'otro'
  )),
  descripcion TEXT NOT NULL,
  cantidad REAL NOT NULL DEFAULT 1,
  costo_producto REAL NOT NULL DEFAULT 0,
  transporte REAL NOT NULL DEFAULT 0,
  impuestos REAL NOT NULL DEFAULT 0,
  otros_gastos REAL NOT NULL DEFAULT 0,
  costo_total REAL NOT NULL DEFAULT 0,
  costo_unitario REAL NOT NULL DEFAULT 0,
  es_caja INTEGER DEFAULT 1,
  estado TEXT NOT NULL DEFAULT 'en_camino' CHECK (estado IN (
    'en_camino', 'recibido', 'vendido_parcialmente', 'cerrado'
  )),
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (proveedor_id) REFERENCES proveedores(id)
);

CREATE TABLE IF NOT EXISTS inventario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo_interno TEXT UNIQUE,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN (
    'mainline', 'premium', 'rlc', 'protector', 'sticker', 'tarjeta', 'accesorio', 'otro'
  )),
  tipo_item TEXT NOT NULL DEFAULT 'auto_individual' CHECK (tipo_item IN (
    'caja_cerrada', 'auto_individual', 'accesorio', 'premio'
  )),
  serie TEXT,
  anio INTEGER,
  case_code TEXT,
  cantidad REAL NOT NULL DEFAULT 1,
  costo_unitario REAL NOT NULL DEFAULT 0,
  precio_sugerido REAL,
  estado TEXT NOT NULL DEFAULT 'disponible' CHECK (estado IN (
    'disponible', 'reservado', 'vendido', 'premio', 'danado'
  )),
  ubicacion TEXT,
  fecha_ingreso TEXT NOT NULL,
  proveedor_id INTEGER,
  proveedor_nombre TEXT,
  compra_id INTEGER,
  parent_id INTEGER,
  notas TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (proveedor_id) REFERENCES proveedores(id),
  FOREIGN KEY (compra_id) REFERENCES compras(id),
  FOREIGN KEY (parent_id) REFERENCES inventario(id)
);

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  whatsapp TEXT,
  ciudad TEXT,
  total_comprado REAL DEFAULT 0,
  cantidad_compras INTEGER DEFAULT 0,
  ultima_compra TEXT,
  notas TEXT,
  preferencias TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  cliente_id INTEGER,
  cliente_nombre TEXT,
  metodo_pago TEXT NOT NULL DEFAULT 'efectivo' CHECK (metodo_pago IN (
    'qr', 'efectivo', 'transferencia', 'tiktok'
  )),
  canal TEXT NOT NULL DEFAULT 'presencial' CHECK (canal IN (
    'live', 'whatsapp', 'presencial', 'pedido_externo'
  )),
  delivery REAL NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pagado' CHECK (estado IN (
    'pendiente', 'pagado', 'entregado', 'cancelado'
  )),
  total_venta REAL NOT NULL DEFAULT 0,
  total_costo REAL NOT NULL DEFAULT 0,
  utilidad_bruta REAL NOT NULL DEFAULT 0,
  live_id INTEGER,
  notas TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (cliente_id) REFERENCES clientes(id)
);

CREATE TABLE IF NOT EXISTS venta_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER NOT NULL,
  inventario_id INTEGER,
  producto_nombre TEXT NOT NULL,
  cantidad REAL NOT NULL DEFAULT 1,
  precio_venta REAL NOT NULL,
  costo_unitario REAL NOT NULL DEFAULT 0,
  utilidad REAL NOT NULL DEFAULT 0,
  FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
  FOREIGN KEY (inventario_id) REFERENCES inventario(id)
);

CREATE TABLE IF NOT EXISTS gastos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN (
    'transporte', 'publicidad', 'materiales', 'internet', 'comida',
    'premios', 'sueldos', 'herramientas', 'alquiler', 'otros'
  )),
  descripcion TEXT NOT NULL,
  monto REAL NOT NULL,
  metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
  relacion_tipo TEXT DEFAULT 'general' CHECK (relacion_tipo IN ('live', 'compra', 'general')),
  relacion_id INTEGER,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS caja_movimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'entrada_venta', 'salida_compra', 'salida_gasto', 'retiro_personal', 'inversion', 'ajuste'
  )),
  monto REAL NOT NULL,
  descripcion TEXT,
  referencia_tipo TEXT,
  referencia_id INTEGER,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS caja_cierres (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL UNIQUE,
  saldo_inicial REAL NOT NULL DEFAULT 0,
  entradas REAL NOT NULL DEFAULT 0,
  salidas REAL NOT NULL DEFAULT 0,
  saldo_final REAL NOT NULL DEFAULT 0,
  notas TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS lives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL,
  hora_inicio TEXT,
  hora_fin TEXT,
  autos_vendidos INTEGER DEFAULT 0,
  ventas_totales REAL DEFAULT 0,
  costo_productos REAL DEFAULT 0,
  premios_entregados INTEGER DEFAULT 0,
  costo_premios REAL DEFAULT 0,
  gastos_live REAL DEFAULT 0,
  utilidad_neta REAL DEFAULT 0,
  observaciones TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS empleados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  cargo TEXT,
  sueldo REAL DEFAULT 0,
  comision REAL DEFAULT 0,
  activo INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras(fecha);
CREATE INDEX IF NOT EXISTS idx_inventario_estado ON inventario(estado);
CREATE INDEX IF NOT EXISTS idx_inventario_categoria ON inventario(categoria);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha);
CREATE INDEX IF NOT EXISTS idx_caja_fecha ON caja_movimientos(fecha);
