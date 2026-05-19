import { useEffect, useMemo, useState, type SVGProps } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardBody, Input, Spinner } from "@nextui-org/react";
import { Baby } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { PregnancyListRow } from "../../components/PregnancyListRow";
import {
  PatientService,
  VisitService,
} from "../../services/OfflineServices";
import {
  computeTrackedPregnancies,
  type ActivePregnancy,
} from "../../utils/activePregnancyUtils";

const SearchIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg
    aria-hidden="true"
    fill="none"
    focusable="false"
    height="1em"
    role="presentation"
    viewBox="0 0 24 24"
    width="1em"
    {...props}
  >
    <path
      d="M11.5 21C16.7467 21 21 16.7467 21 11.5C21 6.25329 16.7467 2 11.5 2C6.25329 2 2 6.25329 2 11.5C2 16.7467 6.25329 21 11.5 21Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
    <path
      d="M22 22L20 20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

export default function Gravidanze() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pregnancies, setPregnancies] = useState<ActivePregnancy[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [visits, patients] = await Promise.all([
          VisitService.getAllVisits(),
          PatientService.getAllPatients(),
        ]);
        setPregnancies(computeTrackedPregnancies(visits, patients));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filteredPregnancies = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return pregnancies;
    return pregnancies.filter((p) =>
      p.patientName.toLowerCase().includes(term),
    );
  }, [pregnancies, searchTerm]);

  const activeCount = pregnancies.filter((p) => p.status === "active").length;
  const deliveredCount = pregnancies.filter(
    (p) => p.status === "delivered",
  ).length;

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  return (
    <div className="corioli-page space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Gravidanze"
        subtitle={`${activeCount} in corso · ${deliveredCount} concluse`}
        icon={Baby}
        iconColor="success"
      />

      <Card className="corioli-card shadow-sm">
        <CardBody className="p-4 gap-4">
          <Input
            isClearable
            className="w-full sm:max-w-md"
            placeholder="Cerca paziente..."
            startContent={<SearchIcon className="text-default-300" />}
            value={searchTerm}
            onValueChange={setSearchTerm}
            onClear={() => setSearchTerm("")}
            variant="bordered"
          />

          {filteredPregnancies.length > 0 ? (
            <div className="rounded-lg border border-default-200 overflow-hidden">
              {filteredPregnancies.map((pregnancy) => (
                <PregnancyListRow
                  key={pregnancy.patientId}
                  pregnancy={pregnancy}
                  onClick={(patientId) =>
                    navigate(`/patient-history/${patientId}`)
                  }
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center px-6 py-12 text-center gap-2">
              <i
                className="ti ti-baby-carriage"
                style={{
                  fontSize: "32px",
                  color: "var(--color-text-tertiary)",
                }}
                aria-hidden
              />
              <p
                className="text-sm font-medium"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {searchTerm
                  ? "Nessuna paziente trovata"
                  : "Nessuna gravidanza registrata"}
              </p>
              <p
                className="text-xs max-w-[320px]"
                style={{ color: "var(--color-text-tertiary)" }}
              >
                Le pazienti con visite ostetriche e ultima mestruazione
                registrata appariranno qui, incluse quelle già partorate.
              </p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
