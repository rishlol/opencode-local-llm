export default function Toggle({ checked, onChange, label }) {
  return (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`toggle-track relative inline-flex h-5 w-9 items-center rounded-full border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}
    >
        <span className={`toggle-thumb inline-block h-3.5 w-3.5 rounded-full bg-white shadow ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    </button>
  );
}