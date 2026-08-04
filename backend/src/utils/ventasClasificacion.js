/**
 * Clasificación de ítems vendidos para métricas del dashboard.
 *
 * auto_caja   = auto individual que salió de una caja abierta (parent_id)
 * otro_item   = caja cerrada, accesorio, auto suelto, premio, etc.
 * manual      = sin inventario o sin costo registrado (no distorsiona ROI)
 */
export const SQL_CATEGORIA_VENTA = `
  CASE
    WHEN vi.inventario_id IS NULL THEN 'manual'
    WHEN COALESCE(vi.costo_unitario, 0) <= 0 AND COALESCE(i.costo_unitario, 0) <= 0 THEN 'manual'
    WHEN i.tipo_item = 'auto_individual' AND i.parent_id IS NOT NULL THEN 'auto_caja'
    ELSE 'otro_item'
  END
`;

export const SQL_JOIN_VENTA_ITEMS = `
  FROM venta_items vi
  JOIN ventas v ON v.id = vi.venta_id
  LEFT JOIN inventario i ON i.id = vi.inventario_id
  WHERE v.estado != 'cancelado'
`;
