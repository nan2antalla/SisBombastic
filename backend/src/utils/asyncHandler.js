export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      res.status(err.status || 500).json({ error: err.message || 'Error interno' });
    });
  };
}
