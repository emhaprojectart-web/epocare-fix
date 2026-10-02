import React, { useState } from 'react';
import { 
  X, 
  FileSpreadsheet, 
  Download, 
  CheckCircle2, 
  ShieldCheck, 
  Calendar, 
  Layers, 
  Users, 
  Sparkles,
  Droplet,
  Check
} from 'lucide-react';
import { PatientRecord, HDDaySchedule } from '../types/dialysis';
import { exportDialysisToExcel } from '../services/excelExport';

interface ExportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: PatientRecord[];
  selectedMonth: string;
  onMonthChange?: (month: string) => void;
  initialSchedule?: HDDaySchedule | 'ALL';
}

export const ExportExcelModal: React.FC<ExportExcelModalProps> = ({
  isOpen,
  onClose,
  patients,
  selectedMonth,
  onMonthChange,
  initialSchedule = 'ALL',
}) => {
  const [targetSchedule, setTargetSchedule] = useState<HDDaySchedule | 'ALL'>(initialSchedule);
  const [includeSummaryTab, setIncludeSummaryTab] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  // Pasien yang akan diekspor berdasarkan filter jadwal
  const exportPatients = targetSchedule === 'ALL'
    ? patients
    : patients.filter(p => p.scheduleDay === targetSchedule);

  const countPagi = exportPatients.filter(p => p.scheduleShift.includes('Pagi')).length;
  const countSiang = exportPatients.filter(p => p.scheduleShift.includes('Siang')).length;
  const countSelective = exportPatients.filter(p => (p.prevHbValue !== undefined && p.prevHbValue > 0 && p.prevHbValue < 9.0) || Boolean(p.isSelectiveHb)).length;

  const [yearStr, monthStr] = selectedMonth.split('-');
  const dateObj = new Date(parseInt(yearStr, 10) || 2026, (parseInt(monthStr, 10) || 9) - 1, 1);
  const monthName = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const handleExport = () => {
    try {
      setIsExporting(true);
      const result = exportDialysisToExcel(patients, {
        period: selectedMonth,
        targetSchedule,
        includeSummaryTab,
      });
      setDownloadSuccess(result.fileName);
      setTimeout(() => {
        setDownloadSuccess(null);
      }, 6000);
    } catch (err: any) {
      console.error('Export error:', err);
      alert(`Gagal mengekspor file Excel: ${err?.message || 'Terjadi kesalahan sistem'}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Modal */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-emerald-50/70 dark:bg-emerald-950/40">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-xs shrink-0">
              <FileSpreadsheet className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight flex items-center gap-2">
                <span>Ekspor File Excel (.xlsx)</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/80 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                  Bebas Login
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Unduh langsung matriks alokasi EPO dan jadwal harian ke komputer / HP
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-4 sm:p-5 space-y-4 text-xs overflow-y-auto flex-1">
          
          {/* Bebas Login Highlight Banner */}
          <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
              <strong className="font-bold">100% Offline & Tanpa Login:</strong> File Microsoft Excel (.xlsx) dibuat langsung oleh peramban web Anda. Tidak memerlukan login akun Google, email, ataupun kata sandi.
            </div>
          </div>

          {/* Notifikasi Download Sukses */}
          {downloadSuccess && (
            <div className="p-3 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 flex items-start gap-2 animate-in slide-in-from-top-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-xs">File Excel Berhasil Diunduh!</p>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 font-mono break-all mt-0.5">
                  {downloadSuccess}
                </p>
              </div>
            </div>
          )}

          {/* Pilihan Periode Bulan */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
              <Calendar className="w-3.5 h-3.5 text-rose-600" />
              <span>Periode Bulan Jadwal:</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => onMonthChange && onMonthChange(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-hidden cursor-pointer"
              />
              <span className="text-slate-500 dark:text-slate-400 font-medium">
                ({monthName})
              </span>
            </div>
          </div>

          {/* Pilihan Lembar Kerja (Sheets to Export) */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 text-xs">
              <Layers className="w-3.5 h-3.5 text-emerald-600" />
              <span>Pilihan Jadwal yang Diekspor:</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetSchedule('ALL')}
                className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col gap-1 ${
                  targetSchedule === 'ALL'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>Semua Jadwal (Lengkap)</span>
                  {targetSchedule === 'ALL' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  3 Sheet: Senin-Kamis, Selasa-Jumat, Rabu-Sabtu ({patients.length} Pasien)
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTargetSchedule('Senin - Kamis')}
                className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col gap-1 ${
                  targetSchedule === 'Senin - Kamis'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>Senin - Kamis Saja</span>
                  {targetSchedule === 'Senin - Kamis' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Hanya pasien jadwal Senin-Kamis ({patients.filter(p => p.scheduleDay === 'Senin - Kamis').length} Pasien)
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTargetSchedule('Selasa - Jumat')}
                className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col gap-1 ${
                  targetSchedule === 'Selasa - Jumat'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>Selasa - Jumat Saja</span>
                  {targetSchedule === 'Selasa - Jumat' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Hanya pasien jadwal Selasa-Jumat ({patients.filter(p => p.scheduleDay === 'Selasa - Jumat').length} Pasien)
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTargetSchedule('Rabu - Sabtu')}
                className={`p-2.5 rounded-lg border text-left transition cursor-pointer flex flex-col gap-1 ${
                  targetSchedule === 'Rabu - Sabtu'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                }`}
              >
                <div className="font-bold text-xs flex items-center justify-between">
                  <span>Rabu - Sabtu Saja</span>
                  {targetSchedule === 'Rabu - Sabtu' && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                  Hanya pasien jadwal Rabu-Sabtu ({patients.filter(p => p.scheduleDay === 'Rabu - Sabtu').length} Pasien)
                </p>
              </button>
            </div>
          </div>

          {/* Opsi Tambahan */}
          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeSummaryTab}
                onChange={(e) => setIncludeSummaryTab(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 dark:border-slate-600 cursor-pointer"
              />
              <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">
                Sertakan Tab Sheet "Rekapitulasi Pasien"
              </span>
            </label>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 pl-6">
              Berisi daftar seluruh nama, No. RM, Hb, Target EPO, Realisasi, Kebutuhan PRC, Status Cek Lab, dan Kategori Cek Hb Pilihan (&lt; 9.0 g/dL).
            </p>
          </div>

          {/* Rangkuman Data yang akan Diekspor */}
          <div className="p-3 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-[11px] space-y-1.5">
            <span className="font-bold text-slate-700 dark:text-slate-300 block">
              Ringkasan Data yang Diekspor:
            </span>
            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 text-[10px] block">Total Pasien</span>
                <span className="text-sm font-black text-slate-900 dark:text-white">{exportPatients.length}</span>
              </div>
              <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 text-[10px] block">Shift Pagi / Siang</span>
                <span className="text-xs font-bold text-rose-700 dark:text-rose-400">{countPagi} / {countSiang}</span>
              </div>
              <div className="bg-white dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700">
                <span className="text-slate-500 dark:text-slate-400 text-[10px] block">Cek Hb Pilihan</span>
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400">{countSelective}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-lg font-medium text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleExport}
            disabled={isExporting || exportPatients.length === 0}
            className="h-9 px-5 rounded-lg font-bold text-xs bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-md disabled:opacity-50 transition flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Membuat File Excel...' : 'Download File Excel (.xlsx)'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
