import React, { useState, useEffect } from 'react';
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Chip,
  Divider,
  Progress
} from '@nextui-org/react';
import {
  Download,
  FileText,
  FileSpreadsheet,
  Database,
  BarChart3
} from 'lucide-react';
import { ExportService } from '../services/ExportService';

const ExportManager: React.FC = () => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    try {
      const statistics = await ExportService.getStatistics();
      setStats(statistics);
    } catch (error) {
      console.error('Errore nel caricamento statistiche:', error);
    }
  };

  const handleExportJSON = async () => {
    setIsLoading(true);
    try {
      await ExportService.exportAllDataAsJSON();
      setMessage({ text: 'Export JSON completato con successo!', type: 'success' });
    } catch (error) {
      setMessage({ text: 'Errore durante l\'export JSON', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportPatientsCSV = async () => {
    setIsLoading(true);
    try {
      await ExportService.exportPatientsAsCSV();
      setMessage({ text: 'Export pazienti CSV completato!', type: 'success' });
    } catch (error) {
      setMessage({ text: 'Errore durante l\'export pazienti CSV', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportVisitsCSV = async () => {
    setIsLoading(true);
    try {
      await ExportService.exportVisitsAsCSV();
      setMessage({ text: 'Export visite CSV completato!', type: 'success' });
    } catch (error) {
      setMessage({ text: 'Errore durante l\'export visite CSV', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportReportPDF = async () => {
    setIsLoading(true);
    try {
      await ExportService.exportCompleteReportAsPDF();
      setMessage({ text: 'Report PDF generato con successo!', type: 'success' });
    } catch (error) {
      setMessage({ text: 'Errore durante la generazione del report PDF', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button onPress={onOpen} color="primary" variant="flat" startContent={<Download size={16} />}>
        Export Dati
      </Button>

      <Modal isOpen={isOpen} onClose={onClose} size="3xl">
        <ModalContent>
          <ModalHeader>
            <h2 className="text-xl font-bold">Export Dati Pazienti e Visite</h2>
          </ModalHeader>
          <ModalBody>
            {/* Statistiche */}
            {stats && (
              <Card className="mb-6">
                <CardHeader>
                  <h3 className="font-semibold flex items-center gap-2">
                    <BarChart3 size={18} />
                    Statistiche Database
                  </h3>
                </CardHeader>
                <CardBody>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-primary">{stats.totalPatients}</div>
                      <div className="text-sm text-gray-600">Pazienti</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-secondary">{stats.totalVisits}</div>
                      <div className="text-sm text-gray-600">Visite</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-success">{stats.visitsThisMonth}</div>
                      <div className="text-sm text-gray-600">Questo Mese</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-warning">{stats.averageAge}</div>
                      <div className="text-sm text-gray-600">Età Media</div>
                    </div>
                  </div>
                  
                  <Divider className="my-4" />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="font-medium mb-2">Distribuzione Genere</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Maschi:</span>
                          <Chip size="sm" color="primary">{stats.malePatients}</Chip>
                        </div>
                        <div className="flex justify-between">
                          <span>Femmine:</span>
                          <Chip size="sm" color="secondary">{stats.femalePatients}</Chip>
                        </div>
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Visite per Tipo</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span>Generali:</span>
                          <Chip size="sm">{stats.visitsPerType.generale}</Chip>
                        </div>
                        <div className="flex justify-between">
                          <span>Ginecologiche:</span>
                          <Chip size="sm" color="primary">{stats.visitsPerType.ginecologica}</Chip>
                        </div>
                        <div className="flex justify-between">
                          <span>Ostetriche:</span>
                          <Chip size="sm" color="secondary">{stats.visitsPerType.ostetrica}</Chip>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardBody>
              </Card>
            )}

            {/* Opzioni Export */}
            <div className="space-y-4">
              <h3 className="font-semibold">Scegli Formato Export</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Export JSON Completo */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardBody className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Database className="w-8 h-8 text-primary" />
                      <div>
                        <h4 className="font-semibold">Export Completo JSON</h4>
                        <p className="text-sm text-gray-600">Tutti i dati per backup</p>
                      </div>
                    </div>
                    <Button
                      color="primary"
                      variant="flat"
                      onPress={handleExportJSON}
                      isLoading={isLoading}
                      className="w-full"
                      startContent={<Download size={16} />}
                    >
                      Scarica JSON
                    </Button>
                  </CardBody>
                </Card>

                {/* Export Report PDF */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardBody className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <FileText className="w-8 h-8 text-danger" />
                      <div>
                        <h4 className="font-semibold">Report PDF</h4>
                        <p className="text-sm text-gray-600">Report completo stampabile</p>
                      </div>
                    </div>
                    <Button
                      color="danger"
                      variant="flat"
                      onPress={handleExportReportPDF}
                      isLoading={isLoading}
                      className="w-full"
                      startContent={<FileText size={16} />}
                    >
                      Genera Report
                    </Button>
                  </CardBody>
                </Card>

                {/* Export Pazienti CSV */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardBody className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <FileSpreadsheet className="w-8 h-8 text-success" />
                      <div>
                        <h4 className="font-semibold">Pazienti CSV</h4>
                        <p className="text-sm text-gray-600">Elenco pazienti per Excel</p>
                      </div>
                    </div>
                    <Button
                      color="success"
                      variant="flat"
                      onPress={handleExportPatientsCSV}
                      isLoading={isLoading}
                      className="w-full"
                      startContent={<FileSpreadsheet size={16} />}
                    >
                      Export Pazienti
                    </Button>
                  </CardBody>
                </Card>

                {/* Export Visite CSV */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardBody className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <FileSpreadsheet className="w-8 h-8 text-warning" />
                      <div>
                        <h4 className="font-semibold">Visite CSV</h4>
                        <p className="text-sm text-gray-600">Elenco visite per Excel</p>
                      </div>
                    </div>
                    <Button
                      color="warning"
                      variant="flat"
                      onPress={handleExportVisitsCSV}
                      isLoading={isLoading}
                      className="w-full"
                      startContent={<FileSpreadsheet size={16} />}
                    >
                      Export Visite
                    </Button>
                  </CardBody>
                </Card>
              </div>

              {message && (
                <Card className={`border-l-4 ${message.type === 'success' ? 'border-l-success' : 'border-l-danger'}`}>
                  <CardBody className="py-3">
                    <p className={`text-sm ${message.type === 'success' ? 'text-success' : 'text-danger'}`}>
                      {message.text}
                    </p>
                  </CardBody>
                </Card>
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button color="danger" variant="light" onPress={onClose}>
              Chiudi
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};

export default ExportManager;
