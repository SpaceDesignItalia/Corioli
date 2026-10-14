/**
 * Barra del titolo della finestra desktop su Windows. Quella nativa è nascosta
 * (`titleBarStyle: "hidden"` in electron/main.js): Electron disegna solo i
 * pulsanti riduci/ingrandisci/chiudi, sopra l'angolo destro di questa barra e
 * con lo stesso sfondo. Qui restano titolo e zona per trascinare la finestra
 * (doppio clic = ingrandisci).
 *
 * L'altezza è `--titlebar-h` (index.css), cioè `env(titlebar-area-height)`:
 * nel browser e su macOS vale 0 e la barra non occupa spazio.
 */
export default function WindowTitleBar() {
  return (
    <div className="app-titlebar" aria-hidden="true">
      {/* Spirale del logo (public/corioli-logo.svg) */}
      <svg viewBox="0 0 100 100" className="h-3.5 w-3.5 shrink-0">
        <g fill="none" stroke="#127c74" strokeWidth="9" strokeLinecap="round">
          <path d="M50 6A44 44 0 1 1 6.78 41.76" />
          <path d="M81.51 44.44A32 32 0 1 1 38.64 20.09" />
          <path d="M56.84 68.79A20 20 0 1 1 60.12 32.75" />
          <path d="M43.07 54A8 8 0 0 1 56.93 46" />
        </g>
      </svg>
      <span className="truncate text-xs font-medium text-slate-600">
        Corioli Ginecologia
      </span>
    </div>
  );
}
