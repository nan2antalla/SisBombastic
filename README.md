# Bombastic Dreamers — Sistema de Administración Local

Sistema local para administrar tu negocio de venta de Hot Wheels. Funciona sin internet en tu propia máquina.

## Requisitos

- [Node.js](https://nodejs.org/) 18 o superior

## Instalación

```bash
# Desde la carpeta del proyecto
npm run install:all
```

## Uso diario

```bash
npm run dev
```

Esto inicia:
- **Backend API:** http://localhost:3001
- **Frontend:** http://localhost:5173

Abre http://localhost:5173 en tu navegador.

## Módulos incluidos (MVP)

| Módulo | Funcionalidad |
|--------|---------------|
| **Dashboard** | Ventas, utilidades, caja, inventario, top productos |
| **Compras** | Registro con costos automáticos, estados, ingreso a inventario |
| **Inventario** | Stock, búsqueda, abrir cajas cerradas |
| **Ventas** | Descuento automático de stock, utilidad calculada |
| **Gastos** | Categorías, impacto en caja |
| **Caja** | Saldo, movimientos, cierre diario, retiros e inversiones |

## Base de datos

La base SQLite se guarda en `backend/data/bombastic.db`.

### Backup

Desde la app: botón **Backup BD** en el menú lateral, o visita:
```
http://localhost:3001/api/backup/backup
```

### Exportar CSV

```
http://localhost:3001/api/backup/export/ventas
http://localhost:3001/api/backup/export/inventario
http://localhost:3001/api/backup/export/compras
http://localhost:3001/api/backup/export/gastos
```

## Flujo recomendado

1. **Registrar compra** → estado "En camino"
2. Cuando llega → clic en **Recibir** → entra al inventario automáticamente
3. Si es caja mainline → **Abrir caja** en inventario para crear autos individuales
4. **Registrar venta** seleccionando producto del inventario → descuenta stock y suma a caja
5. **Registrar gastos** → descuenta de caja
6. Al final del día → **Cerrar caja** en el módulo Caja

## Reglas de cálculo

- Costo total = costo producto + transporte + impuestos + otros
- Costo unitario = costo total / cantidad
- Utilidad bruta = venta - costo del producto
- Utilidad neta = ventas - costos - gastos
- Margen = utilidad / venta × 100

## Producción (una sola app)

```bash
npm run build
npm start
```

Abre http://localhost:3001 (sirve frontend + API juntos).

## Próximas fases

- Lives de TikTok
- Clientes
- Empleados
- Reportes avanzados

## Estructura del proyecto

```
SisBombastic/
├── backend/
│   ├── src/
│   │   ├── db/          # SQLite + esquema
│   │   ├── routes/      # Endpoints API
│   │   ├── services/    # Lógica de negocio
│   │   └── utils/       # Cálculos
│   └── data/            # Base de datos local
└── frontend/
    └── src/
        ├── pages/       # Pantallas
        ├── components/  # UI reutilizable
        └── api/         # Cliente HTTP
```
