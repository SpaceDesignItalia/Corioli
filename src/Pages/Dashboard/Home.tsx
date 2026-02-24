import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardBody, CardHeader, Button, Chip, Spinner, Avatar } from "@nextui-org/react";
import {
  UserPlus, Users, FileText, ChevronRight, Activity,
  Calendar, LayoutDashboard, TrendingUp, HeartPulse,
  Baby, Stethoscope, Clock, ArrowRight, FlaskConical
} from "lucide-react";
import { DoctorService, PatientService, VisitService, RichiestaEsameService } from "../../services/OfflineServices";
import { Patient, Visit, RichiestaEsameComplementare } from "../../types/Storage";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { PageHeader } from "../../components/PageHeader";
import { CodiceFiscaleValue } from "../../components/CodiceFiscaleValue";

interface DashboardStats {
  totalPatients: number;
  totalVisits: number;
  recentPatients: Patient[];
  recentVisits: (Visit & { patientName: string; patientCf: string })[];
  recentEsami: (RichiestaEsameComplementare & { patientName: string; patientCf: string })[];
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

const getVisitTypeColor = (tipo?: Visit["tipo"]): "secondary" | "warning" | "primary" => {
  if (tipo === "ginecologica") return "secondary";
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
    averageAge: 0,
    visitsThisMonth: 0,
    patientsThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ open: boolean; message: string }>({ open: false, message: "" });

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
        const [doctor, patients, visits, allEsami] = await Promise.all([
          DoctorService.initializeDefaultDoctor(),
          PatientService.getAllPatients(),
          VisitService.getAllVisits(),
          RichiestaEsameService.getAll(),
        ]);

        setDoctorName(`${doctor.nome} ${doctor.cognome}`);

        const now = new Date();
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

        // This month counts
        const visitsThisMonth = visits.filter(v => v.dataVisita >= thisMonthStart).length;
        const patientsThisMonth = patients.filter(p => p.createdAt >= thisMonthStart).length;

        // Recent patients sorted by activity
        const visitDatesByPatient = new Map<string, number>();
        for (const v of visits) {
          const t = new Date(v.dataVisita).getTime();
          const prev = visitDatesByPatient.get(v.patientId);
          if (prev == null || t > prev) visitDatesByPatient.set(v.patientId, t);
        }
        const sortedPatients = [...patients]
          .sort((a, b) => {
            const lastA = Math.max(new Date(a.createdAt).getTime(), new Date(a.updatedAt).getTime(), visitDatesByPatient.get(a.id) ?? 0);
            const lastB = Math.max(new Date(b.createdAt).getTime(), new Date(b.updatedAt).getTime(), visitDatesByPatient.get(b.id) ?? 0);
            return lastB - lastA;
          })
          .slice(0, 6);

        // Enrich visits with patient info
        const patientMap = new Map(patients.map(p => [p.id, p]));
        const enrichedVisits = visits.map(v => {
          const p = patientMap.get(v.patientId);
          return {
            ...v,
            patientName: p ? `${p.nome} ${p.cognome}` : "Paziente sconosciuto",
            patientCf: p?.codiceFiscale || ""
          };
        });
        const sortedVisits = enrichedVisits
          .sort((a, b) => new Date(b.dataVisita).getTime() - new Date(a.dataVisita).getTime())
          .slice(0, 6);

        // Enrich esami with patient info
        const enrichedEsami = allEsami.map(e => {
          const p = patientMap.get(e.patientId);
          return {
            ...e,
            patientName: p ? `${p.nome} ${p.cognome}` : "Paziente sconosciuto",
            patientCf: p?.codiceFiscale || ""
          };
        }).slice(0, 6);

        // Average age
        let validAgesCount = 0;
        const totalAge = patients.reduce((sum, p) => {
          const age = calculateAge(p.dataNascita);
          if (age > 0) { validAgesCount++; return sum + age; }
          return sum;
        }, 0);
        const averageAge = validAgesCount > 0 ? Math.round(totalAge / validAgesCount) : 0;

