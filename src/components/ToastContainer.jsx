export default function ToastContainer({ toasts }) {
    if (toasts.length === 0)
        return null;
    return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end">
        {toasts.map(t => (
        <div key={t.id} className={`slide-up flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg text-white max-w-xs ${t.type === 'error' ? 'bg-red-600' : t.type === 'warning' ? 'bg-amber-600' : 'bg-slate-800'}`}>
            <span className="flex-1">{t.message}</span>
            {t.onUndo && (
            <button onClick={t.onUndo} className="text-xs underline opacity-80 hover:opacity-100 flex-shrink-0">Undo</button>
            )}
        </div>
        ))}
    </div>
    );
}