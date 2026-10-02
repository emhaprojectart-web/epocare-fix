import React, { useState } from 'react';
import { 
  X, 
  UploadCloud, 
  FileSpreadsheet, 
  ClipboardPaste, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Trash2, 
  Sparkles,
  Info,
  Check,
  Plus,
  HelpCircle,
  Calendar,
  Clock
} from 'lucide-react';
import { PatientRecord, HDDaySchedule, HDShift, HDFrequency, SingleHDDay } from '../types/dialysis';
import { calculateClinicalRecommendation, generateDefaultWeeks } from '../services/clinicalRules';
import { getScheduleDayFromSingleDay, getFirstHDDateOfMonth, isSummaryOrHeaderRow } from '../services/googleSheets';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportPatients: (newPatients: PatientRecord[], mode: 'append' | 'replace') => void;
  selectedMonth: string;
}

export interface ParsedRow {
  id: string;
  noRm: string;
  name: string;
  hdFrequency?: HDFrequency;
  singleDay?: SingleHDDay;
  scheduleDay: HDDaySchedule;
  scheduleShift: HDShift;
  hbValue: number;
  hbDate: string;
  notes: string;
  isValid: boolean;
  errorMessage?: string;
}

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onImportPatients,
  selectedMonth,
}) => {
  const [activeTab, setActiveTab] = useState<'paste' | 'file' | 'manual'>('paste');
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Default fallback values if columns aren't present in pasted data
  const [defaultSchedule, setDefaultSchedule] = useState<HDDaySchedule>('Senin - Kamis');
  const [defaultShift, setDefaultShift] = useState<HDShift>('Shift 1 (Pagi)');

  if (!isOpen) return null;

  // Normalisasi string jadwal
  const normalizeScheduleDay = (raw: string, fallback: HDDaySchedule): HDDaySchedule => {
    if (!raw) return fallback;
    const s = raw.toLowerCase().trim();
    if (s.includes('selasa') || s.includes('jumat') || s.includes('sel-jum')) return 'Selasa - Jumat';
    if (s.includes('rabu') || s.includes('sabtu') || s.includes('rab-sab')) return 'Rabu - Sabtu';
    if (s.includes('senin') || s.includes('kamis') || s.includes('sen-kam')) return 'Senin - Kamis';
    return fallback;
  };

  // Normalisasi shift (Hanya Shift 1 Pagi dan Shift 2 Siang)
  const normalizeShift = (raw: string, fallback: HDShift): HDShift => {
    if (!raw) return fallback;
    const s = raw.toLowerCase().trim();
    if (s.includes('siang') || s.includes('s') || s.includes('2')) return 'Shift 2 (Siang)';
    if (s.includes('pagi') || s.includes('p') || s.includes('1')) return 'Shift 1 (Pagi)';
    return fallback;
  };

  // Smart Parser: parses clipboard text from Excel, Sheets, or Hospital Information Systems
  const handleParseText = (
    text: string, 
    fallbackDay: HDDaySchedule = defaultSchedule, 
    fallbackShiftVal: HDShift = defaultShift
  ) => {
    setPasteText(text);
    if (!text.trim()) {
      setParsedRows([]);
      return;
    }

    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const rows: ParsedRow[] = [];

    lines.forEach((line, index) => {
      // Split by tab (Excel/Sheets standard), semicolon, or comma
      let parts: string[] = [];
      if (line.includes('\t')) {
        parts = line.split('\t');
      } else if (line.includes(';')) {
        parts = line.split(';');
      } else {
        parts = line.split(',');
      }

      // Bersihkan whitespace & quotes
      parts = parts.map((p) => p.replace(/^["']|["']$/g, '').trim()).filter((p) => p !== '');
      if (parts.length === 0) return;

      // Skip header baris pertama jika berisi kata kunci kolom
      const firstLineLower = line.toLowerCase();
      if (
        index === 0 &&
        (firstLineLower.includes('no. rm') ||
          firstLineLower.includes('nama pasien') ||
          firstLineLower.includes('jadwal hd') ||
          firstLineLower.includes('kadar hb') ||
          (parts[0]?.toLowerCase().includes('rm') && parts[1]?.toLowerCase().includes('nama')))
      ) {
        return;
      }

      // Lewati jika baris adalah baris total ringkasan (Total Shift Pagi, Total Shift Siang, Kebutuhan PRC, Kebutuhan EPO, Epo Keluar, dll)
      if (isSummaryOrHeaderRow(parts[1] || parts[0] || '', parts[0] || '', line)) {
        return;
      }

      let noRm = '';
      let name = '';
      let scheduleDay: HDDaySchedule = fallbackDay;
      let scheduleShift: HDShift = fallbackShiftVal;
      let hbVal: number = NaN;
      let dateRaw = `${selectedMonth}-02`;
      let notes = '';

      // SMART DETECTION STRATEGY:
      // Case A: 2 columns -> [Nama, Hb] or [No. RM, Nama]
      if (parts.length === 2) {
        const potentialHb = parseFloat(parts[1].replace(',', '.'));
        if (!isNaN(potentialHb) && potentialHb > 2 && potentialHb < 25) {
          name = parts[0];
          hbVal = potentialHb;
        } else {
          noRm = parts[0];
          name = parts[1];
        }
      }
      // Case B: 3 columns -> [No. RM, Nama, Hb] or [No, Nama, Hb]
      else if (parts.length === 3) {
        const part3Hb = parseFloat(parts[2].replace(',', '.'));
        if (!isNaN(part3Hb) && part3Hb > 2 && part3Hb < 25) {
          noRm = parts[0];
          name = parts[1];
          hbVal = part3Hb;
        } else {
          noRm = parts[0];
          name = parts[1];
          notes = parts[2];
        }
      }
      // Case C: 4 columns -> [No. RM, Nama, Jadwal, Hb] or [No, Nama, Shift, Hb]
      else if (parts.length === 4) {
        noRm = parts[0];
        name = parts[1];
        const p2Lower = parts[2].toLowerCase();
        if (p2Lower.includes('pagi') || p2Lower.includes('siang')) {
          scheduleShift = normalizeShift(parts[2], fallbackShiftVal);
        } else {
          scheduleDay = normalizeScheduleDay(parts[2], fallbackDay);
        }
        hbVal = parseFloat(parts[3].replace(',', '.'));
      }
      // Case D: 5+ columns -> Standard format
      else {
        noRm = parts[0] || '';
        name = parts[1] || '';
        scheduleDay = normalizeScheduleDay(parts[2], fallbackDay);
        scheduleShift = normalizeShift(parts[3], fallbackShiftVal);
        hbVal = parseFloat((parts[4] || '').replace(',', '.'));
        dateRaw = parts[5] || `${selectedMonth}-02`;
        notes = parts[6] || '';
      }

      // Fallback search for Hb float in any column if not found yet
      if (isNaN(hbVal)) {
        for (let i = 0; i < parts.length; i++) {
          const num = parseFloat(parts[i].replace(',', '.'));
          if (!isNaN(num) && num >= 3.0 && num <= 22.0) {
            hbVal = num;
            // If parts[i] was Hb, and parts[i-1] is name, adjust
            if (!name && i > 0) name = parts[i - 1];
            break;
          }
        }
      }

      // Check if noRm looks like an index number (e.g. "1", "2")
      if (/^\d{1,3}$/.test(noRm) && name) {
        // If it's a sequence number, make a realistic RM
        noRm = `RM-${String(10100 + index).padStart(5, '0')}`;
      } else if (!noRm) {
        noRm = `RM-${String(10100 + index).padStart(5, '0')}`;
      }

      // Fallback name if missing
      if (!name) {
        name = `Pasien HD ${index + 1}`;
      }

      // Jika belum mengetahui hasil HB (HB belum diinputkan) maka terdeteksi nilai HB: 0
      const detectedHb = isNaN(hbVal) || hbVal <= 0 ? 0 : Math.round(hbVal * 10) / 10;
      const isValid = Boolean(name && !isNaN(detectedHb) && detectedHb >= 0);

      let hdFrequency: HDFrequency = '2 kali dalam satu minggu';
      let singleDay: SingleHDDay | undefined = undefined;
      const lineLower = line.toLowerCase();
      if (lineLower.includes('1 kali') || lineLower.includes('1x/mgg') || lineLower.includes('1x / mgg') || lineLower.includes('1x/minggu')) {
        hdFrequency = '1 kali dalam satu minggu';
        if (lineLower.includes('senin')) singleDay = 'Senin';
        else if (lineLower.includes('selasa')) singleDay = 'Selasa';
        else if (lineLower.includes('rabu')) singleDay = 'Rabu';
        else if (lineLower.includes('kamis')) singleDay = 'Kamis';
        else if (lineLower.includes('jumat')) singleDay = 'Jumat';
        else if (lineLower.includes('sabtu')) singleDay = 'Sabtu';
        else singleDay = 'Senin';

        if (singleDay) {
          scheduleDay = getScheduleDayFromSingleDay(singleDay);
        }
      }

      rows.push({
        id: `parsed-${index}-${Date.now()}`,
        noRm,
        name,
        hdFrequency,
        singleDay,
        scheduleDay,
        scheduleShift,
        hbValue: detectedHb,
        hbDate: dateRaw,
        notes,
        isValid,
        errorMessage: !isValid ? 'Nama Pasien belum terisi.' : undefined,
      });
    });

    setParsedRows(rows);
  };

  // Unduh Template Format Excel/CSV
  const handleDownloadTemplate = () => {
    const header = 'No. RM,Nama Pasien,Jadwal HD,Shift,Kadar Hb (g/dL),Tanggal Cek Lab,Catatan';
    const sampleRows = [
      'RM-00101,Budi Santoso,Senin - Kamis,Shift 1 (Pagi),5.4,2026-09-02,Lemas anemis berat',
      'RM-00102,Dewi Lestari,Senin - Kamis,Shift 2 (Siang),6.5,2026-09-02,Transfusi 1 bag saat HD',
      'RM-00103,Ahmad Hidayat,Selasa - Jumat,Shift 1 (Pagi),7.8,2026-09-03,Rutin EPO 4x 2000 IU',
      'RM-00104,Sri Wahyuni,Selasa - Jumat,Shift 2 (Siang),8.4,2026-09-03,Kondisi stabil',
      'RM-00105,Hendra Gunawan,Rabu - Sabtu,Shift 1 (Pagi),10.2,2026-09-04,Maintenance EPO 1x 2000 IU',
      'RM-00106,Rina Kusumawati,Rabu - Sabtu,Shift 2 (Siang),12.6,2026-09-04,Hb tinggi - Hold EPO',
    ];
    const csvContent = '\uFEFF' + [header, ...sampleRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'Template_Data_Pasien_HD.csv';
    link.click();
  };

  // Upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        handleParseText(content);
        setActiveTab('paste');
        setStatusMessage({
          type: 'success',
          text: `File "${file.name}" berhasil diuraikan. Periksa pratinjau di bawah.`,
        });
      }
    };
    reader.readAsText(file);
  };

  // Muat Contoh 12 Pasien
  const handleLoadDemoBulk = () => {
    const demoCsv = `RM-01121\tTn. Aris Munandar\tSenin - Kamis\tShift 1 (Pagi)\t5.2\t${selectedMonth}-02\tAnemia berat ranap
RM-01122\tNy. Halimah\tSenin - Kamis\tShift 1 (Pagi)\t6.3\t${selectedMonth}-02\tTransfusi 1 bag HD
RM-01123\tTn. Faisal Basri\tSenin - Kamis\tShift 2 (Siang)\t7.5\t${selectedMonth}-02\tEPO 4x 2000 IU
RM-01124\tNy. Marlina\tSenin - Kamis\tShift 2 (Siang)\t8.8\t${selectedMonth}-02\tRespon baik
RM-02201\tTn. Slamet Riyadi\tSelasa - Jumat\tShift 1 (Pagi)\t5.8\t${selectedMonth}-03\tRanap transfusi 2 bag
RM-02202\tNy. Sri Mulyani\tSelasa - Jumat\tShift 1 (Pagi)\t6.8\t${selectedMonth}-03\tTransfusi 1 bag
RM-02203\tTn. Bambang Eko\tSelasa - Jumat\tShift 2 (Siang)\t8.2\t${selectedMonth}-03\tEPO 4x 2000 IU
RM-02204\tNy. Titik Puspa\tSelasa - Jumat\tShift 2 (Siang)\t10.5\t${selectedMonth}-03\tEPO maintenance 1x
RM-03301\tTn. Dedi Mizwar\tRabu - Sabtu\tShift 1 (Pagi)\t7.2\t${selectedMonth}-04\tEPO 4x 2000 IU
RM-03302\tNy. Nurlela\tRabu - Sabtu\tShift 1 (Pagi)\t9.4\t${selectedMonth}-04\tMaintenance 1x
RM-03303\tTn. Gunawan Wibowo\tRabu - Sabtu\tShift 2 (Siang)\t11.2\t${selectedMonth}-04\tTarget Hb tercapai
RM-03304\tNy. Endang Rahayu\tRabu - Sabtu\tShift 2 (Siang)\t12.8\t${selectedMonth}-04\tHold EPO (Hb > 12)`;

    handleParseText(demoCsv);
    setStatusMessage({
      type: 'success',
      text: '12 contoh pasien berhasil dimuat! Periksa tabel pratinjau di bawah lalu klik tombol Simpan.',
    });
  };

  // Tambah 1 baris manual di pratinjau
  const handleAddNewManualRow = () => {
    const nextIdx = parsedRows.length + 1;
    const defaultHbDate = getFirstHDDateOfMonth(selectedMonth, defaultSchedule).dateString;
    const newRow: ParsedRow = {
      id: `manual-${Date.now()}-${nextIdx}`,
      noRm: `RM-${10100 + nextIdx}`,
      name: '',
      scheduleDay: defaultSchedule,
      scheduleShift: defaultShift,
      hbValue: 0,
      hbDate: defaultHbDate,
      notes: '',
      isValid: false,
      errorMessage: 'Harap isi nama pasien',
    };
    setParsedRows((prev) => [...prev, newRow]);
  };

  // Update cell inline di preview
  const handleUpdateRowField = (id: string, field: keyof ParsedRow, value: any) => {
    setParsedRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        if (field === 'name' || field === 'hbValue') {
          const isValid = Boolean(updated.name.trim() && !isNaN(updated.hbValue) && updated.hbValue > 0);
          updated.isValid = isValid;
          updated.errorMessage = !isValid ? 'Kadar Hb atau Nama Pasien tidak valid' : undefined;
        }
        return updated;
      })
    );
  };

  // Simpan Seluruh Pasien ke State Aplikasi
  const handleExecuteImport = () => {
    const validRows = parsedRows.filter((r) => r.isValid);
    if (validRows.length === 0) {
      setStatusMessage({ type: 'error', text: 'Tidak ada data pasien yang valid untuk disimpan. Pastikan Nama dan Hb sudah terisi.' });
      return;
    }

    const createdPatients: PatientRecord[] = validRows.map((row, i) => {
      const reco = calculateClinicalRecommendation(row.hbValue, row.hdFrequency);
      const weeks = generateDefaultWeeks(reco.category, selectedMonth, row.hdFrequency);

      const fallbackDate = getFirstHDDateOfMonth(
        selectedMonth, 
        row.scheduleDay, 
        row.singleDay, 
        row.hdFrequency
      ).dateString;

      return {
        id: `bulk-${row.noRm.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now()}-${i}`,
        noRm: row.noRm,
        name: row.name,
        hdFrequency: row.hdFrequency || '2 kali dalam satu minggu',
        singleDay: row.singleDay,
        scheduleDay: row.scheduleDay,
        scheduleShift: row.scheduleShift,
        hbValue: row.hbValue,
        hbDate: row.hbDate || fallbackDate,
        monthPeriod: selectedMonth,
        recommendation: reco,
        weeks,
        overallStatus: reco.category === 'TRANSFUSI_2_RAWAT_INAP' ? 'Perlu Perhatian' : 'Berjalan',
        clinicalNotes: row.notes,
        doctorInCharge: 'dr. Sp.PD-KGH',
        updatedAt: new Date().toISOString(),
      };
    });

    onImportPatients(createdPatients, importMode);
    onClose();
  };

  // Hapus satu baris dari pratinjau
  const handleRemoveRow = (id: string) => {
    setParsedRows((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-1 flex flex-col max-h-[88vh]">
        
        {/* Header Modal (Pinned) */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-rose-700 text-white flex items-center justify-center shadow-xs shrink-0">
              <ClipboardPaste className="w-4 h-4 text-rose-100" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                Input Data Pasien Massal
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Salin-tempel langsung dari Excel / Google Sheets atau unggah berkas CSV
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Opsi Input (Pinned) */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-850 p-1.5 gap-1.5 text-xs font-semibold shrink-0">
          <button
            onClick={() => setActiveTab('paste')}
            className={`flex-1 h-8 px-2.5 rounded-md flex items-center justify-center gap-1.5 transition cursor-pointer text-xs ${
              activeTab === 'paste'
                ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            <span>1. Salin-Tempel Excel / Sheets</span>
          </button>

          <button
            onClick={() => setActiveTab('file')}
            className={`flex-1 h-8 px-2.5 rounded-md flex items-center justify-center gap-1.5 transition cursor-pointer text-xs ${
              activeTab === 'file'
                ? 'bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-400 shadow-2xs font-bold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>2. Unggah File CSV</span>
          </button>

          <button
            onClick={handleLoadDemoBulk}
            className="h-8 px-3 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition flex items-center gap-1.5 border border-indigo-200 dark:border-indigo-800 font-semibold text-xs cursor-pointer shrink-0"
            title="Muat 12 data pasien contoh"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>Isi 12 Contoh</span>
          </button>
        </div>

        {/* Modal Body (Compact & Scrollable) */}
        <div className="p-3 space-y-2.5 text-xs overflow-y-auto flex-1">
          
          {/* Status Message */}
          {statusMessage && (
            <div className={`p-2 rounded-lg flex items-start gap-1.5 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950 dark:text-rose-300'
            }`}>
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-600" />
              )}
              <span className="text-[11px]">{statusMessage.text}</span>
            </div>
          )}

          {/* Opsi Jadwal Default jika teks yang disalin tidak menyertakan kolom jadwal */}
          <div className="p-2 bg-slate-50 dark:bg-slate-850 rounded-lg border border-slate-200 dark:border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700 dark:text-slate-300 text-[11px]">Bawaan Jika Kolom Kosong:</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span className="text-[10px] text-slate-500">Jadwal:</span>
                <select
                  value={defaultSchedule}
                  onChange={(e) => {
                    const newDay = e.target.value as HDDaySchedule;
                    setDefaultSchedule(newDay);
                    if (pasteText) handleParseText(pasteText, newDay, defaultShift);
                  }}
                  className="px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-[11px] font-semibold focus:outline-hidden"
                >
                  <option value="Senin - Kamis">Senin - Kamis</option>
                  <option value="Selasa - Jumat">Selasa - Jumat</option>
                  <option value="Rabu - Sabtu">Rabu - Sabtu</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span className="text-[10px] text-slate-500">Shift:</span>
                <select
                  value={defaultShift}
                  onChange={(e) => {
                    const newShift = e.target.value as HDShift;
                    setDefaultShift(newShift);
                    if (pasteText) handleParseText(pasteText, defaultSchedule, newShift);
                  }}
                  className="px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-[11px] font-semibold focus:outline-hidden"
                >
                  <option value="Shift 1 (Pagi)">Shift 1 (Pagi)</option>
                  <option value="Shift 2 (Siang)">Shift 2 (Siang)</option>
                </select>
              </div>
            </div>
          </div>

          {/* TAB 1: PASTE LANGSUNG DARI EXCEL / SHEETS */}
          {activeTab === 'paste' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] text-slate-500">
                <span>
                  <strong>Cara Cepat:</strong> Blok baris di Excel &rarr; <strong>Ctrl+C</strong> &rarr; Klik kotak di bawah &rarr; <strong>Ctrl+V</strong>.
                </span>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                >
                  <Download className="w-3 h-3" />
                  <span>Download Format CSV</span>
                </button>
              </div>

              <textarea
                rows={3}
                value={pasteText}
                onChange={(e) => handleParseText(e.target.value)}
                placeholder="Tempel baris Excel di sini (Ctrl+V)... Contoh: RM-00101	Budi Santoso	Senin - Kamis	Shift 1 (Pagi)	5.4"
                className="w-full p-2 font-mono text-[11px] rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-blue-500 focus:outline-hidden shadow-inner"
              />
            </div>
          )}

          {/* TAB 2: UPLOAD FILE CSV / EXCEL */}
          {activeTab === 'file' && (
            <div className="p-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg text-center space-y-2 bg-slate-50/50 dark:bg-slate-850">
              <FileSpreadsheet className="w-6 h-6 mx-auto text-blue-600" />
              <div>
                <h4 className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                  Pilih Berkas CSV Data Pasien
                </h4>
                <p className="text-[10px] text-slate-500">
                  Mendukung berkas teks CSV (*.csv) dengan pemisah koma, titik koma (;), atau tab.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md shadow-xs cursor-pointer transition text-xs">
                  <span>Pilih Berkas CSV</span>
                  <input
                    type="file"
                    accept=".csv,text/csv,text/plain"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-md hover:bg-slate-50 transition flex items-center gap-1 text-xs"
                >
                  <Download className="w-3 h-3" />
                  <span>Template</span>
                </button>
              </div>
            </div>
          )}

          {/* PRATINJAU HASIL & EDIT INTERAKTIF */}
          <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1 text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    Pratinjau ({parsedRows.length} Pasien):
                  </span>
                </h4>
                <button
                  type="button"
                  onClick={handleAddNewManualRow}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded font-semibold text-[10px] text-slate-700 dark:text-slate-200 flex items-center gap-1 border border-slate-300 dark:border-slate-700 transition cursor-pointer"
                >
                  <Plus className="w-2.5 h-2.5 text-blue-600" />
                  <span>Tambah Baris</span>
                </button>
              </div>

              {/* Mode Impor: Append vs Replace */}
              <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 text-[10px]">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                    className="accent-blue-600"
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    Tambahkan ke daftar
                  </span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="accent-rose-600"
                  />
                  <span className="text-rose-600 dark:text-rose-400 font-bold">
                    Ganti seluruh data
                  </span>
                </label>
              </div>
            </div>

            {/* Table Preview */}
            {parsedRows.length === 0 ? (
              <div className="p-4 text-center text-slate-400 bg-slate-50 dark:bg-slate-850 rounded-lg border border-dashed border-slate-200 dark:border-slate-700 text-[11px]">
                Belum ada data pasien. Tempel tabel dari Excel di atas atau klik tombol <strong>"Isi 12 Contoh"</strong>.
              </div>
            ) : (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-lg max-h-48 overflow-y-auto">
                <table className="w-full text-left text-[10px] border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0 font-semibold text-slate-700 dark:text-slate-300 z-10">
                    <tr className="border-b divide-x divide-slate-200 dark:divide-slate-700">
                      <th className="py-1 px-1.5 text-center w-7">No</th>
                      <th className="py-1 px-1.5 w-24">No. RM</th>
                      <th className="py-1 px-2">Nama Pasien</th>
                      <th className="py-1 px-1.5 w-28">Jadwal HD</th>
                      <th className="py-1 px-1 text-center w-16">Shift</th>
                      <th className="py-1 px-1 text-center w-14">Hb</th>
                      <th className="py-1 px-2">Dosis Terhitung</th>
                      <th className="py-1 px-1 text-center w-7">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {parsedRows.map((row, idx) => {
                      const reco = calculateClinicalRecommendation(row.hbValue);

                      return (
                        <tr
                          key={row.id}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-850 divide-x divide-slate-200 dark:divide-slate-800 ${
                            !row.isValid ? 'bg-rose-50/60 dark:bg-rose-950/40 text-rose-900' : ''
                          }`}
                        >
                          <td className="py-0.5 px-1 text-center font-mono text-slate-400">
                            {idx + 1}
                          </td>
                          
                          {/* No RM (editable) */}
                          <td className="py-0.5 px-1 font-mono">
                            <input
                              type="text"
                              value={row.noRm}
                              onChange={(e) => handleUpdateRowField(row.id, 'noRm', e.target.value)}
                              className="w-full px-1 py-0.5 bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 rounded font-semibold text-slate-800 dark:text-slate-200 focus:outline-hidden"
                            />
                          </td>

                          {/* Nama Pasien (editable) */}
                          <td className="py-0.5 px-1">
                            <input
                              type="text"
                              value={row.name}
                              placeholder="Nama..."
                              onChange={(e) => handleUpdateRowField(row.id, 'name', e.target.value)}
                              className="w-full px-1 py-0.5 bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 rounded font-bold text-slate-900 dark:text-white focus:outline-hidden"
                            />
                          </td>

                          {/* Jadwal HD (editable dropdown) */}
                          <td className="py-0.5 px-1">
                            <select
                              value={row.scheduleDay}
                              onChange={(e) => handleUpdateRowField(row.id, 'scheduleDay', e.target.value as HDDaySchedule)}
                              className="w-full px-0.5 py-0.5 bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-blue-700 dark:text-blue-400 font-semibold focus:outline-hidden text-[10px]"
                            >
                              <option value="Senin - Kamis">Senin - Kamis</option>
                              <option value="Selasa - Jumat">Selasa - Jumat</option>
                              <option value="Rabu - Sabtu">Rabu - Sabtu</option>
                            </select>
                          </td>

                          {/* Shift (editable dropdown) */}
                          <td className="py-0.5 px-1 text-center">
                            <select
                              value={row.scheduleShift}
                              onChange={(e) => handleUpdateRowField(row.id, 'scheduleShift', e.target.value as HDShift)}
                              className="px-0.5 py-0.5 bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 rounded text-[9px] font-semibold focus:outline-hidden"
                            >
                              <option value="Shift 1 (Pagi)">Pagi</option>
                              <option value="Shift 2 (Siang)">Siang</option>
                            </select>
                          </td>

                          {/* Hb (editable number) */}
                          <td className="py-0.5 px-1 text-center">
                            <input
                              type="number"
                              step="0.1"
                              value={row.hbValue}
                              onChange={(e) => handleUpdateRowField(row.id, 'hbValue', parseFloat(e.target.value) || 0)}
                              className={`w-12 text-center px-0.5 py-0.5 font-mono font-bold bg-transparent border border-transparent hover:border-slate-300 focus:border-blue-500 rounded focus:outline-hidden ${
                                row.hbValue < 6.0 ? 'text-rose-600' : 'text-slate-900 dark:text-white'
                              }`}
                            />
                          </td>

                          {/* Rekomendasi Klinis Otomatis */}
                          <td className="py-0.5 px-1.5">
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${reco.badgeBg} ${reco.badgeColor}`}>
                              {reco.title}
                            </span>
                          </td>

                          {/* Hapus baris */}
                          <td className="py-0.5 px-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(row.id)}
                              className="p-0.5 text-slate-400 hover:text-rose-600 transition rounded cursor-pointer"
                              title="Hapus baris"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer (Pinned) */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-500">
            {parsedRows.length > 0 && (
              <span>
                <strong>{parsedRows.filter((r) => r.isValid).length}</strong> dari <strong>{parsedRows.length}</strong> pasien siap disimpan.
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="h-8.5 px-3.5 rounded-lg font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition text-xs cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleExecuteImport}
              disabled={parsedRows.length === 0}
              className="h-8.5 px-4 rounded-lg font-semibold text-white bg-rose-700 hover:bg-rose-800 active:bg-rose-900 disabled:opacity-50 transition shadow-xs flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Simpan {parsedRows.length > 0 ? `${parsedRows.filter((r) => r.isValid).length} Pasien` : 'Pasien'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
