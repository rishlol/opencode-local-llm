export default function Badge({ type, children }) {
    const styles = {
        error: 'bg-red-50 text-red-700 border-red-200',
        warning: 'bg-amber-50 text-amber-700 border-amber-200',
        info: 'bg-blue-50 text-blue-700 border-blue-200',
    };
    return (
    <span className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs font-medium ${styles[type]}`}>
        {children}
    </span>
    );
}