        setStats({
          totalPatients: patients.length,
          totalVisits: visits.length,
          recentPatients: sortedPatients,
          recentVisits: sortedVisits,
          recentEsami: enrichedEsami,
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
        color="secondary"
        variant="flat"
        startContent={<Calendar size={18} />}
        onPress={() => navigate("/check-patient")}
        className="font-medium flex-1 md:flex-none"
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
          className="shadow-sm hover:shadow-md transition-all border-l-4 border-emerald-500 bg-white/80 backdrop-blur-sm"
        >
          <CardBody className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pazienti</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1">{stats.totalPatients}</h3>
                {stats.patientsThisMonth > 0 && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <TrendingUp size={12} /> +{stats.patientsThisMonth} questo mese
                  </p>
                )}
              </div>
              <div className="p-2.5 bg-emerald-100/60 rounded-xl text-emerald-600">
                <Users size={22} />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Visite totali */}
        <Card
          isPressable
          onPress={() => navigate("/visite")}
          className="shadow-sm hover:shadow-md transition-all border-l-4 border-blue-500 bg-white/80 backdrop-blur-sm"
        >
          <CardBody className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Visite</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1">{stats.totalVisits}</h3>
                {stats.visitsThisMonth > 0 && (
                  <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                    <TrendingUp size={12} /> +{stats.visitsThisMonth} questo mese
                  </p>
                )}
              </div>
              <div className="p-2.5 bg-blue-100/60 rounded-xl text-blue-600">
                <Activity size={22} />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Età media */}
        <Card className="shadow-sm hover:shadow-md transition-all border-l-4 border-purple-500 bg-white/80 backdrop-blur-sm">
          <CardBody className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Età Media</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1">
                  {stats.averageAge}
                  <span className="text-base font-normal text-gray-400 ml-1">anni</span>
                </h3>
                <p className="text-xs text-gray-400 mt-1">dei pazienti</p>
              </div>
              <div className="p-2.5 bg-purple-100/60 rounded-xl text-purple-600">
                <HeartPulse size={22} />
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Visite questo mese */}
        <Card
          isPressable
          onPress={() => navigate("/visite")}
          className="shadow-sm hover:shadow-md transition-all border-l-4 border-amber-500 bg-white/80 backdrop-blur-sm"
        >
          <CardBody className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Questo Mese</p>
                <h3 className="text-3xl font-bold text-gray-900 mt-1">{stats.visitsThisMonth}</h3>
                <p className="text-xs text-gray-400 mt-1">visite effettuate</p>
              </div>
              <div className="p-2.5 bg-amber-100/60 rounded-xl text-amber-600">
                <Clock size={22} />
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* ─── Lists Row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Pazienti Recenti */}
        <Card className="shadow-md border border-gray-100">
          <CardHeader className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <Users className="text-emerald-600" size={18} />
              <h3 className="text-base font-semibold text-gray-900">Pazienti Recenti</h3>
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
                    onClick={() => navigate(`/patient-history/${patient.codiceFiscale}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Avatar
                        name={patient.nome[0] + patient.cognome[0]}
                        size="sm"
                        color={patient.sesso === "M" ? "primary" : "secondary"}
                        className="transition-transform group-hover:scale-110 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 group-hover:text-primary transition-colors truncate text-sm">
                          {patient.nome} {patient.cognome}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          <CodiceFiscaleValue
                            value={patient.codiceFiscale}
                            generatedFromImport={Boolean(patient.codiceFiscaleGenerato)}
                          />
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <Chip size="sm" variant="flat" color={patient.sesso === "M" ? "primary" : "secondary"} className="text-xs">
                        {calculateAge(patient.dataNascita) > 0 ? `${calculateAge(patient.dataNascita)}a` : "—"}
                      </Chip>
                      <ArrowRight size={14} className="text-gray-300 group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-gray-400 gap-2">
                <Users size={32} className="text-gray-200" />
                <p className="text-sm">Nessun paziente registrato.</p>
                <Button size="sm" color="primary" variant="flat" onPress={() => navigate("/add-patient")}
                  startContent={<UserPlus size={14} />}>
                  Aggiungi
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Visite Recenti */}
        <Card className="shadow-md border border-gray-100">
          <CardHeader className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <FileText className="text-blue-600" size={18} />
              <h3 className="text-base font-semibold text-gray-900">Visite Recenti</h3>
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
                    onClick={() => visit.patientCf && navigate(`/patient-history/${visit.patientCf}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`p-1.5 rounded-lg flex-shrink-0 ${visit.tipo === "ginecologica"
                          ? "bg-purple-100 text-purple-600"
                          : visit.tipo === "ostetrica"
                            ? "bg-amber-100 text-amber-600"
                            : "bg-blue-100 text-blue-600"
                        }`}>
                        {visit.tipo === "ostetrica" ? <Baby size={14} /> : <Stethoscope size={14} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 group-hover:text-primary transition-colors truncate text-sm">
                          {visit.patientName}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {visit.descrizioneClinica || "Nessuna descrizione"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <div className="text-right">
                        <Chip size="sm" variant="flat" color={getVisitTypeColor(visit.tipo)} className="text-xs">
                          {getVisitTypeLabel(visit.tipo)}
                        </Chip>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(visit.dataVisita).toLocaleDateString("it-IT")}
                        </p>
                      </div>
                      <ArrowRight size={14} className="text-gray-300 group-hover:text-primary transition-colors" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-gray-400 gap-2">
                <FileText size={32} className="text-gray-200" />
                <p className="text-sm">Nessuna visita registrata.</p>
                <Button size="sm" color="secondary" variant="flat" onPress={() => navigate("/check-patient")}
                  startContent={<Calendar size={14} />}>
                  Inizia
                </Button>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Esami Complementari Recenti */}
        <Card className="shadow-md border border-gray-100">
          <CardHeader className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex items-center gap-2">
              <FlaskConical className="text-teal-600" size={18} />
              <h3 className="text-base font-semibold text-gray-900">Esami Recenti</h3>
            </div>
            <Chip size="sm" variant="flat" color="default" className="text-xs">
              {stats.recentEsami.length} mostrati
            </Chip>
          </CardHeader>
          <CardBody className="p-0">
            {stats.recentEsami.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {stats.recentEsami.map((esame) => (
                  <div
                    key={esame.id}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                    onClick={() => esame.patientCf && navigate(`/patient-history/${esame.patientCf}`)}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="p-1.5 rounded-lg flex-shrink-0 bg-teal-100 text-teal-600">
                        <FlaskConical size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 group-hover:text-primary transition-colors truncate text-sm">
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
                          {new Date(esame.dataRichiesta).toLocaleDateString("it-IT")}
                        </p>
                        {esame.note && (
                          <p className="text-xs text-teal-500 truncate max-w-[80px]">{esame.note}</p>
                        )}
                      </div>
                      <ArrowRight size={14} className="text-gray-300 group-hover:text-primary transition-colors" />
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
