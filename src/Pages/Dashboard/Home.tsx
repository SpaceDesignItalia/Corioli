import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Chip,
  Spinner,
  Avatar,
} from "@nextui-org/react";
import {
  UserPlus,
  Users,
  FileText,
  ChevronRight,
  Activity,
  Calendar,
  LayoutDashboard,
  TrendingUp,
  HeartPulse,
  Baby,
  Stethoscope,
  Clock,
  ArrowRight,
} from "lucide-react";
import {
  DoctorService,
  PatientService,
  VisitService,
} from "../../services/OfflineServices";
import { Patient, Visit } from "../../types/Storage";
import {
  computeActivePregnancies,
  type ActivePregnancy,
} from "../../utils/activePregnancyUtils";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { PageHeader } from "../../components/PageHeader";
import { CodiceFiscaleValue } from "../../components/CodiceFiscaleValue";
import { PregnancyListRow } from "../../components/PregnancyListRow";
import { useCheckPatientModal } from "../../contexts/CheckPatientModalContext";

interface GroupedRecentVisit {
  patientId: string;
  patientName: string;
  dateKey: string;
  dateLabel: string;
  count: number;
  tipo?: Visit["tipo"];
  mixedTypes: boolean;
}

interface DashboardStats {
  totalPatients: number;
  totalVisits: number;
  recentPatients: Patient[];
  groupedRecentVisits: GroupedRecentVisit[];
  activePregnancies: ActivePregnancy[];
  averageAge: number;
  visitsThisMonth: number;
  patientsThisMonth: number;
  subtitle: string;
}

const getGreetingMessage = () => {
  const currentHour = new Date().getHours();
  if (currentHour < 12 && currentHour >= 6) return "Buongiorno";
  if (currentHour < 18 && currentHour >= 12) return "Buon pomeriggio";
  if (currentHour < 20 && currentHour >= 18) return "Buona sera";
  return "Buona notte";
};

