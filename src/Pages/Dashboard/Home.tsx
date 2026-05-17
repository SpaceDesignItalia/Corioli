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
  FlaskConical,
  Award,
} from "lucide-react";
import {
  DoctorService,
  PatientService,
  VisitService,
  RichiestaEsameService,
  CertificatoService,
} from "../../services/OfflineServices";
import {
  Patient,
  Visit,
  RichiestaEsameComplementare,
  CertificatoPaziente,
} from "../../types/Storage";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { PageHeader } from "../../components/PageHeader";
import { CodiceFiscaleValue } from "../../components/CodiceFiscaleValue";

interface DashboardStats {
  totalPatients: number;
  totalVisits: number;
  recentPatients: Patient[];
  recentVisits: (Visit & { patientName: string; patientCf: string })[];
  recentEsami: (RichiestaEsameComplementare & {
    patientName: string;
    patientCf: string;
  })[];
  recentCertificati: (CertificatoPaziente & {
    patientName: string;
    patientCf: string;
  })[];
  averageAge: number;
  visitsThisMonth: number;
  patientsThisMonth: number;
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

export default function Home() {
  const navigate = useNavigate();
  const [doctorName, setDoctorName] = useState<string | null>(null);
  const [stats, setStats] = useState<DashboardStats>({
    totalPatients: 0,
    totalVisits: 0,
    recentPatients: [],
    recentVisits: [],
    recentEsami: [],
    recentCertificati: [],
    averageAge: 0,
    visitsThisMonth: 0,
    patientsThisMonth: 0,
  });
  const [recentTab, setRecentTab] = useState<"esami" | "certificati">(() => {
    try {
      const s = localStorage.getItem("corioli_home_esami_certificati_tab");
      if (s === "esami" || s === "certificati") return s;
    } catch {
      /* ignore */
    }
    return "esami";
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      localStorage.setItem("corioli_home_esami_certificati_tab", recentTab);
    } catch {
      /* ignore */
    }
  }, [recentTab]);
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
        const [doctor, patients, visits, allEsami, certArrays] = await Promise.all([
          DoctorService.initializeDefaultDoctor(),
          patientsPromise,
          VisitService.getAllVisits(),
          RichiestaEsameService.getAll(),
          patientsPromise.then((ps) =>
            Promise.all(ps.map((p) => CertificatoService.getByPatientId(p.id))),
          ),
        ]);

        setDoctorName(`${doctor.nome} ${doctor.cognome}`);

        const now = new Date();
        const thisMonthStart = new Date(
          now.getFullYear(),
          now.getMonth(),
          1,
        ).toISOString();

        // This month counts
        const visitsThisMonth = visits.filter(
          (v) => v.dataVisita >= thisMonthStart,
        ).length;
        const patientsThisMonth = patients.filter(
          (p) => p.createdAt >= thisMonthStart,
        ).length;

        // Recent patients sorted by activity
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

        // Enrich visits with patient info
        const patientMap = new Map(patients.map((p) => [p.id, p]));
        const enrichedVisits = visits.map((v) => {
          const p = patientMap.get(v.patientId);
          return {
            ...v,
            patientName: p ? `${p.nome} ${p.cognome}` : "Paziente sconosciuto",
            patientCf: p?.codiceFiscale || "",
          };
        });
        const sortedVisits = enrichedVisits
          .sort(
            (a, b) =>
              new Date(b.dataVisita).getTime() -
              new Date(a.dataVisita).getTime(),
          )
          .slice(0, 6);

        // Enrich esami with patient info
        const enrichedEsami = allEsami
          .map((e) => {
            const p = patientMap.get(e.patientId);
            return {
              ...e,
              patientName: p
                ? `${p.nome} ${p.cognome}`
                : "Paziente sconosciuto",
              patientCf: p?.codiceFiscale || "",
            };
          })
          .slice(0, 6);

