import { Router } from 'express';
import * as clientesService from '../services/clientes.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.get('/', asyncHandler(async (req, res) => {
  res.json(await clientesService.listarClientes());
}));

router.post('/', asyncHandler(async (req, res) => {
  const cliente = await clientesService.crearCliente(req.body);
  res.status(201).json(cliente);
}));

export default router;