const calculateAge = (birthDateString: string): number => {
  if (!birthDateString) return 0;
  let birthDate = new Date(birthDateString);
  if (isNaN(birthDate.getTime())) {
    const parts = birthDateString.split(/[-/]/);
    if (parts.length === 3 && parseInt(parts[2]) > 1900) {
      birthDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
  }
  if (isNaN(birthDate.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
  return Math.max(0, age);
};

const getVisitTypeLabel = (tipo?: Visit["tipo"]) => {
  if (tipo === "ginecologica") return "Ginecologica";
  if (tipo === "ostetrica") return "Ostetrica";
  return "Generale";
};

const getVisitTypeColor = (
  tipo?: Visit["tipo"],
): "danger" | "warning" | "primary" => {
  if (tipo === "ginecologica") return "danger";
  if (tipo === "ostetrica") return "warning";
  return "primary";
};

const getVisitDateKey = (dataVisita: string): string => {
  const d = new Date(dataVisita);
  if (isNaN(d.getTime())) return dataVisita.slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const getVisitTypePluralPhrase = (
  tipo: Visit["tipo"] | undefined,
  count: number,
): string => {
  if (count <= 1) return getVisitTypeLabel(tipo);
  if (tipo === "ginecologica") return `${count} visite ginecologiche`;
  if (tipo === "ostetrica") return `${count} visite ostetriche`;
  return `${count} visite`;
};

const formatPatientDisplayName = (patient: Patient): string | null => {
  const name = `${patient.nome ?? ""} ${patient.cognome ?? ""}`.trim();
  return name || null;
};

const groupRecentVisits = (
  visits: (Visit & { patientName: string })[],
  maxItems = 5,
): GroupedRecentVisit[] => {
  const groups = new Map<string, GroupedRecentVisit>();

  for (const visit of visits) {
    const dateKey = getVisitDateKey(visit.dataVisita);
    const key = `${visit.patientId}_${dateKey}`;
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, {
        patientId: visit.patientId,
        patientName: visit.patientName,
        dateKey,
        dateLabel: new Date(visit.dataVisita).toLocaleDateString("it-IT"),
        count: 1,
        tipo: visit.tipo,
        mixedTypes: false,
      });
      continue;
    }

    existing.count += 1;
    if (existing.tipo !== visit.tipo) {
      existing.mixedTypes = true;
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => b.dateKey.localeCompare(a.dateKey))
    .slice(0, maxItems);
};

const buildDashboardSubtitle = (
  visits: (Visit & { patientName: string })[],
): string => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const visitsToday = visits.filter((v) => {
    const d = new Date(v.dataVisita);
    if (isNaN(d.getTime())) return false;
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  });

  if (visitsToday.length > 0) {
    const n = visitsToday.length;
    return n === 1
      ? "Hai 1 visita programmata oggi"
      : `Hai ${n} visite programmate oggi`;
  }

  const todayKey = today.toISOString().slice(0, 10);
  let isFirstOpenToday = false;
  try {
    const lastOpen = localStorage.getItem("corioli_home_last_open");
    isFirstOpenToday = lastOpen !== todayKey;
    if (isFirstOpenToday) {
      localStorage.setItem("corioli_home_last_open", todayKey);
    }
  } catch {
    /* ignore */
  }

  if (isFirstOpenToday && visits.length > 0) {
    const last = visits[0];
    const visitDate = new Date(last.dataVisita);
    visitDate.setHours(0, 0, 0, 0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const when =
      visitDate.getTime() === yesterday.getTime()
        ? "ieri"
        : visitDate.toLocaleDateString("it-IT", {
            day: "numeric",
            month: "long",
          });
    return `Ultima visita: ${when} con ${last.patientName}`;
  }

  return "Ecco il riepilogo della tua attività";
};

export default function Home() {
  const navigate = useNavigate();
  const { openCheckPatientModal } = useCheckPatientModal();
  const [doctorName, setDoctorName] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    totalVisits: 0,
    recentPatients: [],
    groupedRecentVisits: [],
    activePregnancies: [],
    averageAge: 0,
    visitsThisMonth: 0,
    patientsThisMonth: 0,
    subtitle: "Ecco il riepilogo della tua attività",
  });
  const [loading, setLoading] = useState(true);

  const [toast, setToast] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });

  useEffect(() => {
    const msg = sessionStorage.getItem("appdottori_toast");
    if (msg) {
      setToast({ open: true, message: msg });
      sessionStorage.removeItem("appdottori_toast");
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const patientsPromise = PatientService.getAllPatients();
        const [doctor, patients, visits] = await Promise.all([
          DoctorService.initializeDefaultDoctor(),
          patientsPromise,
          VisitService.getAllVisits(),
        ]);

        setDoctorName(`${doctor.nome} ${doctor.cognome}`);

        const now = new Date();
        const thisMonthStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          1,
        ).toISOString();

        const visitsThisMonth = visits.filter(
          (v) => v.dataVisita >= thisMonthStart,
        ).length;
        const patientsThisMonth = patients.filter(
          (p) => p.createdAt >= thisMonthStart,
        ).length;

        const visitDatesByPatient = new Map<string, number>();
        for (const v of visits) {
          const t = new Date(v.dataVisita).getTime();
          const prev = visitDatesByPatient.get(v.patientId);
          if (prev == null || t > prev) visitDatesByPatient.set(v.patientId, t);
        }
        const sortedPatients = [...patients]
          .sort((a, b) => {
            const lastA = Math.max(
              new Date(a.createdAt).getTime(),
              new Date(a.updatedAt).getTime(),
              visitDatesByPatient.get(a.id) ?? 0,
            );
            const lastB = Math.max(
              new Date(b.createdAt).getTime(),
              new Date(b.updatedAt).getTime(),
              visitDatesByPatient.get(b.id) ?? 0,
            );
            return lastB - lastA;
          })
          .slice(0, 6);

        const patientMap = new Map(patients.map((p) => [p.id, p]));
        const enrichedVisits = visits.map((v) => {
          const p = patientMap.get(v.patientId);
          return {
            ...v,
            patientName: p
              ? formatPatientDisplayName(p) ?? "Paziente senza nome"
              : "Paziente sconosciuto",
            patientCf: p?.codiceFiscale || "",
          };
        });
        const sortedVisits = enrichedVisits.sort(
          (a, b) =>
            new Date(b.dataVisita).getTime() - new Date(a.dataVisita).getTime(),
        );
        const groupedRecentVisits = groupRecentVisits(sortedVisits, 5);
        const subtitle = buildDashboardSubtitle(sortedVisits);
        const activePregnancies = computeActivePregnancies(visits, patients);

        let validAgesCount = 0;
        const totalAge = patients.reduce((sum, p) => {
          const age = calculateAge(p.dataNascita);
          if (age > 0) {
            validAgesCount++;
            return sum + age;
          }
          return sum;
        }, 0);
        const averageAge =
          validAgesCount > 0 ? Math.round(totalAge / validAgesCount) : 0;

        setStats({
          totalPatients: patients.length,
          totalVisits: visits.length,
          recentPatients: sortedPatients,
          groupedRecentVisits,
          activePregnancies,
          averageAge,
          visitsThisMonth,
          patientsThisMonth,
          subtitle,
        });
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  const { activePregnancies } = stats;
  const visiblePregnancies = [...activePregnancies]
    .sort((a, b) => a.daysToBirth - b.daysToBirth)
    .slice(0, 5);

  const HeaderActions = (
    <div className="flex gap-3 w-full md:w-auto">
      <Button
        color="primary"
        startContent={<UserPlus size={18} />}
        onPress={() => navigate("/add-patient")}
        className="font-medium shadow-md shadow-primary/20 flex-1 md:flex-none"
      >
        Nuovo Paziente
      </Button>
      <Button
        variant="bordered"
        startContent={<Calendar size={18} />}
        onPress={openCheckPatientModal}
        className="font-medium flex-1 md:flex-none border-default-300 text-default-700 bg-white"
      >
        Nuova Visita
      </Button>
    </div>
  );

  return (
    <div className="corioli-page space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title={`${getGreetingMessage()}, ${doctorName || "Dottore"}`}
        subtitle={stats.subtitle}
        icon={LayoutDashboard}
        iconColor="primary"
        actions={HeaderActions}
      />

      {/* ─── KPI Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          isPressable
          onPress={() => navigate("/pazienti")}
          className="corioli-kpi"
        >
          <CardBody className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Pazienti
                </p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1">
                  {stats.totalPatients}
                </h3>
                {stats.patientsThisMonth > 0 && (
                  <p className="text-xs text-success-600 mt-1 flex items-center gap-1">
                    <TrendingUp size={12} /> +{stats.patientsThisMonth} questo
                    mese
                  </p>
                )}
              </div>
              <div className="p-2.5 bg-default-100 rounded-xl text-default-600">
                <Users size={22} />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card
          isPressable
          onPress={() => navigate("/visite")}
          className="corioli-kpi"
        >
          <CardBody className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Visite
                </p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1">
                  {stats.totalVisits}
                </h3>
                {stats.visitsThisMonth > 0 && (
                  <p className="text-xs text-success-600 mt-1 flex items-center gap-1">
                    <TrendingUp size={12} /> +{stats.visitsThisMonth} questo
                    mese
                  </p>
                )}
              </div>
              <div className="p-2.5 bg-default-100 rounded-xl text-default-600">
                <Activity size={22} />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="corioli-kpi">
          <CardBody className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Età Media
                </p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1">
                  {stats.averageAge > 0 ? (
                    <>
                      {stats.averageAge}
                      <span className="text-base font-normal text-gray-400 ml-1">
                        anni
                      </span>
                    </>
                  ) : (
                    "—"
                  )}
                </h3>
                <p className="text-xs text-gray-400 mt-1">dei pazienti</p>
              </div>
              <div className="p-2.5 bg-default-100 rounded-xl text-default-600">
                <HeartPulse size={22} />
              </div>
            </div>
          </CardBody>
        </Card>

        <Card
          isPressable
          onPress={() => navigate("/visite")}
          className="corioli-kpi"
        >
          <CardBody className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Questo Mese
                </p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1">
                  {stats.visitsThisMonth}
                </h3>
                <p className="text-xs text-gray-400 mt-1">visite effettuate</p>
              </div>
              <div className="p-2.5 bg-default-100 rounded-xl text-default-600">
                <Clock size={22} />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ─── Lists Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pazienti Recenti */}
        <Card className="corioli-card">
          <CardHeader className="corioli-card-header flex justify-between items-center">
            <div className="dashboard-column-header-title">
              <Users className="text-emerald-600 shrink-0" size={16} />
              <h3 className="text-base font-semibold text-gray-900">
                Pazienti Recenti
              </h3>
            </div>
            <Button
              size="sm"
              variant="light"
              color="primary"
              endContent={<ChevronRight size={16} />}
              onPress={() => navigate("/pazienti")}
            >
              Vedi tutti
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            {stats.recentPatients.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {stats.recentPatients.map((patient) => {
                  const displayName = formatPatientDisplayName(patient);
                  const avatarInitials = displayName
                    ? `${patient.nome?.[0] ?? ""}${patient.cognome?.[0] ?? ""}`.trim() ||
                      displayName.slice(0, 2).toUpperCase()
                    : "?";

                  return (
                    <div
                      key={patient.id}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                      onClick={() => navigate(`/patient-history/${patient.id}`)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          name={avatarInitials}
                          size="sm"
                          color="default"
                          className="transition-transform group-hover:scale-110 flex-shrink-0"
                        />
                        <div className="min-w-0">
                          {displayName ? (
                            <p className="font-medium text-gray-900 group-hover:text-brand-600 transition-colors truncate text-sm">
                              {displayName}
                            </p>
                          ) : (
                            <p className="text-sm text-gray-400 italic truncate">
                              Paziente senza nome
                            </p>
                          )}
                          <p className="text-xs text-gray-500 truncate">
                            <CodiceFiscaleValue
                              value={patient.codiceFiscale}
                              generatedFromImport={Boolean(
                                patient.codiceFiscaleGenerato,
                              )}
                            />
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        <Chip
                          size="sm"
                          variant="flat"
                          color="default"
                          className="text-xs"
                        >
                          {calculateAge(patient.dataNascita) > 0
                            ? `${calculateAge(patient.dataNascita)}a`
                            : "—"}
                        </Chip>
                        <ArrowRight
                          size={14}
                          className="text-gray-300 group-hover:text-brand-600 transition-colors"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-gray-400 gap-2">
                <Users size={32} className="text-gray-200" />
                <p className="text-sm">Nessun paziente registrato.</p>
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  onPress={() => navigate("/add-patient")}
                  startContent={<UserPlus size={14} />}
                >
                  Aggiungi
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Visite Recenti */}
        <Card className="corioli-card">
          <CardHeader className="corioli-card-header flex justify-between items-center">
            <div className="dashboard-column-header-title">
              <FileText className="text-blue-600 shrink-0" size={16} />
              <h3 className="text-base font-semibold text-gray-900">
                Visite Recenti
              </h3>
            </div>
            <Button
              size="sm"
              variant="light"
              color="primary"
              endContent={<ChevronRight size={16} />}
              onPress={() => navigate("/visite")}
            >
              Vedi tutte
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            {stats.groupedRecentVisits.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {stats.groupedRecentVisits.map((group) => (
                  <div
                    key={`${group.patientId}_${group.dateKey}`}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                    onClick={() =>
                      group.patientId &&
                      navigate(`/patient-history/${group.patientId}`)
                    }
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`p-1.5 rounded-lg flex-shrink-0 ${
                          group.tipo === "ginecologica"
                            ? "bg-danger-50 text-danger-700"
                            : group.tipo === "ostetrica"
                              ? "bg-warning-50 text-warning-700"
                              : "bg-default-100 text-default-700"
                        }`}
                      >
                        {group.tipo === "ostetrica" ? (
                          <Baby size={14} />
                        ) : (
                          <Stethoscope size={14} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 group-hover:text-brand-600 transition-colors truncate text-sm">
                          {group.patientName}
                        </p>
                        <p className="text-xs text-gray-500 truncate flex items-center gap-1 flex-wrap">
                          {group.mixedTypes ? (
                            <span>{group.count} visite</span>
                          ) : (
                            <Chip
                              size="sm"
                              variant="flat"
                              color={getVisitTypeColor(group.tipo)}
                              className="text-xs h-5"
                            >
                              {getVisitTypePluralPhrase(group.tipo, group.count)}
                            </Chip>
                          )}
                          <span className="text-gray-400">·</span>
                          <span>{group.dateLabel}</span>
                        </p>
                      </div>
                    </div>
                    <ArrowRight
                      size={14}
                      className="text-gray-300 group-hover:text-brand-600 transition-colors flex-shrink-0 ml-2"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-gray-400 gap-2">
                <FileText size={32} className="text-gray-200" />
                <p className="text-sm">Nessuna visita registrata.</p>
                <Button
                  size="sm"
                  color="primary"
                  variant="flat"
                  onPress={openCheckPatientModal}
                  startContent={<Calendar size={14} />}
                >
                  Inizia
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Gravidanze in corso */}
        <Card className="corioli-card">
          <CardHeader className="corioli-card-header flex justify-between items-center gap-2">
            <div className="dashboard-column-header-title min-w-0">
              <i
                className="ti ti-baby-carriage dashboard-column-header-icon text-emerald-700"
                aria-hidden
              />
              <h3 className="text-base font-semibold text-gray-900 truncate">
                Gravidanze in corso
              </h3>
            </div>
            <Button
              size="sm"
              variant="light"
              color="primary"
              endContent={<ChevronRight size={16} />}
              onPress={() => navigate("/gravidanze")}
            >
              Vedi tutte
            </Button>
          </CardHeader>
          <CardBody className="p-0">
            {activePregnancies.length > 0 ? (
              <>
                <div>
                  {visiblePregnancies.map((pregnancy) => (
                    <PregnancyListRow
                      key={pregnancy.patientId}
                      pregnancy={pregnancy}
                      onClick={(patientId) =>
                        navigate(`/patient-history/${patientId}`)
                      }
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center px-6 py-10 text-center gap-2">
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
                  Nessuna gravidanza in corso
                </p>
                <p
                  className="text-xs max-w-[240px]"
                  style={{ color: "var(--color-text-tertiary)" }}
                >
                  Le pazienti ostetriche con UM registrata appariranno qui
                  automaticamente
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Snackbar
        open={toast.open}
        autoHideDuration={5000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={() => setToast((t) => ({ ...t, open: false }))}
          severity="success"
          variant="filled"
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </div>
  );
}
