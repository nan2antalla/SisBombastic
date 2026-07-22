export default function Badge({ label, colorClass }) {
  return <span className={`badge ${colorClass}`}>{label}</span>;
}
