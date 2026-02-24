interface CodiceFiscaleValueProps {
  value?: string;
  className?: string;
  mono?: boolean;
  placeholder?: string;
  generatedFromImport?: boolean;
}

export function CodiceFiscaleValue({
  value,
  className = "",
  mono = true,
  placeholder = "—",
  generatedFromImport = false,
}: CodiceFiscaleValueProps) {
  const cf = (value || "").trim().toUpperCase();
  if (!cf) {
    return <span className={className}>{placeholder}</span>;
  }

  return (
    <span className={className}>
      <span className={mono ? "font-mono" : ""}>{cf}</span>
      {generatedFromImport && (
        <span className="text-danger font-bold ml-1" title="Codice fiscale generato automaticamente da import">
          *
        </span>
      )}
    </span>
  );
}
