import Tooltip from "./Tooltip";

export default function InfoIcon({ tip }) {
  return (
    <Tooltip text={tip}>
        <svg className="w-3.5 h-3.5 text-slate-400 hover:text-slate-600 cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth="2" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 16v-4m0-4h.01" />
        </svg>
    </Tooltip>
  );
}