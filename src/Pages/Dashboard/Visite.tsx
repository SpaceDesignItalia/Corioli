import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardBody,
  Input,
  Button,
  Chip,
  Spinner,
  Pagination,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Divider,
  useDisclosure,
  Select,
  SelectItem
} from "@nextui-org/react";
import { FileText, ChevronRight, Plus, Calendar, Eye } from "lucide-react";
import { PatientService, VisitService, PreferenceService } from "../../services/OfflineServices";
import { Visit } from "../../types/Storage";
import { PageHeader } from "../../components/PageHeader";
import { calcolaStimePesoFetale } from "../../utils/fetalWeightUtils";

// Helper for search icon
const SearchIcon = (props: any) => (
  <svg
    aria-hidden="true"
    fill="none"
    focusable="false"
    height="1em"
    role="presentation"
    viewBox="0 0 24 24"
    width="1em"
    {...props}
  >
    <path
      d="M11.5 21C16.7467 21 21 16.7467 21 11.5C21 6.25329 16.7467 2 11.5 2C6.25329 2 2 6.25329 2 11.5C2 16.7467 6.25329 21 11.5 21Z"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
    <path
      d="M22 22L20 20"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
    />
  </svg>
);

interface EnrichedVisit extends Visit {
  patientName: string;
  patientCf: string;
}