        // Certificati recenti: flatten, arricchisci con nome paziente, ordina per data, prendi 6
        const flatCerts = certArrays.flatMap((arr, i) =>
          arr.map((c) => ({
            ...c,
            patientName: patients[i]
              ? `${patients[i].nome} ${patients[i].cognome}`
              : "Paziente sconosciuto",
            patientCf: patients[i]?.codiceFiscale || "",
          })),
        );
        const recentCertificati = flatCerts
          .sort(
            (a, b) =>
              new Date(b.dataCertificato).getTime() -
              new Date(a.dataCertificato).getTime(),
          )
          .slice(0, 6);

        // Average age
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
          recentVisits: sortedVisits,
          recentEsami: enrichedEsami,
          recentCertificati,
          averageAge,
          visitsThisMonth,
          patientsThisMonth,
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
        onPress={() => navigate("/check-patient")}
        className="font-medium flex-1 md:flex-none border-default-300 text-default-700 bg-white"
      >
        Nuova Visita
      </Button>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title={`${getGreetingMessage()}, ${doctorName || "Dottore"}`}
        subtitle="Ecco il riepilogo della tua attività."
        icon={LayoutDashboard}
        iconColor="primary"
        actions={HeaderActions}
      />

      {/* ─── KPI Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Pazienti totali */}
        <Card
          isPressable
          onPress={() => navigate("/pazienti")}
          className="corioli-kpi border-l-4 border-emerald-500"
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
              <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                <Users size={22} />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Visite totali */}
        <Card
          isPressable
          onPress={() => navigate("/visite")}
          className="corioli-kpi border-l-4 border-blue-500"
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
              <div className="p-2.5 bg-blue-50 rounded-xl text-blue-600">
                <Activity size={22} />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Età media */}
        <Card className="corioli-kpi border-l-4 border-purple-500">
          <CardBody className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Età Media
                </p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1">
                  {stats.averageAge}
                  <span className="text-base font-normal text-gray-400 ml-1">
                    anni
                  </span>
                </h3>
                <p className="text-xs text-gray-400 mt-1">dei pazienti</p>
              </div>
              <div className="p-2.5 bg-purple-50 rounded-xl text-purple-600">
                <HeartPulse size={22} />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Visite questo mese */}
        <Card
          isPressable
          onPress={() => navigate("/visite")}
          className="corioli-kpi border-l-4 border-amber-500"
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
              <div className="p-2.5 bg-amber-50 rounded-xl text-amber-600">
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
            <div className="flex items-center gap-2">
              <Users className="text-emerald-600" size={18} />
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
                {stats.recentPatients.map((patient) => (
                  <div
                    key={patient.id}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/patient-history/${patient.id}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        name={patient.nome[0] + patient.cognome[0]}
                        size="sm"
                        color="success"
                        className="transition-transform group-hover:scale-110 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 group-hover:text-brand-600 transition-colors truncate text-sm">
                          {patient.nome} {patient.cognome}
                        </p>
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
                        color="success"
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
                ))}
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
            <div className="flex items-center gap-2">
              <FileText className="text-blue-600" size={18} />
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
            {stats.recentVisits.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {stats.recentVisits.map((visit) => (
                  <div
                    key={visit.id}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                    onClick={() =>
                      visit.patientId &&
                      navigate(`/patient-history/${visit.patientId}`)
                    }
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`p-1.5 rounded-lg flex-shrink-0 ${
                          visit.tipo === "ginecologica"
                            ? "bg-danger-50 text-danger-700"
                            : visit.tipo === "ostetrica"
                              ? "bg-warning-50 text-warning-700"
                              : "bg-default-100 text-default-700"
                        }`}
                      >
                        {visit.tipo === "ostetrica" ? (
                          <Baby size={14} />
                        ) : (
                          <Stethoscope size={14} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 group-hover:text-brand-600 transition-colors truncate text-sm">
                          {visit.patientName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {visit.descrizioneClinica || "Nessuna descrizione"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <div className="text-right">
                        <Chip
                          size="sm"
                          variant="flat"
                          color={getVisitTypeColor(visit.tipo)}
                          className="text-xs"
                        >
                          {getVisitTypeLabel(visit.tipo)}
                        </Chip>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(visit.dataVisita).toLocaleDateString(
                            "it-IT",
                          )}
                        </p>
                      </div>
                      <ArrowRight
                        size={14}
                        className="text-gray-300 group-hover:text-brand-600 transition-colors"
                      />
                    </div>
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
                  onPress={() => navigate("/check-patient")}
                  startContent={<Calendar size={14} />}
                >
                  Inizia
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Esami / Certificati recenti */}
        <Card className="corioli-card">
          <CardHeader className="corioli-card-header flex justify-between items-center">
            <div className="flex items-center gap-2">
              <FlaskConical className="text-purple-600" size={18} />
              <h3 className="text-base font-semibold text-gray-900">
                Esami & Cert.
              </h3>
            </div>
            <div className="flex gap-0 rounded-lg bg-default-200/50 p-0.5">
              <button
                type="button"
                onClick={() => setRecentTab("esami")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  recentTab === "esami"
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Esami
              </button>
              <button
                type="button"
                onClick={() => setRecentTab("certificati")}
                className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  recentTab === "certificati"
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                Certificati
              </button>
            </div>
          </CardHeader>
          <CardBody className="p-0">
            {recentTab === "esami" ? (
              stats.recentEsami.length > 0 ? (
                <div className="divide-y divide-gray-100">
                  {stats.recentEsami.map((esame) => (
                    <div
                      key={esame.id}
                      className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                      onClick={() =>
                        esame.patientId &&
                        navigate(`/patient-history/${esame.patientId}`)
                      }
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="p-1.5 rounded-lg flex-shrink-0 bg-cyan-50 text-cyan-600">
                          <FlaskConical size={14} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-gray-900 group-hover:text-brand-600 transition-colors truncate text-sm">
                            {esame.nome}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {esame.patientName}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                        <div className="text-right">
                          <p className="text-xs text-gray-400">
                            {new Date(esame.dataRichiesta).toLocaleDateString(
                              "it-IT",
                            )}
                          </p>
                          {esame.note && (
                            <p className="text-xs text-brand-600 truncate max-w-[80px]">
                              {esame.note}
                            </p>
                          )}
                        </div>
                        <ArrowRight
                          size={14}
                          className="text-gray-300 group-hover:text-brand-600 transition-colors"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-gray-400 gap-2">
                  <FlaskConical size={32} className="text-gray-200" />
                  <p className="text-sm text-center">Nessun esame richiesto.</p>
                  <p className="text-xs text-center text-gray-300">
                    Gli esami vengono aggiunti dalla scheda del paziente.
                  </p>
                </div>
              )
            ) : stats.recentCertificati.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {stats.recentCertificati.map((cert) => (
                  <div
                    key={cert.id}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                    onClick={() =>
                      cert.patientId &&
                      navigate(`/patient-history/${cert.patientId}`)
                    }
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-1.5 rounded-lg flex-shrink-0 bg-brand-100 text-brand-700">
                        <Award size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 group-hover:text-brand-600 transition-colors truncate text-sm">
                          {cert.tipo === "assenza_lavoro"
                            ? "Assenza da lavoro"
                            : cert.tipo === "idoneita"
                              ? "Idoneità"
                              : cert.tipo === "malattia"
                                ? "Malattia"
                                : "Altro"}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {cert.patientName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <div className="text-right">
                        <p className="text-xs text-gray-400">
                          {new Date(cert.dataCertificato).toLocaleDateString(
                            "it-IT",
                          )}
                        </p>
                        {cert.descrizione && (
                          <p className="text-xs text-brand-600 truncate max-w-[120px]">
                            {cert.descrizione.slice(0, 40)}
                            {cert.descrizione.length > 40 ? "…" : ""}
                          </p>
                        )}
                      </div>
                      <ArrowRight
                        size={14}
                        className="text-gray-300 group-hover:text-brand-600 transition-colors"
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-gray-400 gap-2">
                <Award size={32} className="text-gray-200" />
                <p className="text-sm text-center">Nessun certificato.</p>
                <p className="text-xs text-center text-gray-300">
                  I certificati si aggiungono dalla scheda del paziente.
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
