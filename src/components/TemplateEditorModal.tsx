import { useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Divider,
} from "@nextui-org/react";
import { FileText, ClipboardList, ChevronDown } from "lucide-react";
import type { MedicalTemplate } from "../types/Storage";
import { RefertoTextarea } from "./RefertoTextarea";

type TemplateCategory = MedicalTemplate["category"];
type TemplateSection = MedicalTemplate["section"];

const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  ginecologia: "Ginecologia",
  ostetricia: "Ostetricia",
  terapie: "Terapie",
  esame_complementare: "Esami complementari",
  certificato: "Certificati",
};

const SECTIONS_BY_CATEGORY: Record<TemplateCategory, TemplateSection[]> = {
  ginecologia: ["prestazione", "esameObiettivo", "conclusioni"],
  ostetricia: ["prestazione", "esameObiettivo", "conclusioni"],
  terapie: ["generale"],
  esame_complementare: ["nome"],
  certificato: ["generale"],
};

const DEFAULT_SECTION: Record<TemplateCategory, TemplateSection> = {
  ginecologia: "prestazione",
  ostetricia: "prestazione",
  terapie: "generale",
  esame_complementare: "nome",
  certificato: "generale",
};

/** Per le terapie la sezione DB è "generale" ma in UI compare in Conclusioni e Terapie */
function getPreviewSection(category: TemplateCategory, section: TemplateSection): TemplateSection {
  if (category === "terapie") return "conclusioni";
  return section;
}

type VisitFieldMock = {
  section?: TemplateSection;
  label: string;
  hasModello: boolean;
};

const GINE_OBST_FIELDS: VisitFieldMock[] = [
  { section: "prestazione", label: "1. Anamnesi", hasModello: true },
  { label: "2. Descrizione Problema", hasModello: false },
  { section: "esameObiettivo", label: "3. Visita / Ecografia Office", hasModello: true },
  { section: "conclusioni", label: "4. Conclusioni e Terapie", hasModello: true },
];

type LivePreviewContent = {
  menuLabel: string;
  fieldText: string;
  fieldNote?: string;
};

function getContentLabel(category: TemplateCategory): string {
  if (category === "esame_complementare") return "Nome dell'esame";
  if (category === "certificato") return "Testo del certificato";
  return "Testo da inserire nel referto";
}

function getContentPlaceholder(category: TemplateCategory): string {
  if (category === "esame_complementare") {
    return "Es. Emocromo con formula, Ecografia addome completo...";
  }
  if (category === "certificato") {
    return "Testo del certificato. Puoi usare ___ per i campi da compilare manualmente.";
  }
  return "Scrivi il testo completo che verrà inserito quando selezioni questo modello...";
}