export default function Visite() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [visits, setVisits] = useState<EnrichedVisit[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<EnrichedVisit | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterTipo, setFilterTipo] = useState<string>("tutti");
  const [page, setPage] = useState(1);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [fetalFormula, setFetalFormula] = useState("hadlock4");
  const rowsPerPage = 10;

  useEffect(() => {
    PreferenceService.getPreferences()
      .then((prefs) => {
        if (prefs?.formulaPesoFetale) setFetalFormula(prefs.formulaPesoFetale as string);
      })
      .catch(() => {});
  }, [isOpen]); // Reload when modal opens

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [allVisits, allPatients] = await Promise.all([
          VisitService.getAllVisits(),
          PatientService.getAllPatients(),
        ]);

        const patientMap = new Map(allPatients.map((p) => [p.id, p]));

        const enriched = allVisits.map((v) => {
          const p = patientMap.get(v.patientId);
          return {
            ...v,
            patientName: p ? `${p.nome} ${p.cognome}` : "Paziente Sconosciuto",
            patientCf: p?.codiceFiscale || ""
          };
        });

        // Sort by date desc
        enriched.sort((a, b) => new Date(b.dataVisita).getTime() - new Date(a.dataVisita).getTime());

        setVisits(enriched);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filteredVisits = useMemo(() => {
    const term = searchTerm.toLowerCase();
    let list = visits.filter(v =>
      v.patientName.toLowerCase().includes(term) ||
      v.patientCf.toLowerCase().includes(term) ||
      v.descrizioneClinica?.toLowerCase().includes(term) ||
      v.dataVisita.includes(term)
    );
    if (filterTipo !== "tutti") {
      list = list.filter(v => v.tipo === filterTipo);
    }
    if (filterDateFrom) {
      list = list.filter(v => v.dataVisita >= filterDateFrom);
    }
    if (filterDateTo) {
      list = list.filter(v => v.dataVisita <= filterDateTo);
    }
    return list;
  }, [visits, searchTerm, filterTipo, filterDateFrom, filterDateTo]);

  const items = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    return filteredVisits.slice(start, end);
  }, [page, filteredVisits]);

  const totalPages = Math.ceil(filteredVisits.length / rowsPerPage);

  const openPreview = (visit: EnrichedVisit) => {
    setSelectedVisit(visit);
    onOpen();
  };

  const getVisitTypeLabel = (tipo?: Visit["tipo"]) => {
    if (tipo === "ginecologica") return "Ginecologia";
    if (tipo === "ginecologica_pediatrica") return "Ginecologia Pediatrica";
    if (tipo === "ostetrica") return "Ostetricia";
    return "Generale";
  };

  const formatDate = (date: string) => {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return date;
    return parsed.toLocaleDateString("it-IT");
  };

  const formatMultiLine = (value?: string) => {
    if (!value || !value.trim()) return "Non compilato";
    return value;
  };

  const renderEcografiaImages = (images?: string[]) => {
    if (!images || images.length === 0) return null;
    return (
      <Card shadow="sm">
        <CardBody className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-gray-500">Immagini ecografia</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {images.map((image, index) => (
              <a
                key={`ecografia-${index}`}
                href={image}
                target="_blank"
                rel="noreferrer"
                className="block border border-gray-200 rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
              >
                <img
                  src={image}
                  alt={`Ecografia ${index + 1}`}
                  className="w-full h-28 object-cover"
                />
              </a>
            ))}
          </div>
        </CardBody>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner size="lg" color="primary" />
      </div>
    );
  }

  const HeaderActions = (
    <Button
      color="primary"
      startContent={<Plus size={18} />}
      onPress={() => navigate("/check-patient")}
      className="shadow-md shadow-primary/20"
    >
      Nuova Visita
    </Button>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <PageHeader
        title="Gestione Visite"
        subtitle="Visualizza lo storico completo delle visite effettuate."
        icon={Calendar}
        iconColor="primary"
        actions={HeaderActions}
      />

      <Card className="shadow-sm">
        <CardBody className="p-4 gap-4">
          <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
            <Input
              isClearable
              className="w-full sm:max-w-[280px]"
              placeholder="Cerca per nome, CF o data..."
              startContent={<SearchIcon className="text-default-300" />}
              value={searchTerm}
              onValueChange={setSearchTerm}
              onClear={() => setSearchTerm("")}
              variant="bordered"
            />
            <Select
              className="w-full sm:max-w-[180px]"
              label="Tipo visita"
              selectedKeys={filterTipo === "tutti" ? ["tutti"] : [filterTipo]}
              onSelectionChange={(keys) => setFilterTipo(Array.from(keys)[0] as string)}
              variant="bordered"
            >
              <SelectItem key="tutti">Tutti</SelectItem>
              <SelectItem key="ginecologica">Ginecologica</SelectItem>
              <SelectItem key="ginecologica_pediatrica">Ginecologica Pediatrica</SelectItem>
              <SelectItem key="ostetrica">Ostetrica</SelectItem>
            </Select>
            <Input
              type="date"
              className="w-full sm:max-w-[160px]"
              label="Da data"
              value={filterDateFrom}
              onValueChange={setFilterDateFrom}
              variant="bordered"
            />
            <Input
              type="date"
              className="w-full sm:max-w-[160px]"
              label="A data"
              value={filterDateTo}
              onValueChange={setFilterDateTo}
              variant="bordered"
            />
          </div>
        </CardBody>
      </Card>

      <Card className="shadow-md">
        <CardBody className="p-0">
          {filteredVisits.length > 0 ? (
            <div className="divide-y divide-gray-100">
              <div className="grid grid-cols-12 gap-4 p-4 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <div className="col-span-3">Paziente</div>
                <div className="col-span-2">Data</div>
                <div className="col-span-2">Tipo</div>
                <div className="col-span-4">Descrizione</div>
                <div className="col-span-1 text-right">Azioni</div>
              </div>

              {items.map((visit) => (
                <div
                  key={visit.id}
                  className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => openPreview(visit)}
                >
                  <div className="col-span-3">
                    <p className="font-semibold text-gray-900 truncate">{visit.patientName}</p>
                    <p className="text-xs text-gray-500 font-mono truncate">{visit.patientCf}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm text-gray-600">{new Date(visit.dataVisita).toLocaleDateString("it-IT")}</span>
                  </div>
                  <div className="col-span-2">
                    <Chip
                      size="sm"
                      variant="flat"
                      color={(visit.tipo === 'ginecologica' || visit.tipo === 'ginecologica_pediatrica') ? 'secondary' : visit.tipo === 'ostetrica' ? 'warning' : 'primary'}
                      className="capitalize"
                    >
                      {visit.tipo}
                    </Chip>
                  </div>
                  <div className="col-span-4">
                    <p className="text-sm text-gray-500 truncate">{visit.descrizioneClinica || "Nessuna descrizione"}</p>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <div className="flex items-center gap-1">
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onClick={(e) => {
                          e.stopPropagation();
                          openPreview(visit);
                        }}
                        aria-label="Visualizza visita"
                      >
                        <Eye size={16} className="text-gray-500" />
                      </Button>
                      <Button
                        isIconOnly
                        size="sm"
                        variant="light"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/edit-visit/${visit.id}`);
                        }}
                        aria-label="Modifica visita"
                      >
                      <ChevronRight size={18} className="text-gray-400" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <FileText size={48} className="mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Nessuna visita trovata</p>
              <p className="text-sm mt-1">Prova a modificare i filtri di ricerca.</p>
            </div>
          )}
        </CardBody>

        {totalPages > 1 && (
          <div className="flex justify-center p-4 border-t border-gray-100">
            <Pagination
              total={totalPages}
              page={page}
              onChange={setPage}
              color="primary"
              variant="light"
              showControls
            />
          </div>
        )}
      </Card>

      <Modal
        isOpen={isOpen}
        onClose={onClose}
        size="5xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          {selectedVisit && (
            <>
              <ModalHeader className="flex flex-col gap-1">
                <div className="flex items-center justify-between w-full gap-3">
                  <div>
                    <h2 className="text-xl font-bold">
                      Dettaglio Visita - {selectedVisit.patientName}
                    </h2>
                    <p className="text-sm text-gray-500">
                      {formatDate(selectedVisit.dataVisita)}
                    </p>
                  </div>
                  <Chip
                    variant="flat"
                    color={
                      selectedVisit.tipo === "ginecologica"
                        ? "secondary"
                        : selectedVisit.tipo === "ostetrica"
                          ? "warning"
                          : "primary"
                    }
                  >
                    {getVisitTypeLabel(selectedVisit.tipo)}
                  </Chip>
                </div>
              </ModalHeader>
              <ModalBody>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <Card shadow="sm">
                    <CardBody className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Descrizione clinica</p>
                      <p className="text-sm whitespace-pre-wrap">{formatMultiLine(selectedVisit.descrizioneClinica)}</p>
                    </CardBody>
                  </Card>

                  <Card shadow="sm">
                    <CardBody className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Anamnesi</p>
                      <p className="text-sm whitespace-pre-wrap">{formatMultiLine(selectedVisit.anamnesi)}</p>
                    </CardBody>
                  </Card>

                  <Card shadow="sm">
                    <CardBody className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Esame obiettivo</p>
                      <p className="text-sm whitespace-pre-wrap">{formatMultiLine(selectedVisit.esamiObiettivo)}</p>
                    </CardBody>
                  </Card>

                  <Card shadow="sm">
                    <CardBody className="space-y-2">
                      <p className="text-xs uppercase tracking-wide text-gray-500">Conclusioni / Diagnosi</p>
                      <p className="text-sm whitespace-pre-wrap">{formatMultiLine(selectedVisit.conclusioniDiagnostiche)}</p>
                    </CardBody>
                  </Card>
                </div>

                <Card shadow="sm">
                  <CardBody className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-gray-500">Terapie</p>
                    <p className="text-sm whitespace-pre-wrap">{formatMultiLine(selectedVisit.terapie)}</p>
                  </CardBody>
                </Card>

                {(selectedVisit.tipo === "ginecologica" || selectedVisit.tipo === "ginecologica_pediatrica") && selectedVisit.ginecologia && (
                  <>
                    <Divider />
                    <Card shadow="sm" className="bg-pink-50/60">
                      <CardBody className="space-y-3">
                        <p className="text-xs uppercase tracking-wide text-pink-700">Dettagli ginecologici</p>
                        {selectedVisit.tipo === "ginecologica_pediatrica" ? (
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                            <p><span className="font-medium">Menarca:</span> {selectedVisit.ginecologia.menarca || "Non compilato"}</p>
                            <p><span className="font-medium">Vaccinazione HPV:</span> {selectedVisit.ginecologia.vaccinazioneHPV ? "Si" : "No"}</p>
                            <p><span className="font-medium">Stadio di Tanner (femmina):</span> {selectedVisit.ginecologia.stadioTannerFemmina || "Non compilato"}</p>
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                              <p><span className="font-medium">Gravidanze:</span> {selectedVisit.ginecologia.gravidanze}</p>
                              <p><span className="font-medium">Parti:</span> {selectedVisit.ginecologia.parti}</p>
                              <p><span className="font-medium">Aborti:</span> {selectedVisit.ginecologia.aborti}</p>
                            </div>
                            {selectedVisit.ginecologia.ultimaMestruazione && (
                              <p className="text-sm">
                                <span className="font-medium">Ultima mestruazione:</span> {formatDate(selectedVisit.ginecologia.ultimaMestruazione)}
                              </p>
                            )}
                          </>
                        )}
                      </CardBody>
                    </Card>
                    {renderEcografiaImages(selectedVisit.ginecologia.ecografiaImmagini)}
                  </>
                )}

                {selectedVisit.ostetricia && (
                  <>
                    <Divider />
                    <Card shadow="sm" className="bg-purple-50/60">
                      <CardBody className="space-y-3">
                        <p className="text-xs uppercase tracking-wide text-purple-700">Dettagli ostetrici</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                          <p><span className="font-medium">Settimane di gestazione:</span> {selectedVisit.ostetricia.settimaneGestazione || "Non compilato"}</p>
                          <p><span className="font-medium">DPP:</span> {selectedVisit.ostetricia.dataPresunta ? formatDate(selectedVisit.ostetricia.dataPresunta) : "Non compilato"}</p>
                          <p><span className="font-medium">Peso attuale:</span> {selectedVisit.ostetricia.pesoAttuale || 0} kg</p>
                          <p><span className="font-medium">Battiti fetali:</span> {selectedVisit.ostetricia.battitiFetali || "Non compilato"}</p>
                        </div>
                      </CardBody>
                    </Card>

                    {selectedVisit.ostetricia.biometriaFetale && (() => {
                      const bio = selectedVisit.ostetricia!.biometriaFetale!;
                      const hasMisura = (bio.bpdMm > 0 || bio.hcMm > 0 || bio.acMm > 0 || bio.flMm > 0);
                      if (!hasMisura) return null;
                      const scale = calcolaStimePesoFetale(bio);
                      const result = scale[fetalFormula as keyof typeof scale];
                      
                      return (
                        <Card shadow="sm" className="bg-purple-50/30 border border-purple-100">
                          <CardBody className="space-y-3">
                            <p className="text-xs uppercase tracking-wide text-purple-700">BIOMETRIA FETALE</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm mb-3">
                              {bio.bpdMm > 0 && <p><span className="font-medium">DBP:</span> {bio.bpdMm} mm</p>}
                              {bio.hcMm > 0 && <p><span className="font-medium">CC:</span> {bio.hcMm} mm</p>}
                              {bio.acMm > 0 && <p><span className="font-medium">CA:</span> {bio.acMm} mm</p>}
                              {bio.flMm > 0 && <p><span className="font-medium">FL:</span> {bio.flMm} mm</p>}
                            </div>
                            
                            <div className="bg-white/60 rounded-lg border border-purple-100 p-3 flex justify-between items-center">
                              <div>
                                <p className="text-sm font-semibold text-purple-900">
                                  Peso Fetale Stimato
                                  <span className="text-purple-600 font-normal ml-1">
                                    {result?.nome || fetalFormula}
                                  </span>
                                </p>
                              </div>
                              <div>
                                {result && result.calcolabile ? (
                                  <p className="text-xl font-bold text-purple-800">{result.pesoGrammi} g</p>
                                ) : (
                                  <p className="text-sm text-gray-500">Dati insufficienti</p>
                                )}
                              </div>
                            </div>
                          </CardBody>
                        </Card>
                      );
                    })()}

                    {renderEcografiaImages(selectedVisit.ostetricia.ecografiaImmagini)}
                  </>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Chiudi
                </Button>
                <Button
                  color="primary"
                  onPress={() => {
                    onClose();
                    navigate(`/edit-visit/${selectedVisit.id}`);
                  }}
                >
                  Modifica
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
