-- Bombastic Dreamers - Esquema PostgreSQL (Render)

CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  usuario TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS proveedores (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  contacto TEXT,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS compras (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  proveedor_id INTEGER REFERENCES proveedores(id),
  proveedor_nombre TEXT,
  tipo_compra TEXT NOT NULL CHECK (tipo_compra IN (
    'mainline', 'premium', 'rlc', 'protector', 'sticker', 'tarjeta', 'accesorio', 'otro'
  )),
  descripcion TEXT NOT NULL,
  cantidad NUMERIC NOT NULL DEFAULT 1,
  costo_producto NUMERIC NOT NULL DEFAULT 0,
  transporte NUMERIC NOT NULL DEFAULT 0,
  impuestos NUMERIC NOT NULL DEFAULT 0,
  otros_gastos NUMERIC NOT NULL DEFAULT 0,
  costo_total NUMERIC NOT NULL DEFAULT 0,
  costo_unitario NUMERIC NOT NULL DEFAULT 0,
  es_caja BOOLEAN DEFAULT TRUE,
  estado TEXT NOT NULL DEFAULT 'en_camino' CHECK (estado IN (
    'en_camino', 'recibido', 'vendido_parcialmente', 'cerrado'
  )),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventario (
  id SERIAL PRIMARY KEY,
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
  cantidad NUMERIC NOT NULL DEFAULT 1,
  costo_unitario NUMERIC NOT NULL DEFAULT 0,
  precio_sugerido NUMERIC,
  estado TEXT NOT NULL DEFAULT 'disponible' CHECK (estado IN (
    'disponible', 'reservado', 'vendido', 'premio', 'danado'
  )),
  ubicacion TEXT,
  fecha_ingreso DATE NOT NULL,
  proveedor_id INTEGER REFERENCES proveedores(id),
  proveedor_nombre TEXT,
  compra_id INTEGER REFERENCES compras(id),
  parent_id INTEGER REFERENCES inventario(id),
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  whatsapp TEXT,
  ciudad TEXT,
  total_comprado NUMERIC DEFAULT 0,
  cantidad_compras INTEGER DEFAULT 0,
  ultima_compra DATE,
  notas TEXT,
  preferencias TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ventas (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  cliente_id INTEGER REFERENCES clientes(id),
  cliente_nombre TEXT,
  metodo_pago TEXT NOT NULL DEFAULT 'efectivo' CHECK (metodo_pago IN (
    'qr', 'efectivo', 'transferencia', 'tiktok'
  )),
  canal TEXT NOT NULL DEFAULT 'presencial' CHECK (canal IN (
    'live', 'whatsapp', 'presencial', 'pedido_externo'
  )),
  delivery NUMERIC NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pagado' CHECK (estado IN (
    'pendiente', 'pagado', 'entregado', 'cancelado'
  )),
  total_venta NUMERIC NOT NULL DEFAULT 0,
  total_costo NUMERIC NOT NULL DEFAULT 0,
  utilidad_bruta NUMERIC NOT NULL DEFAULT 0,
  live_id INTEGER,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venta_items (
  id SERIAL PRIMARY KEY,
  venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  inventario_id INTEGER REFERENCES inventario(id),
  producto_nombre TEXT NOT NULL,
  cantidad NUMERIC NOT NULL DEFAULT 1,
  precio_venta NUMERIC NOT NULL,
  costo_unitario NUMERIC NOT NULL DEFAULT 0,
  utilidad NUMERIC NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS gastos (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN (
    'transporte', 'publicidad', 'materiales', 'internet', 'comida',
    'premios', 'sueldos', 'herramientas', 'alquiler', 'otros'
  )),
  descripcion TEXT NOT NULL,
  monto NUMERIC NOT NULL,
  metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
  relacion_tipo TEXT DEFAULT 'general' CHECK (relacion_tipo IN ('live', 'compra', 'general')),
  relacion_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caja_movimientos (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'entrada_venta', 'salida_compra', 'salida_gasto', 'retiro_personal', 'inversion', 'ajuste'
  )),
  monto NUMERIC NOT NULL,
  descripcion TEXT,
  referencia_tipo TEXT,
  referencia_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS caja_cierres (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL UNIQUE,
  saldo_inicial NUMERIC NOT NULL DEFAULT 0,
  entradas NUMERIC NOT NULL DEFAULT 0,
  salidas NUMERIC NOT NULL DEFAULT 0,
  saldo_final NUMERIC NOT NULL DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lives (
  id SERIAL PRIMARY KEY,
  fecha DATE NOT NULL,
  hora_inicio TEXT,
  hora_fin TEXT,
  autos_vendidos INTEGER DEFAULT 0,
  ventas_totales NUMERIC DEFAULT 0,
  costo_productos NUMERIC DEFAULT 0,
  premios_entregados INTEGER DEFAULT 0,
  costo_premios NUMERIC DEFAULT 0,
  gastos_live NUMERIC DEFAULT 0,
  utilidad_neta NUMERIC DEFAULT 0,
  observaciones TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS empleados (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  cargo TEXT,
  sueldo NUMERIC DEFAULT 0,
  comision NUMERIC DEFAULT 0,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_compras_fecha ON compras(fecha);
CREATE INDEX IF NOT EXISTS idx_inventario_estado ON inventario(estado);
CREATE INDEX IF NOT EXISTS idx_inventario_categoria ON inventario(categoria);
CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha);
CREATE INDEX IF NOT EXISTS idx_gastos_fecha ON gastos(fecha);
CREATE INDEX IF NOT EXISTS idx_caja_fecha ON caja_movimientos(fecha);