function MockModelloControl({
  label = "Modello",
  open,
  menuLabel,
  menuDescription,
  dropUp = false,
}: {
  label?: string;
  open: boolean;
  menuLabel: string;
  menuDescription?: string;
  dropUp?: boolean;
}) {
  return (
    <div className="relative shrink-0">
      <span
        className={`inline-flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[10px] font-semibold transition-colors ${
          open
            ? "bg-primary text-white shadow-sm"
            : "bg-default-100 text-default-400"
        }`}
      >
        <ClipboardList size={10} />
        {label}
        <ChevronDown size={10} className={open ? "rotate-180 transition-transform" : ""} />
      </span>
      {open && (
        <div
          className={`absolute right-0 z-30 w-52 overflow-hidden rounded-lg border border-primary-200 bg-white shadow-lg animate-in fade-in zoom-in-95 duration-150 ${
            dropUp ? "bottom-[calc(100%+6px)]" : "top-[calc(100%+6px)]"
          }`}
        >
          <div className="border-b border-primary-100 bg-primary-50 px-2.5 py-1.5">
            <p className="text-[10px] font-bold uppercase tracking-wide text-primary">
              Menu modelli
            </p>
          </div>
          <div className="px-2.5 py-2">
            <p className="text-xs font-semibold text-gray-900">{menuLabel}</p>
            {menuDescription && (
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-default-500">
                {menuDescription}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MockLiveField({
  value,
  placeholder,
  active,
  multiline = false,
  compact = false,
}: {
  value: string;
  placeholder: string;
  active: boolean;
  multiline?: boolean;
  compact?: boolean;
}) {
  const isEmpty = !value.trim();
  const display = isEmpty ? placeholder : value;

  return (
    <div
      className={`mt-1.5 rounded-md border px-2 py-1.5 text-[11px] leading-relaxed transition-all whitespace-pre-wrap ${
        compact
          ? "min-h-[1.5rem] max-h-[1.5rem] overflow-hidden"
          : multiline
            ? "min-h-[2.5rem] max-h-[5rem] overflow-y-auto"
            : "min-h-[1.75rem]"
      } ${
        active
          ? isEmpty
            ? "border-primary/30 bg-white text-default-400 italic"
            : "border-primary/50 bg-white text-gray-800 shadow-inner"
          : "border-dashed border-default-200 bg-white/50 text-default-300"
      }`}
    >
      {display}
    </div>
  );
}

function VisitFormMock({
  visitLabel,
  activeSection,
  onSectionChange,
  preview,
  readOnly = false,
}: {
  visitLabel: string;
  activeSection: TemplateSection;
  onSectionChange: (section: TemplateSection) => void;
  preview: LivePreviewContent;
  readOnly?: boolean;
}) {
  const menuOpen = Boolean(preview.menuLabel.trim());
  const menuDisplay = preview.menuLabel.trim() || "Il tuo modello";
  const menuDesc = preview.fieldText.trim()
    ? preview.fieldText.length > 60
      ? `${preview.fieldText.slice(0, 60)}…`
      : preview.fieldText
    : undefined;

  return (
    <div className="rounded-xl border-2 border-primary/20 bg-default-50/80 shadow-sm">
      <div className="rounded-t-xl border-b border-default-200 bg-white px-3 py-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
          Anteprima live
        </p>
        <p className="text-xs font-semibold text-gray-800">
          {visitLabel} · Referto Medico
        </p>
      </div>
      <div className="space-y-1.5 overflow-visible p-3">
        {GINE_OBST_FIELDS.map((field) => {
          const isActive = field.section === activeSection;
          const isSelectable = field.hasModello && field.section;

          if (!isSelectable) {
            return (
              <div key={field.label} className="rounded-lg px-2 py-1 opacity-30">
                <span className="text-xs font-bold text-gray-600">{field.label}</span>
                <MockLiveField value="" placeholder="..." active={false} compact />
              </div>
            );
          }

          return (
            <button
              key={field.label}
              type="button"
              disabled={readOnly}
              onClick={() => field.section && onSectionChange(field.section)}
              className={`relative w-full rounded-lg border px-2.5 py-2 text-left transition-all ${
                readOnly ? "cursor-default" : "cursor-pointer"
              } ${
                isActive
                  ? "z-10 border-primary bg-primary-50/80 shadow-sm ring-2 ring-primary/25"
                  : "border-default-200 bg-white/60 opacity-70 hover:opacity-100"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`text-xs font-bold ${isActive ? "text-primary-900" : "text-gray-700"}`}
                >
                  {field.label}
                </span>
                <MockModelloControl
                  open={isActive && menuOpen}
                  menuLabel={menuDisplay}
                  menuDescription={menuDesc}
                  dropUp={field.section === "esameObiettivo" || field.section === "conclusioni"}
                />
              </div>
              <MockLiveField
                value={isActive ? preview.fieldText : ""}
                placeholder={
                  isActive
                    ? "Il testo comparirà qui quando selezioni il modello..."
                    : "..."
                }
                active={isActive}
                multiline={isActive}
                compact={!isActive}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EsameFormMock({ preview }: { preview: LivePreviewContent }) {
  const menuOpen = Boolean(preview.menuLabel.trim());
  const menuDisplay = preview.menuLabel.trim() || "Il tuo modello";

  return (
    <div className="rounded-xl border-2 border-primary/20 bg-default-50/80 shadow-sm">
      <div className="rounded-t-xl border-b border-default-200 bg-white px-3 py-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
          Anteprima live
        </p>
        <p className="text-xs font-semibold text-gray-800">
          Scheda paziente · Nuova richiesta esame
        </p>
      </div>
      <div className="space-y-2 p-3">
        <div className="flex justify-end">
          <MockModelloControl
            label="Modelli Esame"
            open={menuOpen}
            menuLabel={menuDisplay}
            menuDescription={preview.fieldNote?.trim() || undefined}
          />
        </div>
        <div className="rounded-lg border border-primary bg-primary-50/80 px-2.5 py-2 ring-2 ring-primary/20">
          <span className="text-xs font-bold text-primary-900">Esame richiesto</span>
          <MockLiveField
            value={preview.fieldText}
            placeholder="Il nome esame comparirà qui..."
            active
          />
        </div>
        <div className="rounded-lg px-2.5 py-2 opacity-40">
          <span className="text-xs font-bold text-gray-600">Note cliniche</span>
          <MockLiveField
            value={preview.fieldNote ?? ""}
            placeholder={preview.fieldNote?.trim() ? preview.fieldNote : "Note opzionali..."}
            active={Boolean(preview.fieldNote?.trim())}
          />
        </div>
      </div>
    </div>
  );
}

function CertificatoFormMock({ preview }: { preview: LivePreviewContent }) {
  const menuOpen = Boolean(preview.menuLabel.trim());
  const menuDisplay = preview.menuLabel.trim() || "Il tuo modello";

  return (
    <div className="rounded-xl border-2 border-primary/20 bg-default-50/80 shadow-sm">
      <div className="rounded-t-xl border-b border-default-200 bg-white px-3 py-2">
        <p className="text-[11px] font-bold uppercase tracking-wide text-primary">
          Anteprima live
        </p>
        <p className="text-xs font-semibold text-gray-800">
          Scheda paziente · Nuovo certificato
        </p>
      </div>
      <div className="space-y-2 p-3">
        <div className="flex justify-end">
          <MockModelloControl
            label="Modelli Certificato"
            open={menuOpen}
            menuLabel={menuDisplay}
            menuDescription={
              preview.fieldText.trim()
                ? preview.fieldText.length > 60
                  ? `${preview.fieldText.slice(0, 60)}…`
                  : preview.fieldText
                : undefined
            }
          />
        </div>
        <div className="rounded-lg border border-primary bg-primary-50/80 px-2.5 py-2 ring-2 ring-primary/20">
          <span className="text-xs font-bold text-primary-900">Descrizione certificato</span>
          <MockLiveField
            value={preview.fieldText}
            placeholder="Il testo del certificato comparirà qui..."
            active
            multiline
          />
        </div>
      </div>
    </div>
  );
}

function TemplatePlacementMap({
  category,
  section,
  onSectionChange,
  preview,
}: {
  category: TemplateCategory;
  section: TemplateSection;
  onSectionChange: (section: TemplateSection) => void;
  preview: LivePreviewContent;
}) {
  const activeSection = getPreviewSection(category, section);

  if (category === "ginecologia" || category === "ostetricia" || category === "terapie") {
    return (
      <VisitFormMock
        visitLabel={
          category === "terapie"
            ? "Visita ginecologica o ostetrica"
            : `Visita ${category === "ostetricia" ? "ostetrica" : "ginecologica"}`
        }
        activeSection={activeSection}
        onSectionChange={onSectionChange}
        preview={preview}
        readOnly={category === "terapie"}
      />
    );
  }

  if (category === "esame_complementare") {
    return <EsameFormMock preview={preview} />;
  }

  return <CertificatoFormMock preview={preview} />;
}

export type TemplateEditorModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialTemplate: Partial<MedicalTemplate>;
  onSave: (template: Partial<MedicalTemplate>) => void | Promise<void>;
  isSaving?: boolean;
};

export function TemplateEditorModal({
  isOpen,
  onClose,
  initialTemplate,
  onSave,
  isSaving = false,
}: TemplateEditorModalProps) {
  const [draft, setDraft] = useState<Partial<MedicalTemplate>>(initialTemplate);
  const [errors, setErrors] = useState<{ label?: string; text?: string }>({});

  useEffect(() => {
    if (!isOpen) return;
    setDraft({ ...initialTemplate });
    setErrors({});
  }, [isOpen, initialTemplate]);

  const category = (draft.category ?? "ginecologia") as TemplateCategory;
  const sectionOptions = SECTIONS_BY_CATEGORY[category];
  const section = (draft.section ?? DEFAULT_SECTION[category]) as TemplateSection;
  const isEditing = Boolean(draft.id);
  const canPickSection = sectionOptions.length > 1 && category !== "terapie";

  const preview: LivePreviewContent = {
    menuLabel: draft.label ?? "",
    fieldText: draft.text ?? "",
    fieldNote: draft.note,
  };

  const updateCategory = (nextCategory: TemplateCategory) => {
    const allowedSections = SECTIONS_BY_CATEGORY[nextCategory];
    const nextSection = allowedSections.includes(section)
      ? section
      : DEFAULT_SECTION[nextCategory];
    setDraft((prev) => ({
      ...prev,
      category: nextCategory,
      section: nextSection,
    }));
  };

  const validate = () => {
    const nextErrors: { label?: string; text?: string } = {};
    if (!draft.label?.trim()) {
      nextErrors.label = "Inserisci un nome breve per il menu";
    }
    if (!draft.text?.trim()) {
      nextErrors.text = "Inserisci il testo del modello";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    await onSave({
      ...draft,
      label: draft.label!.trim(),
      text: draft.text!.trim(),
      note: draft.note?.trim() || undefined,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      scrollBehavior="inside"
      classNames={{
        base: "max-h-[90vh]",
        header: "border-b border-default-200",
        footer: "border-t border-default-200",
      }}
    >
      <ModalContent>
        <ModalHeader className="flex flex-col gap-2 pb-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-lg bg-primary-100 p-2">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-gray-900">
                {isEditing ? "Modifica modello" : "Nuovo modello referto"}
              </h2>
              <p className="mt-0.5 text-sm font-normal text-default-500">
                Scegli dove va, scrivi sotto e guarda l&apos;anteprima aggiornarsi.
              </p>
            </div>
          </div>
        </ModalHeader>

        <ModalBody className="gap-5 py-6" onContextMenu={(e) => e.stopPropagation()}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Tipo"
              selectedKeys={[category]}
              onSelectionChange={(keys) => {
                const value = Array.from(keys)[0] as TemplateCategory | undefined;
                if (value) updateCategory(value);
              }}
              variant="bordered"
            >
              {(Object.keys(CATEGORY_LABELS) as TemplateCategory[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {CATEGORY_LABELS[key]}
                </SelectItem>
              ))}
            </Select>
            {canPickSection ? (
              <Select
                label="Sezione del referto"
                selectedKeys={[getPreviewSection(category, section)]}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as TemplateSection | undefined;
                  if (value) setDraft((prev) => ({ ...prev, section: value }));
                }}
                variant="bordered"
              >
                <SelectItem key="prestazione" value="prestazione">
                  1. Anamnesi
                </SelectItem>
                <SelectItem key="esameObiettivo" value="esameObiettivo">
                  3. Visita / Ecografia Office
                </SelectItem>
                <SelectItem key="conclusioni" value="conclusioni">
                  4. Conclusioni e Terapie
                </SelectItem>
              </Select>
            ) : (
              <div className="flex flex-col justify-end rounded-xl border border-default-200 bg-default-50 px-3 py-2.5">
                <p className="text-xs text-default-500">Sezione</p>
                <p className="text-sm font-medium text-default-800">
                  {category === "terapie"
                    ? "4. Conclusioni e Terapie"
                    : category === "esame_complementare"
                      ? "Richiesta esame"
                      : "Certificato"}
                </p>
              </div>
            )}
          </div>

          <TemplatePlacementMap
            category={category}
            section={section}
            onSectionChange={(nextSection) =>
              setDraft((prev) => ({ ...prev, section: nextSection }))
            }
            preview={preview}
          />

          <Divider />

          <section className="space-y-4">
            <p className="text-xs text-default-500">
              Compila qui: l&apos;anteprima sopra si aggiorna in tempo reale.
            </p>

            <Input
              autoFocus={!isEditing}
              label="Nome in menu"
              placeholder={
                category === "esame_complementare"
                  ? "Es. Emocromo, Eco addome..."
                  : "Es. EO negativo, Terapia standard..."
              }
              value={draft.label ?? ""}
              onValueChange={(val) => {
                setDraft((prev) => ({ ...prev, label: val }));
                if (errors.label) setErrors((prev) => ({ ...prev, label: undefined }));
              }}
              variant="bordered"
              isRequired
              isInvalid={Boolean(errors.label)}
              errorMessage={errors.label}
              description="Apre il menu Modello con questo titolo"
            />

            <RefertoTextarea
              label={getContentLabel(category)}
              placeholder={getContentPlaceholder(category)}
              value={draft.text ?? ""}
              onValueChange={(val: string) => {
                setDraft((prev) => ({ ...prev, text: val }));
                if (errors.text) setErrors((prev) => ({ ...prev, text: undefined }));
              }}
              variant="bordered"
              minRows={category === "certificato" ? 5 : category === "esame_complementare" ? 2 : 4}
              isInvalid={Boolean(errors.text)}
              errorMessage={errors.text}
              description="Compare nel campo evidenziato nell'anteprima"
              spellCheck
            />

            {category === "esame_complementare" && (
              <RefertoTextarea
                label="Note (opzionale)"
                placeholder="Es. digiuno, urgenza, dettagli clinici..."
                value={draft.note ?? ""}
                onValueChange={(val: string) => setDraft((prev) => ({ ...prev, note: val }))}
                variant="bordered"
                minRows={2}
                description="Compaiono nel campo Note dell'anteprima"
                spellCheck
              />
            )}
          </section>
        </ModalBody>

        <ModalFooter>
          <Button variant="flat" onPress={onClose} isDisabled={isSaving}>
            Annulla
          </Button>
          <Button
            color="primary"
            className="corioli-cta"
            onPress={() => void handleSave()}
            isLoading={isSaving}
          >
            {isEditing ? "Salva modifiche" : "Crea modello"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
