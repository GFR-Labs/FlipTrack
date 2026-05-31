export default function StatusBadge({ status }) {
  const map = {
    'In Stock': 'badge-stock',
    'Listed': 'badge-listed',
    'Sold': 'badge-sold',
  }
  return <span className={map[status] || 'badge-stock'}>{status}</span>
}
