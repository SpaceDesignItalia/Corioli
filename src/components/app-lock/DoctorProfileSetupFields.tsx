import { Input } from "@nextui-org/react";

export type DoctorProfileFormValues = {
  nome: string;
  cognome: string;
  email: string;
  telefono: string;
  specializzazione: string;
};

type Props = {
  values: DoctorProfileFormValues;
  onChange: (field: keyof DoctorProfileFormValues, value: string) => void;
  showFields?: Array<keyof DoctorProfileFormValues>;
};

const FIELD_LABELS: Record<keyof DoctorProfileFormValues, string> = {
  nome: "Nome",
  cognome: "Cognome",
  email: "Email",
  telefono: "Telefono",
  specializzazione: "Specializzazione",
};

const ALL_FIELDS: Array<keyof DoctorProfileFormValues> = [
  "nome",
  "cognome",
  "email",
  "telefono",
  "specializzazione",
];

export function doctorValuesFromProfile(
  doctor: Partial<DoctorProfileFormValues> | null,
): DoctorProfileFormValues {
  return {
    nome: String(doctor?.nome ?? "").trim(),
    cognome: String(doctor?.cognome ?? "").trim(),
    email: String(doctor?.email ?? "").trim(),
    telefono: String(doctor?.telefono ?? "").trim(),
    specializzazione: String(doctor?.specializzazione ?? "").trim(),
  };
}

export function validateDoctorProfileForm(
  values: DoctorProfileFormValues,
  fields: Array<keyof DoctorProfileFormValues> = ALL_FIELDS,
): string | null {
  for (const key of fields) {
    if (!String(values[key] ?? "").trim()) {
      return `${FIELD_LABELS[key]} è obbligatorio.`;
    }
  }
  const email = values.email.trim();
  if (fields.includes("email") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Inserisci un'email valida.";
  }
  return null;
}

export default function DoctorProfileSetupFields({
  values,
  onChange,
  showFields = ALL_FIELDS,
}: Props) {
  return (
    <div className="space-y-3">
      {showFields.includes("nome") ? (
        <Input
          label={FIELD_LABELS.nome}
          value={values.nome}
          onValueChange={(v) => onChange("nome", v)}
          variant="bordered"
          isRequired
        />
      ) : null}
      {showFields.includes("cognome") ? (
        <Input
          label={FIELD_LABELS.cognome}
          value={values.cognome}
          onValueChange={(v) => onChange("cognome", v)}
          variant="bordered"
          isRequired
        />
      ) : null}
      {showFields.includes("email") ? (
        <Input
          label={FIELD_LABELS.email}
          type="email"
          value={values.email}
          onValueChange={(v) => onChange("email", v)}
          variant="bordered"
          isRequired
        />
      ) : null}
      {showFields.includes("telefono") ? (
        <Input
          label={FIELD_LABELS.telefono}
          value={values.telefono}
          onValueChange={(v) => onChange("telefono", v)}
          variant="bordered"
          placeholder="3331234567"
          isRequired
        />
      ) : null}
      {showFields.includes("specializzazione") ? (
        <Input
          label={FIELD_LABELS.specializzazione}
          value={values.specializzazione}
          onValueChange={(v) => onChange("specializzazione", v)}
          variant="bordered"
          placeholder="Es. Ginecologia e Ostetricia"
          isRequired
        />
      ) : null}
    </div>
  );
}

export function getMissingProfileFieldKeys(
  values: DoctorProfileFormValues,
): Array<keyof DoctorProfileFormValues> {
  return ALL_FIELDS.filter((key) => !String(values[key] ?? "").trim());
}
