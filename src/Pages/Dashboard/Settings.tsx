import React, { useState, useEffect, useMemo } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  Button,
  Select,
  SelectItem,
  Switch,
  Avatar,
  Divider,
  Input,
  Chip,
  Textarea,
  Tabs,
  Tab,
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Progress,
} from "@nextui-org/react";
import {
  User,
  Users,
  Search,
  Download,
  Upload,
  Settings as SettingsIcon,
  FileText,
  Plus,
  Trash2,
  Edit,
} from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import BackupManager from "../../components/BackupManager";
import { CodiceFiscaleValue } from "../../components/CodiceFiscaleValue";
import {
  DoctorService,
  TemplateService,
  PatientService,
  VisitService,
} from "../../services/OfflineServices";
import { MedicalTemplate } from "../../types/Storage";

const SettingsScreen = () => {
  // ... state declarations ...
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [pdfTheme, setPdfTheme] = useState("light");
  const [profilePic, setProfilePic] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [doctorInfo, setDoctorInfo] = useState({
    nome: "",
    cognome: "",
    email: "",
    telefono: "",
    specializzazione: "",
  });

  // Template State
  const [templates, setTemplates] = useState<MedicalTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] =
    useState<string>("ginecologia");
  const {
    isOpen: isTemplateModalOpen,
    onOpen: onTemplateModalOpen,
    onClose: onTemplateModalClose,
  } = useDisclosure();
  const [currentTemplate, setCurrentTemplate] = useState<
    Partial<MedicalTemplate>
  >({
    label: "",
    text: "",
    category: "ginecologia",
    section: "prestazione",
  });

  const [ambulatori, setAmbulatori] = useState<any[]>([]);
  const [savingAmbulatori, setSavingAmbulatori] = useState(false);

  const [patientCount, setPatientCount] = useState(0);
  const [visitCount, setVisitCount] = useState(0);

  const [newAmbulatorio, setNewAmbulatorio] = useState({
    nome: "",
    indirizzo: "",
    citta: "",
    cap: "",
    telefono: "",
    email: "",
    isPrimario: false,
  });

  const [preferences, setPreferences] = useState({
    nuoviPazienti: true,
    visiteCompletate: true,
    promemoriGiornalieri: false,
    modalitaCompatta: false,
    animazioniRidotte: false,
    visitaGinecologicaPediatricaEnabled: false,
    formulaPesoFetale: 'hadlock4' // hadlock4, shepard, hadlock3
  });
  const [duplicateGroups, setDuplicateGroups] = useState<
    Array<{ key: string; patients: any[] }>
  >([]);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);
  const [processingDuplicateId, setProcessingDuplicateId] = useState<
    string | null
  >(null);
  const [processingDuplicateGroupKey, setProcessingDuplicateGroupKey] =
    useState<string | null>(null);
  const [duplicateSearch, setDuplicateSearch] = useState("");
  const [duplicateCheckProgress, setDuplicateCheckProgress] = useState<{
    current: number;
    total: number;
  } | null>(null);
  const [mergeConflictOpen, setMergeConflictOpen] = useState(false);
  const [mergeConflictData, setMergeConflictData] = useState<{
    groupKey: string;
    target: any;
    sources: any[];
    conflictFields: Array<{
      key: string;
      label: string;
      options: string[];
      defaultValue: string;
      generatedByValue?: Record<string, boolean>;
    }>;
    basePayload: Record<string, any>;
  } | null>(null);
  const [mergeSelections, setMergeSelections] = useState<
    Record<string, string>
  >({});

  const handleNotificationsToggle = () => {
    setNotificationsEnabled(!notificationsEnabled);
  };

  const [cropImageOpen, setCropImageOpen] = useState(false);
  const [cropImageDataUrl, setCropImageDataUrl] = useState("");
  const [cropOffset, setCropOffset] = useState({ x: 0, y: 0 });
  const cropDragRef = React.useRef<{
    startX: number;
    startY: number;
    startOffset: { x: number; y: number };
  } | null>(null);

  const handleProfilePicChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = (reader.result as string) || "";
      setCropImageDataUrl(dataUrl);
      setCropOffset({ x: 0, y: 0 });
      setCropImageOpen(true);
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  useEffect(() => {
    if (!cropImageOpen) return;
    const onMove = (e: MouseEvent) => {
      if (!cropDragRef.current) return;
      const { startX, startY, startOffset } = cropDragRef.current;
      setCropOffset({
        x: startOffset.x + (e.clientX - startX),
        y: startOffset.y + (e.clientY - startY),
      });
    };
    const onUp = () => {
      cropDragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [cropImageOpen]);

  const applyCrop = () => {
    if (!cropImageDataUrl) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const D = 256;
      const canvas = document.createElement("canvas");
      canvas.width = D;
      canvas.height = D;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const scale = Math.max(D / img.width, D / img.height);
      const sw = D / scale;
      const sh = D / scale;
      let sx = -cropOffset.x / scale;
      let sy = -cropOffset.y / scale;
      sx = Math.max(0, Math.min(img.width - sw, sx));
      sy = Math.max(0, Math.min(img.height - sh, sy));
      ctx.beginPath();
      ctx.arc(D / 2, D / 2, D / 2, 0, 2 * Math.PI);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, D, D);
      setProfilePic(canvas.toDataURL("image/jpeg", 0.9));
      setCropImageOpen(false);
      setCropImageDataUrl("");
    };
    img.src = cropImageDataUrl;
  };

  // Carica dati iniziali
  useEffect(() => {
    loadDoctorData();
    loadPreferences();
    loadTemplates();
  }, []);

  useEffect(() => {
    const loadCounts = async () => {
      try {
        const [patients, visits] = await Promise.all([
          PatientService.getAllPatients(),
          VisitService.getAllVisits(),
        ]);
        setPatientCount(patients.length);
        setVisitCount(visits.length);
      } catch {
        // ignore
      }
    };
    loadCounts();
  }, []);

  const loadTemplates = async () => {
    try {
      const allTemplates = await TemplateService.getAllTemplates();
      setTemplates(allTemplates);
    } catch (e) {
      console.error("Errore caricamento template", e);
    }
  };

  const handleEditTemplate = (template: MedicalTemplate) => {
    setCurrentTemplate(template);
    onTemplateModalOpen();
  };

  const handleNewTemplate = () => {
    const sectionByCategory: Record<string, string> = {
      ginecologia: "prestazione",
      ostetricia: "prestazione",
      terapie: "generale",
      esame_complementare: "nome",
    };
    setCurrentTemplate({
      label: "",
      text: "",
      category: selectedCategory,
      section: (sectionByCategory[selectedCategory] ?? "prestazione") as any,
    });
    onTemplateModalOpen();
  };

  const handleSaveTemplate = async () => {
    try {
      if (currentTemplate.id) {
        await TemplateService.updateTemplate(
          currentTemplate.id,
          currentTemplate,
        );
      } else {
        await TemplateService.addTemplate(
          currentTemplate as Omit<MedicalTemplate, "id">,
        );
      }
      await loadTemplates();
      onTemplateModalClose();
      setSuccess("Modello salvato con successo");
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      setError("Errore salvataggio template");
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (confirm("Sei sicuro di voler eliminare questo modello?")) {
      try {
        await TemplateService.deleteTemplate(id);
        await loadTemplates();
        setSuccess("Modello eliminato");
        setTimeout(() => setSuccess(null), 3000);
      } catch (e) {
        setError("Errore eliminazione template");
      }
    }
  };

  const loadDoctorData = async () => {
    try {
      const doctor = await DoctorService.getDoctor();
      if (doctor) {
        setDoctorInfo({
          nome: doctor.nome,
          cognome: doctor.cognome,
          email: doctor.email,
          telefono: doctor.telefono || "",
          specializzazione: doctor.specializzazione || "",
        });
        setAmbulatori(doctor.ambulatori || []);
        // Force read of profileImage bypassing potential type issues
        const img = (doctor as any).profileImage;
        if (img) setProfilePic(img);
      }
    } catch (error) {
      console.error("Errore nel caricamento dati dottore:", error);
    }
  };

  const loadPreferences = () => {
    const savedPrefs = localStorage.getItem("AppDottori_preferences");
    if (savedPrefs) {
      try {
        const prefs = JSON.parse(savedPrefs);
        setPreferences((prev) => ({ ...prev, ...prefs }));
        setNotificationsEnabled(prefs.notificationsEnabled ?? true);
        setPdfTheme(prefs.pdfTheme ?? "light");
      } catch (error) {
        console.error("Errore nel caricamento preferenze:", error);
      }
    }
  };

  const savePreferences = () => {
    const prefs = {
      ...preferences,
      notificationsEnabled,
      pdfTheme,
    };
    localStorage.setItem("AppDottori_preferences", JSON.stringify(prefs));
  };

  useEffect(() => {
    savePreferences();
  }, [preferences, notificationsEnabled, pdfTheme]);

  const handleDoctorInfoChange = (field: string, value: string) => {
    setDoctorInfo((prev) => ({ ...prev, [field]: value }));
  };

  const handlePreferenceChange = (field: string, value: boolean | string) => {
    setPreferences(prev => ({ ...prev, [field]: value }));
  };

  const normalizeName = (value: string) =>
    (value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z\s]/g, "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  const normalizeSearchText = (value: string) =>
    (value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();

  const normalizeFieldValue = (field: string, value: string) => {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (field === "telefono") return raw.replace(/[^\d+]/g, "");
    if (field === "email") return raw.toLowerCase();
    if (field === "codiceFiscale") return raw.toUpperCase();
    if (field === "dataNascita") return raw;
    return raw.toLowerCase();
  };

  const uniqueValues = (values: string[]) => {
    const out: string[] = [];
    for (const v of values) {
      const clean = String(v || "").trim();
      if (!clean) continue;
      if (!out.includes(clean)) out.push(clean);
    }
    return out;
  };

  const isValidCodiceFiscale = (cf: string) => {
    const code = (cf || "").trim().toUpperCase();
    if (!/^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$/.test(code))
      return false;

    const oddMap: Record<string, number> = {
      "0": 1,
      "1": 0,
      "2": 5,
      "3": 7,
      "4": 9,
      "5": 13,
      "6": 15,
      "7": 17,
      "8": 19,
      "9": 21,
      A: 1,
      B: 0,
      C: 5,
      D: 7,
      E: 9,
      F: 13,
      G: 15,
      H: 17,
      I: 19,
      J: 21,
      K: 2,
      L: 4,
      M: 18,
      N: 20,
      O: 11,
      P: 3,
      Q: 6,
      R: 8,
      S: 12,
      T: 14,
      U: 16,
      V: 10,
      W: 22,
      X: 25,
      Y: 24,
      Z: 23,
    };
    const evenMap: Record<string, number> = {
      "0": 0,
      "1": 1,
      "2": 2,
      "3": 3,
      "4": 4,
      "5": 5,
      "6": 6,
      "7": 7,
      "8": 8,
      "9": 9,
      A: 0,
      B: 1,
      C: 2,
      D: 3,
      E: 4,
      F: 5,
      G: 6,
      H: 7,
      I: 8,
      J: 9,
      K: 10,
      L: 11,
      M: 12,
      N: 13,
      O: 14,
      P: 15,
      Q: 16,
      R: 17,
      S: 18,
      T: 19,
      U: 20,
      V: 21,
      W: 22,
      X: 23,
      Y: 24,
      Z: 25,
    };

    let sum = 0;
    for (let i = 0; i < 15; i++) {
      const c = code[i];
      sum += (i + 1) % 2 === 0 ? evenMap[c] : oddMap[c];
    }
    const expected = String.fromCharCode(65 + (sum % 26));
    return expected === code[15];
  };

  const choosePreferredCodiceFiscale = (
    values: string[],
    targetValue: string,
    generatedByValue: Record<string, boolean>,
    targetGenerated: boolean,
  ) => {
    const candidates = uniqueValues(
      values.map((v) => String(v || "").toUpperCase()),
    ).filter(Boolean);
    if (candidates.length === 0) return "";
    const validCandidates = candidates.filter(isValidCodiceFiscale);
    const pool = validCandidates.length > 0 ? validCandidates : candidates;
    const nonGeneratedPool = pool.filter((cf) => !generatedByValue[cf]);
    const targetUpper = String(targetValue || "").toUpperCase();

    if (targetUpper && pool.includes(targetUpper) && !targetGenerated)
      return targetUpper;
    if (nonGeneratedPool.length > 0) return nonGeneratedPool[0];
    if (targetUpper && pool.includes(targetUpper)) return targetUpper;
    return pool[0];
  };

  const levenshteinDistanceAtMost = (
    a: string,
    b: string,
    maxDistance: number,
  ) => {
    if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1;
    const dp = Array.from({ length: a.length + 1 }, () =>
      new Array<number>(b.length + 1).fill(0),
    );
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      let rowMin = Number.MAX_SAFE_INTEGER;
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost,
        );
        rowMin = Math.min(rowMin, dp[i][j]);
      }
      if (rowMin > maxDistance) return maxDistance + 1;
    }
    return dp[a.length][b.length];
  };

  const areLikelyDuplicatePatients = (a: any, b: any) => {
    const nameA = normalizeName(a.nome || "");
    const nameB = normalizeName(b.nome || "");
    const surnameA = normalizeName(a.cognome || "");
    const surnameB = normalizeName(b.cognome || "");
    if (!nameA && !surnameA) return false;
    if (!nameB && !surnameB) return false;

    const exact = nameA === nameB && surnameA === surnameB;
    if (exact) return true;

    const sameSurnameNearName =
      surnameA === surnameB &&
      nameA.length >= 3 &&
      nameB.length >= 3 &&
      levenshteinDistanceAtMost(nameA, nameB, 1) <= 1;
    if (sameSurnameNearName) return true;

    const sameNameNearSurname =
      nameA === nameB &&
      surnameA.length >= 3 &&
      surnameB.length >= 3 &&
      levenshteinDistanceAtMost(surnameA, surnameB, 1) <= 1;
    if (sameNameNearSurname) return true;

    const swappedTokens =
      `${nameA} ${surnameA}`.trim() === `${surnameB} ${nameB}`.trim();
    return swappedTokens;
  };

  const loadDuplicateGroups = async () => {
    setLoadingDuplicates(true);
    setDuplicateCheckProgress(null);
    try {
      const patients = await PatientService.getAllPatients();
      const n = patients.length;
      setDuplicateCheckProgress({ current: 0, total: Math.max(1, n) });
      const parent = Array.from({ length: n }, (_, i) => i);
      const find = (x: number): number => {
        if (parent[x] !== x) parent[x] = find(parent[x]);
        return parent[x];
      };
      const union = (a: number, b: number) => {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) parent[rb] = ra;
      };

      for (let i = 0; i < n; i++) {
        setDuplicateCheckProgress({ current: i + 1, total: Math.max(1, n) });
        if (i > 0 && i % 25 === 0) {
          await new Promise((r) => setTimeout(r, 0));
        }
        for (let j = i + 1; j < n; j++) {
          if (areLikelyDuplicatePatients(patients[i], patients[j])) {
            union(i, j);
          }
        }
      }

      const groups = new Map<number, any[]>();
      for (let i = 0; i < n; i++) {
        const root = find(i);
        const arr = groups.get(root) || [];
        arr.push(patients[i]);
        groups.set(root, arr);
      }

      const formatted = Array.from(groups.values())
        .filter((g) => g.length > 1)
        .map((g, idx) => ({
          key: `dup-${idx}-${g.map((p) => p.id).join("-")}`,
          patients: g.sort((a, b) =>
            (a.createdAt || "").localeCompare(b.createdAt || ""),
          ),
        }))
        .sort((a, b) => b.patients.length - a.patients.length);

      setDuplicateGroups(formatted);
    } catch (e) {
      console.error("Errore caricamento doppioni:", e);
      setError("Errore durante il controllo doppioni.");
    } finally {
      setLoadingDuplicates(false);
      setDuplicateCheckProgress(null);
    }
  };

  const deleteDuplicatePatient = async (patientId: string) => {
    if (
      !confirm(
        "Eliminare questo paziente? Verranno eliminate anche le visite collegate.",
      )
    )
      return;
    setProcessingDuplicateId(patientId);
    setError(null);
    try {
      await PatientService.deletePatient(patientId);
      setSuccess("Paziente duplicato eliminato.");
      setTimeout(() => setSuccess(null), 3000);
      const [patients, visits] = await Promise.all([
        PatientService.getAllPatients(),
        VisitService.getAllVisits(),
      ]);
      setPatientCount(patients.length);
      setVisitCount(visits.length);
      await loadDuplicateGroups();
    } catch (e: any) {
      setError(
        "Errore durante eliminazione duplicato: " + (e?.message || "errore"),
      );
    } finally {
      setProcessingDuplicateId(null);
    }
  };

  const executeMergeDuplicateGroup = async (
    groupKey: string,
    target: any,
    sources: any[],
    payload: Record<string, any>,
  ) => {
    setProcessingDuplicateGroupKey(groupKey);
    setProcessingDuplicateId(target.id);
    setError(null);
    try {
      for (const source of sources) {
        const visits = await VisitService.getVisitsByPatientId(source.id);
        for (const visit of visits) {
          await VisitService.updateVisit(visit.id, { patientId: target.id });
        }
      }

      if (Object.keys(payload).length > 0) {
        await PatientService.updatePatient(target.id, payload);
      }

      for (const source of sources) {
        await PatientService.deletePatient(source.id);
      }

      setSuccess(
        `Doppioni uniti con successo (mantenuto: ${target.nome} ${target.cognome}).`,
      );
      setTimeout(() => setSuccess(null), 3000);
      const [patients, visits] = await Promise.all([
        PatientService.getAllPatients(),
        VisitService.getAllVisits(),
      ]);
      setPatientCount(patients.length);
      setVisitCount(visits.length);
      await loadDuplicateGroups();
    } catch (e: any) {
      setError("Errore durante merge duplicati: " + (e?.message || "errore"));
    } finally {
      setProcessingDuplicateGroupKey(null);
      setProcessingDuplicateId(null);
    }
  };

  const mergeDuplicateGroup = async (
    groupKey: string,
    groupPatients: any[],
  ) => {
    if (!groupPatients || groupPatients.length < 2) return;

    const completenessScore = (p: any) =>
      [
        p.nome,
        p.cognome,
        p.dataNascita,
        p.luogoNascita,
        p.email,
        p.telefono,
        p.indirizzo,
        p.codiceFiscale,
      ].filter((v) => !!String(v || "").trim()).length;

    const sorted = [...groupPatients].sort(
      (a, b) => completenessScore(b) - completenessScore(a),
    );
    const target = sorted[0];
    const sources = sorted.slice(1);
    const all = [target, ...sources];

    const fieldDefs = [
      { key: "codiceFiscale", label: "Codice Fiscale" },
      { key: "telefono", label: "Telefono" },
      { key: "email", label: "Email" },
      { key: "dataNascita", label: "Data di nascita" },
      { key: "luogoNascita", label: "Luogo di nascita" },
      { key: "indirizzo", label: "Indirizzo" },
    ];

    const basePayload: Record<string, any> = {};
    const conflictFields: Array<{
      key: string;
      label: string;
      options: string[];
      defaultValue: string;
      generatedByValue?: Record<string, boolean>;
    }> = [];

    for (const field of fieldDefs) {
      const rawValues = uniqueValues(
        all.map((p) => {
          const raw = String(p[field.key] || "").trim();
          return field.key === "codiceFiscale" ? raw.toUpperCase() : raw;
        }),
      );
      if (rawValues.length === 0) continue;

      const generatedByValue: Record<string, boolean> = {};
      if (field.key === "codiceFiscale") {
        for (const p of all) {
          const raw = String(p.codiceFiscale || "")
            .trim()
            .toUpperCase();
          if (!raw) continue;
          generatedByValue[raw] =
            generatedByValue[raw] || Boolean(p.codiceFiscaleGenerato);
        }
      }

      const normalizedUnique = uniqueValues(
        rawValues.map((v) => normalizeFieldValue(field.key, v)),
      );
      const hasConflict = normalizedUnique.length > 1;

      if (!hasConflict) {
        const mergedValue = rawValues[0];
        if (
          mergedValue &&
          String(target[field.key] || "").trim() !== mergedValue
        ) {
          basePayload[field.key] = mergedValue;
        }
        if (
          field.key === "codiceFiscale" &&
          mergedValue &&
          Boolean(target.codiceFiscaleGenerato) !==
            Boolean(generatedByValue[mergedValue])
        ) {
          basePayload.codiceFiscaleGenerato = Boolean(
            generatedByValue[mergedValue],
          );
        }
        continue;
      }

      const defaultValue =
        field.key === "codiceFiscale"
          ? choosePreferredCodiceFiscale(
              rawValues,
              target.codiceFiscale,
              generatedByValue,
              Boolean(target.codiceFiscaleGenerato),
            )
          : String(target[field.key] || "").trim() || rawValues[0];

      conflictFields.push({
        key: field.key,
        label: field.label,
        options: rawValues,
        defaultValue,
        generatedByValue:
          field.key === "codiceFiscale" ? generatedByValue : undefined,
      });
    }

    if (conflictFields.length === 0) {
      await executeMergeDuplicateGroup(groupKey, target, sources, basePayload);
      return;
    }

    const initialSelections: Record<string, string> = {};
    for (const f of conflictFields) {
      initialSelections[f.key] = f.defaultValue;
    }

    setMergeConflictData({
      groupKey,
      target,
      sources,
      conflictFields,
      basePayload,
    });
    setMergeSelections(initialSelections);
    setMergeConflictOpen(true);
  };

  const confirmMergeWithSelections = async () => {
    if (!mergeConflictData) return;
    const { groupKey, target, sources, conflictFields, basePayload } =
      mergeConflictData;
    const finalPayload: Record<string, any> = { ...basePayload };

    for (const field of conflictFields) {
      const selected = String(
        mergeSelections[field.key] || field.defaultValue || "",
      ).trim();
      const targetValue = String(target[field.key] || "").trim();
      if (selected && selected !== targetValue) {
        finalPayload[field.key] = selected;
      }
      if (field.key === "codiceFiscale") {
        finalPayload.codiceFiscaleGenerato = Boolean(
          field.generatedByValue?.[selected],
        );
      }
    }

    setMergeConflictOpen(false);
    setMergeConflictData(null);
    setMergeSelections({});
    await executeMergeDuplicateGroup(groupKey, target, sources, finalPayload);
  };

  const filteredDuplicateGroups = useMemo(() => {
    const q = normalizeSearchText(duplicateSearch);
    if (!q) return duplicateGroups;

    return duplicateGroups
      .map((group) => {
        const filteredPatients = group.patients.filter((p) => {
          const fullName = `${p.nome || ""} ${p.cognome || ""}`;
          const haystack = normalizeSearchText(
            `${fullName} ${p.codiceFiscale || ""} ${p.email || ""} ${p.telefono || ""} ${p.dataNascita || ""}`,
          );
          return haystack.includes(q);
        });
        return { ...group, patients: filteredPatients };
      })
      .filter((group) => group.patients.length > 0);
  }, [duplicateGroups, duplicateSearch]);

  /** Salva i dati dottore (con eventuale lista ambulatori passata). Usato per salvataggio immediato dopo azioni ambulatori. */
  const saveDoctorData = async (ambulatoriList?: any[]) => {
    const list = ambulatoriList !== undefined ? ambulatoriList : ambulatori;
    setError(null);
    try {
      await DoctorService.updateDoctor({
        nome: doctorInfo.nome.trim(),
        cognome: doctorInfo.cognome.trim(),
        email: doctorInfo.email.trim(),
        telefono: doctorInfo.telefono.trim(),
        specializzazione: doctorInfo.specializzazione.trim(),
        ambulatori: list,
      });
      savePreferences();
      window.dispatchEvent(new CustomEvent("appdottori-doctor-updated"));
    } catch (e) {
      console.error("Errore salvataggio:", e);
      setError("Errore nel salvataggio: " + (e as Error).message);
      setTimeout(() => setError(null), 5000);
    }
  };

  const addAmbulatorio = async () => {
    if (!newAmbulatorio.nome.trim() || !newAmbulatorio.indirizzo.trim()) {
      setError("Nome e indirizzo ambulatorio sono obbligatori");
      return;
    }
    setError(null);

    const ambulatorio = {
      id: Date.now().toString(),
      ...newAmbulatorio,
      isPrimario: ambulatori.length === 0,
    };

    const newList = [...ambulatori, ambulatorio];
    setAmbulatori(newList);
    setNewAmbulatorio({
      nome: "",
      indirizzo: "",
      citta: "",
      cap: "",
      telefono: "",
      email: "",
      isPrimario: false,
    });

    setSavingAmbulatori(true);
    try {
      await saveDoctorData(newList);
      setSuccess("Ambulatorio aggiunto e salvato.");
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setAmbulatori(ambulatori);
    } finally {
      setSavingAmbulatori(false);
    }
  };

  const removeAmbulatorio = async (id: string) => {
    const newList = ambulatori.filter((amb) => amb.id !== id);
    setAmbulatori(newList);
    setSavingAmbulatori(true);
    try {
      await saveDoctorData(newList);
      setSuccess("Ambulatorio rimosso e modifiche salvate.");
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setAmbulatori(ambulatori);
    } finally {
      setSavingAmbulatori(false);
    }
  };

  const setPrimario = async (id: string) => {
    const newList = ambulatori.map((amb) => ({
      ...amb,
      isPrimario: amb.id === id,
    }));
    setAmbulatori(newList);
    setSavingAmbulatori(true);
    try {
      await saveDoctorData(newList);
      setSuccess("Sede in uso aggiornata.");
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setAmbulatori(ambulatori);
    } finally {
      setSavingAmbulatori(false);
    }
  };

  const saveDoctorInfo = async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      await DoctorService.updateDoctor({
        nome: doctorInfo.nome.trim(),
        cognome: doctorInfo.cognome.trim(),
        email: doctorInfo.email.trim(),
        telefono: doctorInfo.telefono.trim(),
        specializzazione: doctorInfo.specializzazione.trim(),
        ambulatori: ambulatori,
        profileImage: profilePic || undefined,
      });

      savePreferences();
      window.dispatchEvent(new CustomEvent("appdottori-doctor-updated"));
      setSuccess("Profilo salvato con successo.");

      setTimeout(() => setSuccess(null), 3000);
    } catch (error) {
      console.error("Errore nel salvataggio:", error);
      setError("Errore nel salvataggio dei dati: " + error.message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <PageHeader
        title="Impostazioni"
        subtitle="Personalizza la tua esperienza dell'applicazione"
        icon={SettingsIcon}
        iconColor="secondary"
      />

      {/* Messages */}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Colonna Sinistra: Profilo e Backup */}
        <div className="space-y-8">
          {/* Profilo Dottore */}
          <Card className="shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Profilo Dottore
                </h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-6">
              <div className="flex items-center gap-4">
                <Avatar
                  key={profilePic} // Force re-render on change
                  src={profilePic || undefined}
                  name={`${doctorInfo.nome} ${doctorInfo.cognome}`}
                  size="lg"
                  className="w-20 h-20"
                  showFallback={!profilePic}
                />
                <div className="flex-1">
                  <Button
                    variant="flat"
                    color="primary"
                    size="sm"
                    as="label"
                    className="cursor-pointer"
                  >
                    Cambia Foto
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={handleProfilePicChange}
                    />
                  </Button>
                  <p className="text-xs text-default-500 mt-1">
                    Seleziona un&apos;immagine: si aprirà l&apos;anteprima per
                    scegliere la porzione circolare.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <Input
                  label="Nome"
                  value={doctorInfo.nome}
                  onValueChange={(value) =>
                    handleDoctorInfoChange("nome", value)
                  }
                  variant="bordered"
                />
                <Input
                  label="Cognome"
                  value={doctorInfo.cognome}
                  onValueChange={(value) =>
                    handleDoctorInfoChange("cognome", value)
                  }
                  variant="bordered"
                />
                <Input
                  label="Email"
                  type="email"
                  value={doctorInfo.email}
                  onValueChange={(value) =>
                    handleDoctorInfoChange("email", value)
                  }
                  variant="bordered"
                />
                <Input
                  label="Telefono"
                  value={doctorInfo.telefono}
                  onValueChange={(value) =>
                    handleDoctorInfoChange("telefono", value)
                  }
                  variant="bordered"
                  placeholder="3331234567"
                  description="Numero di telefono professionale"
                />
                <Input
                  label="Specializzazione"
                  value={doctorInfo.specializzazione}
                  onValueChange={(value) =>
                    handleDoctorInfoChange("specializzazione", value)
                  }
                  variant="bordered"
                  placeholder="Es. Ginecologia e Ostetricia"
                />
              </div>

              <Button
                color="primary"
                className="w-full"
                onPress={saveDoctorInfo}
                isLoading={isLoading}
              >
                {isLoading ? "Salvando..." : "Salva Modifiche"}
              </Button>
            </CardBody>
          </Card>

          {/* Backup e Dati */}
          <Card className="shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <Download className="w-5 h-5 text-success" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Backup e Dati
                </h2>
              </div>
            </CardHeader>
            <CardBody className="space-y-6">
              <div className="text-center space-y-4">
                <div className="flex justify-center gap-4">
                  <Chip color="primary" variant="flat">
                    Pazienti: {patientCount}
                  </Chip>
                  <Chip color="secondary" variant="flat">
                    Visite: {visitCount}
                  </Chip>
                </div>

                <p className="text-sm text-gray-600">
                  Esporta i tuoi dati per creare backup di sicurezza o importa
                  dati esistenti
                </p>
              </div>

              <BackupManager />
            </CardBody>
          </Card>

          <Card className="shadow-lg">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <SettingsIcon className="w-5 h-5 text-secondary" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Funzionalita Visite
                </h2>
              </div>
            </CardHeader>
            <CardBody>
              <Switch
                isSelected={preferences.visitaGinecologicaPediatricaEnabled}
                onValueChange={(value) =>
                  handlePreferenceChange(
                    "visitaGinecologicaPediatricaEnabled",
                    value,
                  )
                }
              >
                Abilita visita ginecologica pediatrica
              </Switch>
              <p className="text-xs text-default-500 mt-2 mb-4">
                Se attiva, nella pagina Nuova Visita comparira anche il tab dedicato alla visita ginecologica pediatrica.
              </p>

              <Divider className="my-4" />
              
              <Select
                label="Formula Stima Peso Fetale"
                selectedKeys={[preferences.formulaPesoFetale || 'hadlock4']}
                onSelectionChange={(keys) => handlePreferenceChange("formulaPesoFetale", Array.from(keys)[0] as string)}
                variant="bordered"
                description="Seleziona la formula da utilizzare per il calcolo del peso stimato nella biometria fetale."
              >
                <SelectItem key="hadlock4" value="hadlock4">Hadlock IV (BPD, HC, AC, FL)</SelectItem>
                <SelectItem key="hadlock1" value="hadlock1">Hadlock I (BPD, AC, FL)</SelectItem>
                <SelectItem key="hadlock2" value="hadlock2">Hadlock II (HC, AC, FL)</SelectItem>
                <SelectItem key="hadlock3" value="hadlock3">Hadlock III (AC, FL)</SelectItem>
                <SelectItem key="shepard" value="shepard">Shepard (BPD, AC)</SelectItem>
                <SelectItem key="campbell" value="campbell">Campbell (AC)</SelectItem>
              </Select>
            </CardBody>
          </Card>
        </div>

        {/* Colonna Destra: Ambulatori */}
        <div className="space-y-8">
          <Card className="shadow-lg max-h-[calc(100vh-12rem)] flex flex-col">
            <CardHeader className="pb-2 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-emerald-500 rounded"></div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Ambulatori
                </h2>
              </div>
            </CardHeader>
            <CardBody className="flex flex-col flex-1 min-h-0 gap-0">
              {/* Lista ambulatori esistenti - altezza fissa ~2 card (mobile) o ~4 (desktop), scroll interno */}
              <div className="overflow-y-auto overflow-x-hidden space-y-3 pr-2 min-h-[10rem] max-h-[14rem] md:max-h-[28rem] rounded-lg border border-default-200 bg-default-50/50 p-2">
                {ambulatori.length > 0 ? (
                  <>
                    <h3 className="font-medium text-gray-900">
                      Ambulatori Configurati
                    </h3>
                    {ambulatori.map((amb) => (
                      <Card key={amb.id} className="bg-gray-50">
                        <CardBody className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <h4 className="font-semibold text-gray-900">
                                  {amb.nome}
                                </h4>
                                {amb.isPrimario && (
                                  <Chip
                                    size="sm"
                                    color="success"
                                    variant="flat"
                                  >
                                    In uso
                                  </Chip>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">
                                {amb.indirizzo}, {amb.cap} {amb.citta}
                              </p>
                              <p className="text-sm text-gray-600">
                                Tel: {amb.telefono}{" "}
                                {amb.email && `• Email: ${amb.email}`}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              {!amb.isPrimario && (
                                <Button
                                  size="sm"
                                  color="primary"
                                  variant="flat"
                                  onPress={() => setPrimario(amb.id)}
                                  isLoading={savingAmbulatori}
                                  isDisabled={savingAmbulatori}
                                >
                                  Imposta come attuale
                                </Button>
                              )}
                              <Button
                                size="sm"
                                color="danger"
                                variant="flat"
                                onPress={() => removeAmbulatorio(amb.id)}
                                isLoading={savingAmbulatori}
                                isDisabled={savingAmbulatori}
                              >
                                Rimuovi
                              </Button>
                            </div>
                          </div>
                        </CardBody>
                      </Card>
                    ))}
                  </>
                ) : (
                  <p className="text-sm text-gray-500">
                    Nessun ambulatorio configurato. Aggiungine uno qui sotto.
                  </p>
                )}
              </div>

              <Divider className="flex-shrink-0 my-4" />

              {/* Form nuovo ambulatorio - sempre visibile, non scrolla */}
              <div className="space-y-4 flex-shrink-0">
                <h3 className="font-medium text-gray-900">
                  Aggiungi Nuovo Ambulatorio
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Nome Ambulatorio"
                    value={newAmbulatorio.nome}
                    onValueChange={(value) =>
                      setNewAmbulatorio((prev) => ({ ...prev, nome: value }))
                    }
                    variant="bordered"
                    placeholder="Studio Medico Dott. Rossi"
                  />
                  <Input
                    label="Telefono Ambulatorio"
                    value={newAmbulatorio.telefono}
                    onValueChange={(value) =>
                      setNewAmbulatorio((prev) => ({
                        ...prev,
                        telefono: value,
                      }))
                    }
                    variant="bordered"
                    placeholder="0612345678"
                  />
                </div>
                <Input
                  label="Indirizzo"
                  value={newAmbulatorio.indirizzo}
                  onValueChange={(value) =>
                    setNewAmbulatorio((prev) => ({ ...prev, indirizzo: value }))
                  }
                  variant="bordered"
                  placeholder="Via Roma 10"
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Input
                    label="Città"
                    value={newAmbulatorio.citta}
                    onValueChange={(value) =>
                      setNewAmbulatorio((prev) => ({ ...prev, citta: value }))
                    }
                    variant="bordered"
                    placeholder="Roma"
                  />
                  <Input
                    label="CAP"
                    value={newAmbulatorio.cap}
                    onValueChange={(value) =>
                      setNewAmbulatorio((prev) => ({ ...prev, cap: value }))
                    }
                    variant="bordered"
                    placeholder="00100"
                  />
                  <Input
                    label="Email (Opzionale)"
                    type="email"
                    value={newAmbulatorio.email}
                    onValueChange={(value) =>
                      setNewAmbulatorio((prev) => ({ ...prev, email: value }))
                    }
                    variant="bordered"
                    placeholder="studio@email.com"
                  />
                </div>
                <Button
                  color="success"
                  variant="flat"
                  onPress={addAmbulatorio}
                  isLoading={savingAmbulatori}
                  isDisabled={savingAmbulatori}
                  className="w-full"
                >
                  {savingAmbulatori ? "Salvataggio..." : "Aggiungi Ambulatorio"}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Sezione dedicata: Qualità Dati Pazienti */}
      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">
            Qualità Dati Pazienti
          </h2>
          <p className="text-sm text-gray-600">
            Area dedicata al controllo dei possibili pazienti duplicati.
          </p>
        </div>

        <Card className="shadow-lg border border-warning-200">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between w-full gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-warning" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Controllo Doppioni
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <Chip color="warning" variant="flat">
                  Gruppi: {duplicateGroups.length}
                </Chip>
                <Chip color="secondary" variant="flat">
                  Record:{" "}
                  {duplicateGroups.reduce(
                    (acc, g) => acc + g.patients.length,
                    0,
                  )}
                </Chip>
                <Button
                  size="sm"
                  variant="flat"
                  color="warning"
                  onPress={loadDuplicateGroups}
                  isLoading={loadingDuplicates && !duplicateCheckProgress}
                >
                  {duplicateCheckProgress
                    ? `Analisi: ${duplicateCheckProgress.current} / ${duplicateCheckProgress.total}`
                    : "Aggiorna"}
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
              <Input
                label="Ricerca nei sospetti doppioni"
                placeholder="Cerca per nome, cognome, codice fiscale, email o telefono"
                variant="bordered"
                value={duplicateSearch}
                onValueChange={setDuplicateSearch}
                startContent={<Search size={16} className="text-default-400" />}
              />
              {duplicateSearch && (
                <Button
                  variant="flat"
                  onPress={() => setDuplicateSearch("")}
                  className="md:mb-1"
                >
                  Pulisci ricerca
                </Button>
              )}
            </div>

            {loadingDuplicates ? (
              <div className="py-6 space-y-3 flex flex-col items-stretch">
                <span className="text-sm text-gray-500 text-center">
                  {duplicateCheckProgress
                    ? `Analisi doppioni: ${duplicateCheckProgress.current} / ${duplicateCheckProgress.total} pazienti`
                    : "Analisi doppioni in corso..."}
                </span>
                {duplicateCheckProgress && (
                  <Progress
                    size="md"
                    value={
                      (duplicateCheckProgress.current /
                        Math.max(1, duplicateCheckProgress.total)) *
                      100
                    }
                    color="warning"
                    className="max-w-full"
                    aria-label={`Analisi doppioni ${duplicateCheckProgress.current}/${duplicateCheckProgress.total}`}
                  />
                )}
              </div>
            ) : filteredDuplicateGroups.length === 0 ? (
              <div className="py-6 text-sm text-gray-500">
                {duplicateGroups.length === 0
                  ? "Nessun doppione sospetto trovato."
                  : "Nessun risultato per la ricerca corrente."}
              </div>
            ) : (
              <div className="space-y-4 overflow-y-auto overflow-x-hidden max-h-[28rem] md:max-h-[40rem] pr-1 md:pr-2">
                {filteredDuplicateGroups.map((group, gIdx) => (
                  <Card
                    key={group.key}
                    className="bg-warning-50 border border-warning-200"
                  >
                    <CardBody className="space-y-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="font-medium text-warning-800">
                          Gruppo sospetto #{gIdx + 1} • {group.patients.length}{" "}
                          record
                        </p>
                        <Button
                          size="sm"
                          color="warning"
                          onPress={() =>
                            mergeDuplicateGroup(group.key, group.patients)
                          }
                          isLoading={processingDuplicateGroupKey === group.key}
                          isDisabled={group.patients.length < 2}
                        >
                          Unisci gruppo
                        </Button>
                      </div>

                      <Table aria-label={`Duplicati gruppo ${gIdx + 1}`}>
                        <TableHeader>
                          <TableColumn>PAZIENTE</TableColumn>
                          <TableColumn>CF / NASCITA</TableColumn>
                          <TableColumn>CONTATTI</TableColumn>
                          <TableColumn>AZIONI</TableColumn>
                        </TableHeader>
                        <TableBody>
                          {group.patients.map((p) => (
                            <TableRow key={p.id}>
                              <TableCell>
                                <p className="font-medium text-gray-900">
                                  {p.nome} {p.cognome}
                                </p>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm text-gray-700">
                                  CF:{" "}
                                  <CodiceFiscaleValue
                                    value={p.codiceFiscale}
                                    placeholder="—"
                                    generatedFromImport={Boolean(
                                      p.codiceFiscaleGenerato,
                                    )}
                                  />
                                </p>
                                <p className="text-xs text-gray-500">
                                  Nascita: {p.dataNascita || "—"}
                                </p>
                              </TableCell>
                              <TableCell>
                                <p className="text-sm text-gray-700">
                                  Tel: {p.telefono || "—"}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Email: {p.email || "—"}
                                </p>
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  color="danger"
                                  variant="flat"
                                  onPress={() => deleteDuplicatePatient(p.id)}
                                  isLoading={processingDuplicateId === p.id}
                                  isDisabled={
                                    processingDuplicateGroupKey === group.key
                                  }
                                >
                                  Elimina record
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Gestione Modelli */}
      <Card className="shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-3">
              <FileText className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold text-gray-900">
                Gestione Modelli Referti
              </h2>
            </div>
            <Button
              size="sm"
              color="primary"
              startContent={<Plus size={16} />}
              onPress={handleNewTemplate}
            >
              Nuovo Modello
            </Button>
          </div>
        </CardHeader>
        <CardBody className="space-y-6">
          <Tabs
            aria-label="Categorie Template"
            selectedKey={selectedCategory}
            onSelectionChange={(key) => setSelectedCategory(key as string)}
          >
            <Tab key="ginecologia" title="Ginecologia" />
            <Tab key="ostetricia" title="Ostetricia" />
            <Tab key="terapie" title="Terapie" />
            <Tab key="esame_complementare" title="Esami" />
          </Tabs>

          <Table aria-label="Tabella Modelli">
            <TableHeader>
              <TableColumn>NOME MODELLO</TableColumn>
              <TableColumn>SEZIONE</TableColumn>
              <TableColumn>TESTO (ANTEPRIMA)</TableColumn>
              <TableColumn>AZIONI</TableColumn>
            </TableHeader>
            <TableBody
              emptyContent={"Nessun modello trovato per questa categoria."}
            >
              {templates
                .filter((t) => t.category === selectedCategory)
                .map((template) => (
                  <TableRow key={template.id}>
                    <TableCell className="font-medium">
                      {template.label}
                    </TableCell>
                    <TableCell>
                      <Chip size="sm" variant="flat" className="capitalize">
                        {template.section === "esameObiettivo"
                          ? "Esame Ob."
                          : template.section}
                      </Chip>
                    </TableCell>
                    <TableCell>
                      <div className="max-w-xs truncate text-default-500">
                        {template.text}
                        {template.note && (
                          <span className="block text-xs italic text-default-400">
                            {template.note}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          onPress={() => handleEditTemplate(template)}
                        >
                          <Edit size={16} />
                        </Button>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="light"
                          color="danger"
                          onPress={() => handleDeleteTemplate(template.id)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardBody>
      </Card>

      {/* Info App */}
      <Card className="shadow-lg">
        <CardBody>
          <div className="text-center space-y-2">
            <h3 className="font-semibold text-gray-900">Corioli Desktop</h3>
            <div className="flex justify-center gap-4 text-sm text-gray-600">
              <span>Versione 1.0.0</span>
              <span>•</span>
              <span>Modalità Offline</span>
              <span>•</span>
              <span>Dati Locali</span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Modal crop foto profilo: trascina l'immagine per scegliere la porzione circolare */}
      <Modal
        isOpen={cropImageOpen}
        onClose={() => {
          setCropImageOpen(false);
          setCropImageDataUrl("");
        }}
        size="md"
        classNames={{ wrapper: "z-[100]" }}
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>Scegli la porzione da mostrare</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-500 mb-3">
              Trascina l&apos;immagine per posizionare la parte che vuoi nel
              cerchio, poi clicca Applica.
            </p>
            <div
              className="w-[256px] h-[256px] mx-auto rounded-full overflow-hidden border-2 border-default-200 cursor-move select-none"
              style={{
                backgroundImage: `url(${cropImageDataUrl})`,
                backgroundSize: "cover",
                backgroundPosition: `${cropOffset.x}px ${cropOffset.y}px`,
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                cropDragRef.current = {
                  startX: e.clientX,
                  startY: e.clientY,
                  startOffset: { ...cropOffset },
                };
              }}
            />
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={() => {
                setCropImageOpen(false);
                setCropImageDataUrl("");
              }}
            >
              Annulla
            </Button>
            <Button color="primary" onPress={applyCrop}>
              Applica
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={mergeConflictOpen}
        onClose={() => {
          setMergeConflictOpen(false);
          setMergeConflictData(null);
          setMergeSelections({});
        }}
        size="2xl"
        scrollBehavior="inside"
      >
        <ModalContent>
          <ModalHeader>Seleziona i dati da mantenere</ModalHeader>
          <ModalBody>
            <p className="text-sm text-default-600">
              Abbiamo trovato informazioni diverse tra i record. Scegli quale
              valore usare nel paziente finale.
            </p>

            <div className="space-y-4">
              {mergeConflictData?.conflictFields.map((field) => (
                <div
                  key={field.key}
                  className="rounded-lg border border-default-200 p-3 bg-default-50"
                >
                  <p className="text-sm font-medium mb-2">{field.label}</p>
                  <Select
                    aria-label={`Selezione ${field.label}`}
                    selectedKeys={[
                      mergeSelections[field.key] ?? field.defaultValue,
                    ]}
                    onSelectionChange={(keys) => {
                      const selected = String(Array.from(keys)[0] || "");
                      setMergeSelections((prev) => ({
                        ...prev,
                        [field.key]: selected,
                      }));
                    }}
                    variant="bordered"
                    size="sm"
                  >
                    {field.options.map((value) => (
                      <SelectItem
                        key={value}
                        value={value}
                        textValue={
                          field.key === "codiceFiscale"
                            ? `${value}${field.generatedByValue?.[value] ? " (generato da import)" : ""}`
                            : value
                        }
                      >
                        {field.key === "codiceFiscale" ? (
                          <span>
                            <span className="font-mono">{value}</span>
                            {field.generatedByValue?.[value] && (
                              <span className="text-danger font-bold ml-1">
                                *
                              </span>
                            )}
                            {field.generatedByValue?.[value]
                              ? " (generato da import)"
                              : ""}
                          </span>
                        ) : (
                          value
                        )}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              ))}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              onPress={() => {
                setMergeConflictOpen(false);
                setMergeConflictData(null);
                setMergeSelections({});
              }}
            >
              Annulla
            </Button>
            <Button color="warning" onPress={confirmMergeWithSelections}>
              Conferma merge
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={isTemplateModalOpen}
        onClose={onTemplateModalClose}
        size="2xl"
      >
        <ModalContent>
          <ModalHeader>
            {currentTemplate.id ? "Modifica Modello" : "Nuovo Modello"}
          </ModalHeader>
          <ModalBody onContextMenu={(e) => e.stopPropagation()}>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {currentTemplate.id ? (
                  <Select
                    label="Categoria"
                    selectedKeys={
                      currentTemplate.category ? [currentTemplate.category] : []
                    }
                    onSelectionChange={(keys) =>
                      setCurrentTemplate((prev) => ({
                        ...prev,
                        category: Array.from(keys)[0] as any,
                      }))
                    }
                  >
                    <SelectItem key="ginecologia" value="ginecologia">
                      Ginecologia
                    </SelectItem>
                    <SelectItem key="ostetricia" value="ostetricia">
                      Ostetricia
                    </SelectItem>
                    <SelectItem key="terapie" value="terapie">
                      Terapie
                    </SelectItem>
                    <SelectItem
                      key="esame_complementare"
                      value="esame_complementare"
                    >
                      Esami Complementari
                    </SelectItem>
                  </Select>
                ) : (
                  <div className="flex flex-col gap-1">
                    <span className="text-sm text-default-500 font-medium">
                      Categoria
                    </span>
                    <p className="text-default-700 font-medium capitalize">
                      {currentTemplate.category === "esame_complementare"
                        ? "Esami Complementari"
                        : currentTemplate.category}
                    </p>
                    <p className="text-xs text-default-400">
                      Impostata dalla sezione in cui ti trovi
                    </p>
                  </div>
                )}
                <Select
                  label="Sezione"
                  selectedKeys={
                    currentTemplate.section ? [currentTemplate.section] : []
                  }
                  onSelectionChange={(keys) =>
                    setCurrentTemplate((prev) => ({
                      ...prev,
                      section: Array.from(keys)[0] as any,
                    }))
                  }
                >
                  <SelectItem key="prestazione" value="prestazione">
                    Anamnesi / Prestazione
                  </SelectItem>
                  <SelectItem key="esameObiettivo" value="esameObiettivo">
                    Esame Obiettivo / Eco
                  </SelectItem>
                  <SelectItem key="conclusioni" value="conclusioni">
                    Conclusioni
                  </SelectItem>
                  <SelectItem key="generale" value="generale">
                    Generale
                  </SelectItem>
                  <SelectItem key="nome" value="nome">
                    Nome esame
                  </SelectItem>
                </Select>
              </div>
              <Input
                label="Nome Modello (Label)"
                value={currentTemplate.label}
                onValueChange={(val) =>
                  setCurrentTemplate((prev) => ({ ...prev, label: val }))
                }
                description="Il nome che apparirà nel menu a tendina"
              />
              <Textarea
                label={
                  currentTemplate.category === "esame_complementare"
                    ? "Nome Esame (Testo)"
                    : "Testo del Modello"
                }
                value={currentTemplate.text}
                onValueChange={(val) =>
                  setCurrentTemplate((prev) => ({ ...prev, text: val }))
                }
                minRows={
                  currentTemplate.category === "esame_complementare" ? 2 : 6
                }
                description={
                  currentTemplate.category === "esame_complementare"
                    ? "Il nome completo dell'esame"
                    : "Il testo che verrà inserito nel referto"
                }
                spellCheck
              />
              {currentTemplate.category === "esame_complementare" && (
                <Textarea
                  label="Note Cliniche (Pre-fill)"
                  value={currentTemplate.note || ""}
                  onValueChange={(val) =>
                    setCurrentTemplate((prev) => ({ ...prev, note: val }))
                  }
                  minRows={3}
                  description="Note aggiuntive opzionali (es. preparazione, dettagli)"
                  className="mt-4"
                />
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button
              color="danger"
              variant="light"
              onPress={onTemplateModalClose}
            >
              Annulla
            </Button>
            <Button color="primary" onPress={handleSaveTemplate}>
              Salva Modello
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
};

export default SettingsScreen;
