import { useApp } from "../Context";
import ProviderCard from "./provider/ProviderCard";

export default function ProviderList({ providers }) {
    const { dispatch } = useApp();

    const handleDrop = (e, toIndex) => {
        e.preventDefault();
        const fromIndex = parseInt(e.dataTransfer.getData('provider'));
        if (isNaN(fromIndex) || fromIndex === toIndex)
            return;
        const reordered = [...providers];
        const [moved] = reordered.splice(fromIndex, 1);
        reordered.splice(toIndex, 0, moved);
        dispatch({ type: 'REORDER_PROVIDERS', payload: reordered });
    };

    return (
    <div className="space-y-4">
        {providers.map((p, i) => (
        <div
            key={p._key}
            onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('provider-drag-over'); e.currentTarget.style.borderRadius = '12px'; }}
            onDragLeave={e => { e.currentTarget.classList.remove('provider-drag-over'); e.currentTarget.style.borderRadius = ''; }}
            onDrop={e => { e.currentTarget.classList.remove('provider-drag-over'); handleDrop(e, i); }}
        >
            <ProviderCard provider={p} index={i} />
        </div>
        ))}
    </div>
    );
}