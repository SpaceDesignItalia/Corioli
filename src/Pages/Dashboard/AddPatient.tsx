import {
  Input,
  Button,
  DatePicker,
  Select,
  SelectItem,
  Card,
  CardBody,
  CardHeader,
  Divider,
  Spinner,
  Chip
} from "@nextui-org/react";
import { ChangeEvent, useState, useEffect, useRef } from "react";
import { I18nProvider } from "@react-aria/i18n";
import dayjs from "dayjs";
import { useSearchParams, useNavigate } from "react-router-dom";
import { PatientService } from "../../services/OfflineServices";
import { PageHeader } from "../../components/PageHeader";
import { UserPlus, Pencil } from "lucide-react";
import { parseDate } from "@internationalized/date";
import { useToast } from "../../contexts/ToastContext";
import { Breadcrumb } from "../../components/Breadcrumb";
import { calculateAge } from "../../utils/dateUtils";

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  birthday: string;
  birthplace: string;
  cf: string;
  gender: string;
  address: string;
}

export default function AddPatient() {
  const [registerData, setRegisterData] = useState<RegisterData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    birthday: "",
    birthplace: "",
    cf: "",
    gender: "F",
    address: "",
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const initialLoadDone = useRef(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  useEffect(() => {
    const cf = searchParams.get("cf");
    const id = searchParams.get("id");
    const mode = searchParams.get("mode");

    if (mode === "edit" && id) {
      setIsEditMode(true);
      loadPatientDataById(id);
    } else if (mode === "edit" && cf) {
      setIsEditMode(true);
      loadPatientDataByCf(cf);
    } else if (cf) {
      setRegisterData((prevData) => ({ ...prevData, cf }));
    }
  }, [searchParams]);

  const loadPatientDataById = async (id: string) => {
    setIsLoading(true);
    try {
      const patient = await PatientService.getPatientById(id);
      if (patient) {
        setPatientId(patient.id);
        initialLoadDone.current = false;
        setRegisterData({
          firstName: patient.nome,
          lastName: patient.cognome,
          email: patient.email || "",
          phone: patient.telefono || "",
          birthday: patient.dataNascita,
          birthplace: patient.luogoNascita,
          cf: patient.codiceFiscale || "",
          gender: patient.sesso,
          address: patient.indirizzo || ""
        });
      } else {
        setError("Paziente non trovato");
      }
    } catch (err) {
      console.error(err);
      setError("Errore nel caricamento dei dati del paziente");
    } finally {
      setIsLoading(false);
      setTimeout(() => { initialLoadDone.current = true; }, 200);
    }
  };

  const loadPatientDataByCf = async (cf: string) => {
    setIsLoading(true);
    try {
      const patient = await PatientService.getPatientByCF(cf);
      if (patient) {
        setPatientId(patient.id);
        initialLoadDone.current = false;
        setRegisterData({
          firstName: patient.nome,
          lastName: patient.cognome,
          email: patient.email || "",
          phone: patient.telefono || "",
          birthday: patient.dataNascita,
          birthplace: patient.luogoNascita,
          cf: patient.codiceFiscale || "",
          gender: patient.sesso,
          address: patient.indirizzo || ""
        });
      } else {
        setError("Paziente non trovato");
      }
    } catch (err) {
      console.error(err);
      setError("Errore nel caricamento dei dati del paziente");
    } finally {
      setIsLoading(false);
      setTimeout(() => { initialLoadDone.current = true; }, 200);
    }
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);
    const { name, value } = e.target;
    setRegisterData((prevData) => ({ ...prevData, [name]: value }));
    if (error) setError(null);
  };

  const handleSelectChange = (name: string, value: string) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);
    setRegisterData((prevData) => ({ ...prevData, [name]: value }));
    if (error) setError(null);
  };

  const handleDateChange = (date: any) => {
    if (initialLoadDone.current) setHasUnsavedChanges(true);
    if (date) {
      const formattedDate = dayjs(date.toString()).format("YYYY-MM-DD");
      setRegisterData((prevData) => ({
        ...prevData,
        birthday: formattedDate,
      }));
    }
  };

  const validateEmail = (email: string) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const validateCF = (cf: string) => {
    const re = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/;
    return re.test(cf.toUpperCase());
  };

  const handleRegistration = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (registerData.cf.trim() && !validateCF(registerData.cf)) {
      setError("Codice fiscale non valido (formato: 16 caratteri)");
      return;
    }
    if (registerData.email.trim() && !validateEmail(registerData.email)) {
      setError("Email non valida");
      return;
    }

    setIsLoading(true);

    try {
      const cfVal = registerData.cf.trim();
      const payload = {
        ...(cfVal ? { codiceFiscale: cfVal.toUpperCase(), codiceFiscaleGenerato: false as const } : {}),
        nome: registerData.firstName.trim(),
        cognome: registerData.lastName.trim(),
        dataNascita: registerData.birthday || "",
        luogoNascita: registerData.birthplace.trim(),
        sesso: (registerData.gender === "M" || registerData.gender === "F" ? registerData.gender : "M") as "M" | "F",
        email: registerData.email.trim() || undefined,
        telefono: registerData.phone.trim() || undefined,
        indirizzo: registerData.address.trim() || undefined,
      };
      if (isEditMode && patientId) {
        await PatientService.updatePatient(patientId, payload);
        setHasUnsavedChanges(false);
        showToast("Paziente aggiornato con successo");
      } else {
        await PatientService.addPatient(payload);
        setHasUnsavedChanges(false);
        showToast("Paziente aggiunto con successo");
      }
      navigate("/pazienti");
    } catch (error: any) {
      console.error("Error saving patient:", error);
      setError(error?.message || "Errore durante il salvataggio del paziente.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isEditMode && patientId) initialLoadDone.current = true;
    else if (!searchParams.get("mode")) setTimeout(() => { initialLoadDone.current = true; }, 300);
  }, [isEditMode, patientId, searchParams]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  if (isLoading && isEditMode && !patientId) {
    return (
      <div className="flex justify-center items-center h-[50vh]">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title={isEditMode ? "Modifica Paziente" : "Aggiungi Nuovo Paziente"}
        subtitle={isEditMode ? "Modifica i dati del paziente selezionato" : "Inserisci i dati del paziente per aggiungerlo al sistema"}
        icon={isEditMode ? Pencil : UserPlus}
        iconColor={isEditMode ? "warning" : "success"}
      />

      <Card className="shadow-lg border border-gray-100">
        <CardHeader className="pb-0 pt-6 px-6">
          <h2 className="text-xl font-semibold">Informazioni Paziente</h2>
        </CardHeader>
        <CardBody className="gap-6 p-6">
          {error && (
            <Card className="border-l-4 border-l-danger">
              <CardBody className="py-3">
                <p className="text-danger text-sm">{error}</p>
              </CardBody>
            </Card>
          )}

          {(() => {
            const items = [
              { label: "Dashboard", path: "/" },
              { label: "Pazienti", path: "/pazienti" },
              { label: isEditMode ? "Modifica paziente" : "Nuovo paziente" }
            ];
            return <Breadcrumb items={items} />;
          })()}

          <form onSubmit={handleRegistration} className="space-y-6">
            {hasUnsavedChanges && (
              <Chip size="sm" color="warning" variant="flat">Modifiche non salvate</Chip>
            )}
            {/* Dati Anagrafici */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 bg-gray-50 p-2 rounded">Dati Anagrafici</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  name="firstName"
                  label="Nome (opzionale)"
                  placeholder="Inserisci il nome"
                  value={registerData.firstName}
                  onChange={handleChange}
                  variant="bordered"
                  classNames={{ label: "text-gray-700 font-medium" }}
                />
                <Input
                  name="lastName"
                  label="Cognome (opzionale)"
                  placeholder="Inserisci il cognome"
                  value={registerData.lastName}
                  onChange={handleChange}
                  variant="bordered"
                  classNames={{ label: "text-gray-700 font-medium" }}
                />
              </div>
            </div>

            <Divider />

            {/* Dati di Nascita */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 bg-gray-50 p-2 rounded">Dati di Nascita</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <I18nProvider locale="it-IT">
                  <DatePicker
                    label="Data di Nascita (opzionale)"
                    variant="bordered"
                    showMonthAndYearPickers
                    onChange={handleDateChange}
                    value={registerData.birthday && /^\d{4}-\d{2}-\d{2}$/.test(registerData.birthday) ? parseDate(registerData.birthday) : undefined}
                    classNames={{ label: "text-gray-700 font-medium" }}
                  />
                  {registerData.birthday && calculateAge(registerData.birthday) != null && (
                    <p className="text-sm text-default-500 mt-1">Età: {calculateAge(registerData.birthday)} anni</p>
                  )}
                </I18nProvider>
                <Input
                  name="birthplace"
                  label="Luogo di Nascita (opzionale)"
                  placeholder="Es. Roma, Milano..."
                  value={registerData.birthplace}
                  onChange={handleChange}
                  variant="bordered"
                  classNames={{ label: "text-gray-700 font-medium" }}
                />
                <Select
                  label="Genere (opzionale)"
                  placeholder="Seleziona genere"
                  variant="bordered"
                  selectedKeys={registerData.gender ? [registerData.gender] : []}
                  onSelectionChange={(keys) => handleSelectChange("gender", Array.from(keys)[0] as string)}
                  classNames={{ label: "text-gray-700 font-medium" }}
                >
                  <SelectItem key="M" value="M">Maschio</SelectItem>
                  <SelectItem key="F" value="F">Femmina</SelectItem>
                </Select>
              </div>
            </div>

            <Divider />

            {/* Documenti */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 bg-gray-50 p-2 rounded">Documenti</h3>
              <Input
                name="cf"
                label="Codice Fiscale (opzionale)"
                placeholder="RSSMRA80A01H501U"
                value={registerData.cf}
                onChange={handleChange}
                variant="bordered"
                classNames={{
                  label: "text-gray-700 font-medium",
                  input: "uppercase",
                }}
                description="Non tutti i pazienti hanno il codice fiscale. Se inserito, deve essere di 16 caratteri."
              />
            </div>

            <Divider />

            {/* Contatti */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4 bg-gray-50 p-2 rounded">Informazioni di Contatto</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  name="email"
                  type="email"
                  label="Email (opzionale)"
                  placeholder="esempio@email.com"
                  value={registerData.email}
                  onChange={handleChange}
                  variant="bordered"
                  classNames={{ label: "text-gray-700 font-medium" }}
                />
                <Input
                  name="phone"
                  label="Telefono (opzionale)"
                  placeholder="3331234567"
                  value={registerData.phone}
                  onChange={handleChange}
                  variant="bordered"
                  classNames={{ label: "text-gray-700 font-medium" }}
                />
              </div>
              <Input
                name="address"
                label="Indirizzo (opzionale)"
                placeholder="Via Roma 10, Milano"
                value={registerData.address}
                onChange={handleChange}
                variant="bordered"
                className="mt-4"
                classNames={{ label: "text-gray-700 font-medium" }}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6">
              <Button
                color="danger"
                variant="flat"
                onPress={() => {
                  if (hasUnsavedChanges && !window.confirm("Modifiche non salvate. Uscire comunque?")) return;
                  navigate(isEditMode ? "/pazienti" : "/");
                }}
                className="flex-1"
              >
                Annulla
              </Button>
              <Button
                type="submit"
                color="success"
                className="flex-1 shadow-md shadow-success/20"
                isLoading={isLoading}
                isDisabled={isLoading}
              >
                {isLoading ? "Salvando..." : isEditMode ? "Aggiorna Paziente" : "Salva Paziente"}
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}