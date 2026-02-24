import { useState, useEffect, useMemo, ChangeEvent } from "react";
import { 
  Input, 
  Button, 
  Card, 
  CardBody, 
  CardHeader,
  Divider,
  Chip
} from "@nextui-org/react";
import { useNavigate } from "react-router-dom";
import { PatientService } from "../../services/OfflineServices";
import { Patient } from "../../types/Storage";
import { CodiceFiscaleValue } from "../../components/CodiceFiscaleValue";

export default function CheckPatient() {
  const [cf, setCf] = useState("");
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const loadPatients = async () => {
      try {
        const patients = await PatientService.getAllPatients();
        setAllPatients(patients);
      } catch (err) {
        console.error("Errore nel caricamento pazienti per suggerimenti:", err);
      }
    };
    loadPatients();
  }, []);

  const suggestions = useMemo(() => {
    const query = cf.trim().toUpperCase();
    if (query.length < 4) return [];

    const startsWithMatches = allPatients.filter((p) =>
      p.codiceFiscale.toUpperCase().startsWith(query)
    );

    const includesMatches = allPatients.filter((p) =>
      !p.codiceFiscale.toUpperCase().startsWith(query) &&
      p.codiceFiscale.toUpperCase().includes(query)
    );

    return [...startsWithMatches, ...includesMatches].slice(0, 6);
  }, [cf, allPatients]);

  const handleSuggestionClick = (patient: Patient) => {
    const selectedCf = patient.codiceFiscale.toUpperCase();
    setCf(selectedCf);
    if (error) setError(null);
    if (success) setSuccess(null);
    navigate(`/patient-history/${selectedCf}`);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setCf(e.target.value.toUpperCase());
    if (error) setError(null);
    if (success) setSuccess(null);
  };

  const validateCF = (cf: string) => {
    const re = /^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/;
    return re.test(cf);
  };

  const handleCheck = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!cf.trim()) {
      setError("Inserisci un codice fiscale");
      return;
    }

    if (!validateCF(cf)) {
      setError("Codice fiscale non valido (formato: RSSMRA80A01H501U)");
      return;
    }

    setIsLoading(true);

    try {
      const patient = await PatientService.getPatientByCF(cf);

      if (patient) {
        setSuccess("Paziente trovato!");
        navigate(`/patient-history/${cf}`);
      } else {
        setSuccess("Paziente non trovato.");
        navigate(`/add-patient?cf=${cf}`);
      }
    } catch (error) {
      console.error("Errore durante la verifica del paziente:", error);
      setError("Errore durante la verifica del paziente");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Verifica Paziente</h1>
        <p className="text-gray-600 mt-2">
          Inserisci il codice fiscale per verificare se il paziente è già registrato
        </p>
      </div>

      <Card className="shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="w-full">
            <div className="text-6xl mb-4">🔍</div>
            <h2 className="text-xl font-semibold">Ricerca Paziente</h2>
          </div>
        </CardHeader>
        <CardBody className="gap-6">
          {error && (
            <Card className="border-l-4 border-l-danger">
              <CardBody className="py-3">
                <p className="text-danger text-sm">{error}</p>
              </CardBody>
            </Card>
          )}

          {success && (
            <Card className="border-l-4 border-l-success">
              <CardBody className="py-3">
                <p className="text-success text-sm">{success}</p>
              </CardBody>
            </Card>
          )}

          <form onSubmit={handleCheck} className="space-y-6">
            <div className="space-y-4">
              <Input
                label="Codice Fiscale"
                placeholder="RSSMRA80A01H501U"
                value={cf}
                onChange={handleChange}
                variant="bordered"
                size="lg"
                isRequired
                classNames={{
                  label: "text-gray-700 font-medium",
                  input: "text-center font-mono text-lg",
                  inputWrapper: "h-14",
                }}
                description="Inserisci il codice fiscale del paziente (16 caratteri)"
                maxLength={16}
              />

              {suggestions.length > 0 && (
                <Card className="border border-default-200">
                  <CardBody className="p-2">
                    <p className="text-xs text-gray-500 px-2 pb-2">
                      Suggerimenti (clicca per compilare rapidamente)
                    </p>
                    <div className="space-y-1">
                      {suggestions.map((patient) => (
                        <Button
                          key={patient.id}
                          variant="light"
                          className="w-full justify-start h-auto py-2"
                          onPress={() => handleSuggestionClick(patient)}
                        >
                          <div className="text-left">
                            <p className="text-sm">
                              <CodiceFiscaleValue
                                value={patient.codiceFiscale}
                                generatedFromImport={Boolean(patient.codiceFiscaleGenerato)}
                              />
                            </p>
                            <p className="text-xs text-gray-500">
                              {patient.nome} {patient.cognome}
                            </p>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </CardBody>
                </Card>
              )}

            </div>

            <Divider />

            <div className="flex gap-4">
              <Button
                color="danger"
                variant="flat"
                onPress={() => navigate("/")}
                className="flex-1"
              >
                Annulla
              </Button>
              <Button
                type="submit"
                color="primary"
                className="flex-1"
                isLoading={isLoading}
                isDisabled={isLoading || !cf.trim()}
                size="lg"
              >
                {isLoading ? "Verifica in corso..." : "Verifica Paziente"}
              </Button>
            </div>
          </form>

          <Divider />

          <div className="text-center space-y-4">
            <p className="text-gray-600">Il paziente non è ancora registrato?</p>
            <Button
              color="success"
              variant="flat"
              onPress={() => navigate("/add-patient")}
              className="w-full"
            >
              Registra Nuovo Paziente
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}