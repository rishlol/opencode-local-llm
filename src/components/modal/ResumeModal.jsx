import Modal from "../Modal";

export default function ResumeModal({ onResume, onFresh }) {
    return (
    <Modal title="Resume previous session?" onClose={onFresh}>
        <p className="text-sm text-slate-600 mb-6">You have a saved config from a previous session. Would you like to continue where you left off?</p>
        <div className="flex gap-3 justify-end">
            <button onClick={onFresh} className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50">Start fresh</button>
            <button onClick={onResume} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Resume session</button>
        </div>
    </Modal>
    );
}