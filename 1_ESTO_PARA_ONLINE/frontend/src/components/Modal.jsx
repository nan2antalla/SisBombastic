export default function Modal({ open, onClose, title, children, wide }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className={`relative bg-[#161616] border border-[#2a2a2a] sm:rounded-2xl shadow-2xl w-full
          ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}
          max-h-[92vh] sm:max-h-[90vh] overflow-y-auto
          rounded-t-2xl sm:rounded-2xl
          safe-bottom`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 sm:p-5 border-b border-[#2a2a2a] bg-[#161616]">
          <h2 className="text-base sm:text-lg font-semibold text-[#ffcc00] pr-2">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-[#ffcc00] text-2xl leading-none min-h-[44px] min-w-[44px] flex items-center justify-center"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
