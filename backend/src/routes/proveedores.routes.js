import { Router } from 'express';
import * as proveedoresService from '../services/proveedores.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json(await proveedoresService.listarProveedores());
}));

router.post('/', asyncHandler(async (req, res) => {
  const proveedor = await proveedoresService.crearProveedor(req.body);
  res.status(201).json(proveedor);
}));

export default router;
