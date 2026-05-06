import { useMemo } from "react";
import { parseURL, buildURL } from "../../Utilities";
import { useApp } from "../../Context";
import InfoIcon from "../ui/InfoIcon";
import FieldError from "../ui/FieldError";
import FieldWarning from "../ui/FieldWarning";

export default function BaseURLEditor({ value, onChange, providerKey, isDocker }) {
    const { validation } = useApp();
    const err = validation.errors.find(e => e.key === providerKey && e.field === 'baseURL');
    const warn = validation.warnings.find(w => w.key === providerKey && w.field === 'baseURL');
    const parts = useMemo(() => parseURL(value || ''), [value]);

    const update = (field, val) => {
        const next = { ...parts, [field]: field === 'port' ? (parseInt(val) || 0) : val };
        onChange(buildURL(next.protocol, next.host, next.port, next.path));
    };

    return (
    <div>
        <label className="block text-xs font-medium text-slate-600 mb-1.5">Base URL</label>
        <div className="flex items-center gap-1 flex-wrap">
            <select
                value={parts.protocol}
                onChange={e => update('protocol', e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
                <option value="http">http://</option>
                <option value="https">https://</option>
            </select>
            <input
                value={parts.host}
                onChange={e => update('host', e.target.value)}
                placeholder="localhost"
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-32"
            />
            <span className="text-slate-400 text-sm">:</span>
            <input
                type="number"
                value={parts.port}
                onChange={e => update('port', e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-20"
            />
            <input
                value={parts.path}
                onChange={e => update('path', e.target.value)}
                placeholder="/v1"
                className={`rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 flex-1 min-w-24 ${isDocker ? 'bg-indigo-50' : ''}`}
            />
            {isDocker && <InfoIcon tip="Docker Model Runner appends /engines/v1 to the base URL — this is pre-filled for you." />}
        </div>
        <p className="mt-1 font-mono text-xs text-slate-400 break-all">{value || 'http://localhost:8080/v1'}</p>
        {err && <FieldError msg={err.message} />}
        {warn && <FieldWarning msg={warn.message} onFix={warn.fix ? () => onChange(warn.fix.value) : undefined} />}
    </div>
    );
}