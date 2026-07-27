import { formatMoney, formatPercent, moneyClass, moneyTone } from '../api/client';

/**
 * Monto con color automático: verde si > 0, rojo si < 0.
 * Ideal para utilidades, márgenes, saldos y patrimonio.
 */
export default function Money({ value, signed = false, percent = false, className = '' }) {
  const cls = moneyClass(value);
  const text = percent
    ? formatPercent(value, { signed })
    : formatMoney(value, { signed });

  return (
    <span className={`${cls} ${className}`.trim()} data-tone={moneyTone(value)}>
      {text}
    </span>
  );
}
