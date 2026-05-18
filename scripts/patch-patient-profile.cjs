const fs = require("fs");
const path = "src/Pages/Dashboard/PatientHistory.tsx";
let s = fs.readFileSync(path, "utf8");

const searchStart = "      {/* 1. Profilo Paziente Unificato */}";
const searchEnd = "      {/* Nota bene:";

const i = s.indexOf(searchStart);
const j = s.indexOf(searchEnd);
if (i === -1 || j === -1) {
  console.error("markers not found", i, j);
  process.exit(1);
}

const newProfile = `      {/* 1. Profilo Paziente Unificato */}
      <Card className="corioli-card">
        <CardBody className="p-6 space-y-5">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            <div className="flex items-center gap-5 flex-1 min-w-0">
              <Avatar
                name={getPatientInitials(patient)}
                className="w-20 h-20 text-2xl shrink-0"
                color={getGenderColor(patient.sesso)}
                isBordered
              />
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-gray-900 leading-tight">
                  {patient.nome} {patient.cognome}
                </h1>
                <p className="text-sm text-default-500 mt-1">
                  Scheda paziente — dati anagrafici e clinici
                </p>
              </div>
            </div>

            <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto shrink-0">
              <Button
                variant="bordered"
                size="sm"
                onPress={() => navigate(\`/patient-history/\${patient.id}/files\`)}
                startContent={<FileTextIcon size={16} />}
                className="justify-start md:w-40 border-default-300 bg-white"
              >
                File
              </Button>
              <Button
                variant="bordered"
                size="sm"
                onPress={handleOpenEdit}
                startContent={<EditIcon size={16} />}
                className="justify-start md:w-40 border-default-300 bg-white"
              >
                Modifica Dati
              </Button>
            </div>
          </div>

          <Divider />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <ProfileDetailSection title="Anagrafica">
              <ProfileDetailField label="Nome" value={patient.nome} />
              <ProfileDetailField label="Cognome" value={patient.cognome} />
              <div>
                <p className="text-xs font-medium text-default-400">
                  Codice Fiscale
                </p>
                <div className="text-sm text-gray-800 mt-0.5">
                  <CodiceFiscaleValue
                    value={patient.codiceFiscale}
                    generatedFromImport={Boolean(
                      patient.codiceFiscaleGenerato,
                    )}
                  />
                </div>
              </div>
              <ProfileDetailField
                label="Data di nascita"
                value={
                  patient.dataNascita
                    ? \`\${formatVisitDate(patient.dataNascita)}\${
                        calculateAge(patient.dataNascita)
                          ? \` (\${calculateAge(patient.dataNascita)} anni)\`
                          : ""
                      }\`
                    : undefined
                }
              />
              <ProfileDetailField
                label="Luogo di nascita"
                value={patient.luogoNascita}
              />
              <ProfileDetailField
                label="Sesso"
                value={patient.sesso === "M" ? "Maschio" : "Femmina"}
              />
            </ProfileDetailSection>

            <ProfileDetailSection title="Contatti">
              <ProfileDetailField
                label="Indirizzo"
                value={patient.indirizzo}
                className="sm:col-span-2"
              />
              <ProfileDetailField label="Telefono" value={patient.telefono} />
              <ProfileDetailField label="Email" value={patient.email} />
            </ProfileDetailSection>

            <ProfileDetailSection title="Dati clinici">
              <ProfileDetailField
                label="Gruppo sanguigno"
                value={patient.gruppoSanguigno}
              />
              <ProfileDetailField
                label="Altezza"
                value={
                  patient.altezza != null && patient.altezza > 0
                    ? \`\${patient.altezza} cm\`
                    : undefined
                }
              />
              {patient.peso != null && patient.peso > 0 && (
                <ProfileDetailField
                  label="Peso"
                  value={\`\${patient.peso} kg\`}
                />
              )}
              {hasProfileValue(patient.allergie) && (
                <div className="sm:col-span-2">
                  <p className="text-xs font-medium text-default-400">
                    Allergie / intolleranze
                  </p>
                  <p className="text-sm text-danger-600 mt-0.5 whitespace-pre-line">
                    {patient.allergie}
                  </p>
                </div>
              )}
            </ProfileDetailSection>
          </div>
        </CardBody>
      </Card>

`;

// Fix accidental motion.div in patch template
const fixed = newProfile
  .replace(/<motion\.motion.div/g, "<div")
  .replace(/motion\.motion.div/g, "div")
  .replace(
    '<motion.div className="flex flex-col md:flex-row gap-6 items-start">',
    '<div className="flex flex-col md:flex-row gap-6 items-start">',
  );

s = s.slice(0, i) + fixed + s.slice(j);
fs.writeFileSync(path, s);
console.log("patched profile section");
