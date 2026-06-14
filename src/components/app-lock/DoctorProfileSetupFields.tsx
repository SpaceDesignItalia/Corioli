import { Input } from "@nextui-org/react";
import { Mail, Phone, Stethoscope, User } from "lucide-react";
import { useState, type ReactNode } from "react";

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
  /** Notifica quale campo ha il focus (o null al blur) — usato dalla mascotte */
  onFieldFocus?: (field: keyof DoctorProfileFormValues | null) => void;
};

const FIELD_LABELS: Record<keyof DoctorProfileFormValues, string> = {
  nome: "Nome",
  cognome: "Cognome",
  email: "Email",
  telefono: "Telefono",
  specializzazione: "Specializzazione",
};

const FIELD_ICONS: Record<keyof DoctorProfileFormValues, ReactNode> = {
  nome: <User size={16} />,
  cognome: <User size={16} />,
  email: <Mail size={16} />,
  telefono: <Phone size={16} />,
  specializzazione: <Stethoscope size={16} />,
};

const FIELD_AUTOCOMPLETE: Partial<Record<keyof DoctorProfileFormValues, string>> = {
  nome: "given-name",
  cognome: "family-name",
  email: "email",
  telefono: "tel",
};

const FIELD_PLACEHOLDERS: Record<keyof DoctorProfileFormValues, string> = {
  nome: "Es. Maria",
  cognome: "Es. Rossi",
  email: "nome@studio.it",
  telefono: "3331234567",
  specializzazione: "Es. Ginecologia e Ostetricia",
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
    telefono: sanitizePhoneInput(String(doctor?.telefono ?? "").trim()),
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
    return "Inserire un indirizzo email valido.";
  }
  return null;
}

function sanitizePhoneInput(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

function FieldIcon({ field }: { field: keyof DoctorProfileFormValues }) {
  return (
    <span className="onboarding-field-icon">
      {FIELD_ICONS[field]}
    </span>
  );
}

type ProfileFieldProps = {
  field: keyof DoctorProfileFormValues;
  value: string;
  onChange: (field: keyof DoctorProfileFormValues, value: string) => void;
  onFieldFocus?: (field: keyof DoctorProfileFormValues | null) => void;
};

function ProfileField({ field, value, onChange, onFieldFocus }: ProfileFieldProps) {
  const [focused, setFocused] = useState(false);
  const isPhone = field === "telefono";
  const isEmail = field === "email";
  const showPlaceholder = focused && !value;

  return (
    <Input
      label={FIELD_LABELS[field]}
      value={value}
      onValueChange={(v) =>
        onChange(field, isPhone ? sanitizePhoneInput(v) : v)
      }
      variant="bordered"
      labelPlacement="outside"
      placeholder={showPlaceholder ? FIELD_PLACEHOLDERS[field] : undefined}
      autoComplete={FIELD_AUTOCOMPLETE[field]}
      type={isPhone ? "tel" : isEmail ? "email" : "text"}
      inputMode={isPhone ? "tel" : undefined}
      isRequired
      endContent={<FieldIcon field={field} />}
      onFocus={() => {
        setFocused(true);
        onFieldFocus?.(field);
      }}
      onBlur={() => {
        setFocused(false);
        onFieldFocus?.(null);
      }}
    />
  );
}

export default function DoctorProfileSetupFields({
  values,
  onChange,
  showFields = ALL_FIELDS,
  onFieldFocus,
}: Props) {
  const showNome = showFields.includes("nome");
  const showCognome = showFields.includes("cognome");
  const nameSideBySide = showNome && showCognome;

  return (
    <div className="flex flex-col gap-[14px]">
      {nameSideBySide ? (
        <div className="grid grid-cols-2 gap-3">
          <ProfileField
            field="nome"
            value={values.nome}
            onChange={onChange}
            onFieldFocus={onFieldFocus}
          />
          <ProfileField
            field="cognome"
            value={values.cognome}
            onChange={onChange}
            onFieldFocus={onFieldFocus}
          />
        </div>
      ) : (
        <>
          {showNome ? (
            <ProfileField
              field="nome"
              value={values.nome}
              onChange={onChange}
              onFieldFocus={onFieldFocus}
            />
          ) : null}
          {showCognome ? (
            <ProfileField
              field="cognome"
              value={values.cognome}
              onChange={onChange}
              onFieldFocus={onFieldFocus}
            />
          ) : null}
        </>
      )}
      {showFields.includes("email") ? (
        <ProfileField
          field="email"
          value={values.email}
          onChange={onChange}
          onFieldFocus={onFieldFocus}
        />
      ) : null}
      {showFields.includes("telefono") ? (
        <ProfileField
          field="telefono"
          value={values.telefono}
          onChange={onChange}
          onFieldFocus={onFieldFocus}
        />
      ) : null}
      {showFields.includes("specializzazione") ? (
        <ProfileField
          field="specializzazione"
          value={values.specializzazione}
          onChange={onChange}
          onFieldFocus={onFieldFocus}
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
