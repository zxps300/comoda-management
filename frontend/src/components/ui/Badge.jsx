export default function Badge({ type = 'muted', children }) {
    return <span className={`badge badge-${type}`}>{children}</span>
}

export function StatusBadge({ status }) {
    const map = {
        Pending: 'warning',
        Preparing: 'info',
        Ready: 'success',
        Completed: 'success',
        Cancelled: 'muted',
        Active: 'success',
        Inactive: 'muted',
        Low: 'warning',
        Out: 'danger',
        OK: 'success',
        Admin: 'primary',
        Cashier: 'info',
        Purchaser: 'warning',
        'Kitchen Staff': 'success',
        Waiter: 'muted',
    }
    return <Badge type={map[status] || 'muted'}>{status}</Badge>
}
