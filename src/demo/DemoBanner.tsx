import { IS_DEMO } from "./index";

/**
 * Striscia in cima alla pagina (non fissa, così non copre mai le barre
 * dell'app): dice che è una demo e permette di ripartire da zero.
 */
export default function DemoBanner() {
  if (!IS_DEMO) return null;
  return (
    <div
      role="status"
      className="relative z-[60] flex items-center justify-center gap-3 bg-slate-900 px-3 py-1.5 text-xs text-white sm:text-sm"
    >
      <span>
        <strong className="font-semibold">Demo</strong>
        <span className="sm:hidden"> · dati non salvati</span>
        <span className="hidden sm:inline"> · dati di prova, non vengono salvati</span>
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-full bg-white px-3 py-0.5 text-xs font-medium text-slate-900 hover:bg-slate-200 sm:text-sm"
      >
        Ricomincia
      </button>
    </div>
  );
}
