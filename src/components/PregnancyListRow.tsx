import { ArrowRight } from "lucide-react";
import type { ActivePregnancy } from "../utils/activePregnancyUtils";

const PREGNANCY_TOTAL_WEEKS = 40;

function isPregnancySegmentCompleted(
  segmentIndex: number,
  weeks: number,
  days: number,
): boolean {
  if (weeks >= PREGNANCY_TOTAL_WEEKS) return true;
  return segmentIndex < weeks || (segmentIndex === weeks && days > 0);
}

function PregnancyWeekSegments({
  weeks,
  days,
}: {
  weeks: number;
  days: number;
}) {
  return (
    <div className="dashboard-pregnancy-segments" aria-hidden>
      {Array.from({ length: PREGNANCY_TOTAL_WEEKS }, (_, i) => (
        <span
          key={i}
          className={`dashboard-pregnancy-segment${
            isPregnancySegmentCompleted(i, weeks, days)
              ? " dashboard-pregnancy-segment--done"
              : ""
          }`}
        />
      ))}
    </div>
  );
}

function PregnancyStatusText({ pregnancy }: { pregnancy: ActivePregnancy }) {
  if (pregnancy.status === "delivered") {
    const days = pregnancy.daysSinceBirth ?? 0;
    const label = days === 1 ? "giorno fa" : "giorni fa";
    return (
      <span style={{ color: "var(--color-text-secondary)" }}>
        Partorita · {days} {label}
      </span>
    );
  }

  const label =
    pregnancy.daysToBirth === 1 ? "giorno al parto" : "giorni al parto";

  if (pregnancy.daysToBirth <= 14) {
    const color = pregnancy.daysToBirth <= 7 ? "#A32D2D" : "#854F0B";
    return (
      <span style={{ color, fontWeight: 500 }}>
        ⚠ {pregnancy.daysToBirth} {label}
      </span>
    );
  }

  return (
    <span>
      {pregnancy.daysToBirth} {label}
    </span>
  );
}

interface PregnancyListRowProps {
  pregnancy: ActivePregnancy;
  onClick: (patientId: string) => void;
}

export function PregnancyListRow({ pregnancy, onClick }: PregnancyListRowProps) {
  const urgencyClass =
    pregnancy.status === "active"
      ? pregnancy.daysToBirth <= 7
        ? "dashboard-pregnancy-row--urgent-red"
        : pregnancy.daysToBirth <= 14
          ? "dashboard-pregnancy-row--urgent-amber"
          : ""
      : "dashboard-pregnancy-row--delivered";

  return (
    <div
      className={`dashboard-pregnancy-row group ${urgencyClass}`}
      onClick={() => onClick(pregnancy.patientId)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onClick(pregnancy.patientId);
        }
      }}
    >
      <div className="flex items-center gap-2.5">
        <div className="dashboard-pregnancy-avatar">{pregnancy.initials}</div>
        <p
          className="flex-1 min-w-0 truncate group-hover:text-brand-600 transition-colors"
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "var(--color-text-primary)",
          }}
        >
          {pregnancy.patientName}
        </p>
        <span className="dashboard-pregnancy-badge">
          {pregnancy.status === "delivered" ? "Partorita" : pregnancy.gestationLabel}
        </span>
        <ArrowRight
          size={14}
          className="text-gray-300 group-hover:text-brand-600 transition-colors shrink-0"
        />
      </div>
      <div className="dashboard-pregnancy-timeline ml-[42px]">
        <PregnancyWeekSegments weeks={pregnancy.weeks} days={pregnancy.days} />
        <p className="dashboard-pregnancy-meta truncate">
          {pregnancy.status === "delivered" ? (
            <>
              Gravidanza conclusa · DPP: {pregnancy.dppLabel} ·{" "}
              <PregnancyStatusText pregnancy={pregnancy} />
            </>
          ) : (
            <>
              Settimana {pregnancy.gestationLabel} · DPP: {pregnancy.dppLabel} ·{" "}
              <PregnancyStatusText pregnancy={pregnancy} />
            </>
          )}
        </p>
      </div>
    </div>
  );
}
