import React from 'react';
import { User } from 'firebase/auth';
import { 
  Activity, 
  FileSpreadsheet, 
  Calculator, 
  Printer, 
  Plus, 
  RefreshCw, 
  Calendar,
  CheckCircle2,
  AlertCircle,
  ClipboardPaste,
  Droplet,
  ExternalLink,
  FlaskConical,
  CalendarDays,
  Layers,
  ChevronLeft,
  ChevronRight,
  Syringe
} from 'lucide-react';
import { SpreadsheetConfig } from '../types/dialysis';
import { OFFICIAL_SPREADSHEET_URL } from '../services/googleSheets';

interface HeaderProps {
  user: User | null;
  spreadsheetConfig: SpreadsheetConfig | null;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  onOpenSyncModal: () => void;
  onOpenMonthlyHbModal: () => void;
  onOpenLabScheduleModal: () => void;
  onOpenCalculatorModal: () => void;
  onOpenPrintModal: () => void;
  onOpenEpoSchedulePrintModal?: () => void;
  onOpenExportExcelModal: () => void;
  onOpenAddPatientModal: () => void;
  onOpenBulkImportModal: () => void;
  onOpenWorkflowGuide?: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
  isSyncing: boolean;
  isLoggingIn: boolean;
  pendingHbCount?: number;
  scheduledLabCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  spreadsheetConfig,
  selectedMonth,
  onMonthChange,
  onOpenSyncModal,
  onOpenMonthlyHbModal,
  onOpenLabScheduleModal,
  onOpenCalculatorModal,
  onOpenPrintModal,
  onOpenEpoSchedulePrintModal,
  onOpenExportExcelModal,
  onOpenAddPatientModal,
  onOpenBulkImportModal,
  onOpenWorkflowGuide,
  onSignIn,
  onSignOut,
  isSyncing,
  isLoggingIn,
  pendingHbCount,
  scheduledLabCount,
}) => {
  const isConnected = Boolean(
    spreadsheetConfig?.appsScriptUrl || 
    (spreadsheetConfig?.spreadsheetId && spreadsheetConfig.spreadsheetId !== 'appsscript-connected')
  );

  // URL Google Sheets untuk tombol "Buka Sheet"
  const googleSheetUrl =
    spreadsheetConfig?.spreadsheetUrl ||
    (spreadsheetConfig?.spreadsheetId && spreadsheetConfig.spreadsheetId !== 'appsscript-connected'
      ? `https://docs.google.com/spreadsheets/d/${spreadsheetConfig.spreadsheetId}/edit`
      : OFFICIAL_SPREADSHEET_URL);

  // Format Bulan untuk Item 10: misal "Oktober 2026"
  const [yearStr, monthStr] = (selectedMonth || '2026-10').split('-');
  const dateObj = new Date(parseInt(yearStr, 10) || 2026, (parseInt(monthStr, 10) || 10) - 1, 1);
  const formattedMonth = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const handlePrevMonth = () => {
    const [y, m] = (selectedMonth || '2026-10').split('-').map(Number);
    const prevDate = new Date(y, m - 2, 1);
    const prevStr = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange(prevStr);
  };

  const handleNextMonth = () => {
    const [y, m] = (selectedMonth || '2026-10').split('-').map(Number);
    const nextDate = new Date(y, m, 1);
    const nextStr = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
    onMonthChange(nextStr);
  };

  return (
    <header className="bg-gradient-to-r from-rose-900 via-rose-800 to-slate-900 text-white border-b border-rose-700/50 sticky top-0 z-30 shadow-md backdrop-blur-md">
      <div className="max-w-[1600px] 2xl:max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          
          {/* Brand & Subtitle (Proportional Logo & Text) */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-lg bg-rose-700/80 border border-rose-500/50 text-white flex items-center justify-center shadow-xs shrink-0">
              <Activity className="w-5 h-5 text-rose-100" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight leading-tight">
                  EPOCARE
                </h1>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-rose-950/60 text-rose-200 border border-rose-700/60">
                  Dialisis
                </span>
              </div>
              <p className="text-[11px] text-rose-200/90 leading-tight">
                RS Happy Land Medical Centre Yogyakarta
              </p>
            </div>
          </div>

          {/* Controls & Action Buttons Bar — Urutan 1 s/d 10 Sesuai Permintaan */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* 1. Alur Penggunaan */}
            {onOpenWorkflowGuide && (
              <button
                onClick={onOpenWorkflowGuide}
                className="h-8.5 inline-flex items-center gap-1.5 px-2.5 text-xs font-semibold rounded-lg text-white bg-slate-800/90 hover:bg-slate-700 active:bg-slate-900 border border-slate-600/70 transition cursor-pointer shadow-2xs backdrop-blur-xs"
                title="Panduan 6 Runtutan Alur Penggunaan Aplikasi (Cek Hb, Input Nilai, Alokasi EPO/PRC, dan Penjadwalan Bulan Depan)"
              >
                <Layers className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>Alur Penggunaan</span>
              </button>
            )}

            {/* 2. Jadwal Cek HB */}
            <button
              onClick={onOpenLabScheduleModal}
              className="h-8.5 inline-flex items-center gap-1.5 px-3 text-xs font-bold rounded-lg text-white bg-indigo-900/80 hover:bg-indigo-800 active:bg-indigo-950 border border-indigo-500/70 hover:border-indigo-400 transition cursor-pointer shadow-xs backdrop-blur-xs"
              title="Buat dan atur penjadwalan pemeriksaan Cek Hb untuk bulan selanjutnya"
            >
              <CalendarDays className="w-3.5 h-3.5 text-indigo-200 shrink-0" />
              <span>Jadwal Cek HB</span>
              {scheduledLabCount !== undefined && scheduledLabCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-400 text-amber-950 shrink-0 shadow-2xs">
                  {scheduledLabCount}
                </span>
              )}
            </button>

            {/* 3. Input Nilai HB */}
            <button
              onClick={onOpenMonthlyHbModal}
              className="h-8.5 inline-flex items-center gap-1.5 px-3 text-xs font-semibold rounded-lg text-white bg-rose-700 hover:bg-rose-600 active:bg-rose-800 border border-rose-500/60 shadow-xs transition cursor-pointer"
              title="Input / Perbarui Nilai Hb Laboratorium Awal Bulan Seluruh Pasien"
            >
              <Droplet className="w-3.5 h-3.5 fill-white text-white shrink-0" />
              <span>Input Nilai HB</span>
              {pendingHbCount !== undefined && pendingHbCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-300 text-amber-950" title={`${pendingHbCount} pasien belum memiliki hasil Hb (Hb: 0)`}>
                  {pendingHbCount}
                </span>
              )}
            </button>

            {/* 4. Kalkulator */}
            <button
              onClick={onOpenCalculatorModal}
              className="h-8.5 inline-flex items-center gap-1.5 px-2.5 text-xs font-medium rounded-lg text-white bg-rose-950/40 hover:bg-rose-950/70 border border-rose-700/50 transition cursor-pointer shadow-2xs backdrop-blur-xs"
              title="Kalkulator klinis cepat untuk dosis Hb"
            >
              <Calculator className="w-3.5 h-3.5 text-rose-300 shrink-0" />
              <span>Kalkulator</span>
            </button>

            {/* 5. Cetak Rekap Bulanan */}
            <button
              onClick={onOpenPrintModal}
              className="h-8.5 inline-flex items-center gap-1.5 px-2.5 text-xs font-medium rounded-lg text-white bg-rose-950/40 hover:bg-rose-950/70 border border-rose-700/50 transition cursor-pointer shadow-2xs backdrop-blur-xs"
              title="Cetak format rekapitulasi untuk Depo Farmasi & DPJP"
            >
              <Printer className="w-3.5 h-3.5 text-rose-200 shrink-0" />
              <span>Cetak Rekap</span>
            </button>

            {/* Cetak Jadwal EPO (Tabel per Shift & Hari) */}
            {onOpenEpoSchedulePrintModal && (
              <button
                onClick={onOpenEpoSchedulePrintModal}
                className="h-8.5 inline-flex items-center gap-1.5 px-2.5 text-xs font-bold rounded-lg text-white bg-teal-800/80 hover:bg-teal-700 active:bg-teal-900 border border-teal-500/70 transition cursor-pointer shadow-2xs backdrop-blur-xs"
                title="Cetak tabel daftar nama pasien yang diberikan terapi EPO di setiap shift dan setiap harinya"
              >
                <Syringe className="w-3.5 h-3.5 text-teal-200 shrink-0" />
                <span>Cetak Jadwal EPO</span>
              </button>
            )}

            {/* 6. Ekspor Excel */}
            <button
              onClick={onOpenExportExcelModal}
              className="h-8.5 inline-flex items-center gap-1.5 px-2.5 text-xs font-semibold rounded-lg text-white bg-emerald-800/80 hover:bg-emerald-700 active:bg-emerald-900 border border-emerald-500/60 transition cursor-pointer shadow-2xs backdrop-blur-xs"
              title="Ekspor data bulanan ke file Microsoft Excel (.xlsx) tanpa perlu login akun Google"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200 shrink-0" />
              <span>Ekspor Excel</span>
            </button>

            {/* 7. Sheets Aktif */}
            <button
              onClick={onOpenSyncModal}
              disabled={isSyncing}
              className={`h-8.5 inline-flex items-center gap-1.5 px-2.5 text-xs font-medium rounded-lg border transition cursor-pointer shadow-2xs backdrop-blur-xs ${
                isConnected
                  ? 'bg-emerald-950/70 text-emerald-200 border-emerald-600/60 hover:bg-emerald-900/80'
                  : 'bg-rose-950/50 text-rose-200 border-rose-700/60 hover:bg-rose-950/80'
              }`}
              title="Status sinkronisasi Google Sheets"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Sheets Aktif</span>
              {isSyncing ? (
                <RefreshCw className="w-3 h-3 animate-spin text-emerald-400 shrink-0" />
              ) : isConnected ? (
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
              )}
            </button>

            {/* 8. Buka Sheet */}
            <a
              href={googleSheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="h-8.5 inline-flex items-center gap-1.5 px-3 text-xs font-bold rounded-lg text-white bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 border border-emerald-400/80 transition cursor-pointer shadow-xs shrink-0"
              title="Buka dokumen Google Sheets di tab browser baru"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-white shrink-0" />
              <span>Buka Sheet</span>
              <ExternalLink className="w-3 h-3 text-emerald-100 shrink-0" />
            </a>

            {/* 9. Import Excel */}
            <button
              onClick={onOpenBulkImportModal}
              className="h-8.5 inline-flex items-center gap-1.5 px-3 text-xs font-medium rounded-lg text-white bg-rose-950/40 hover:bg-rose-950/70 border border-rose-700/50 transition cursor-pointer shadow-2xs backdrop-blur-xs"
              title="Input banyak pasien sekaligus dengan Copy-Paste dari Excel atau file CSV"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-rose-300 shrink-0" />
              <span>Import Excel</span>
            </button>

            {/* 10. Navigasi Bulan: < Bulan : Oktober 2026 > */}
            <div 
              className="h-8.5 inline-flex items-center rounded-lg border border-rose-600/70 bg-rose-950/70 backdrop-blur-xs shadow-2xs overflow-hidden"
              title="Navigasi bulan alokasi (klik tombol panah atau klik teks bulan)"
            >
              <button
                type="button"
                onClick={handlePrevMonth}
                title="Pindah ke Bulan Sebelumnya"
                className="h-full px-2 hover:bg-rose-800/80 text-rose-200 hover:text-white transition cursor-pointer border-r border-rose-700/50 flex items-center justify-center"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <div 
                className="relative h-full flex items-center gap-1.5 px-2 text-xs cursor-pointer hover:bg-rose-900/60 transition"
                title="Klik untuk memilih bulan & tahun secara langsung"
              >
                <Calendar className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                <span className="text-[11px] font-semibold text-rose-200 hidden sm:inline">Bulan :</span>
                <span className="font-bold text-white text-xs tracking-tight capitalize">{formattedMonth}</span>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => onMonthChange(e.target.value)}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  title="Pilih Bulan & Tahun"
                />
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                title="Pindah ke Bulan Selanjutnya"
                className="h-full px-2 hover:bg-rose-800/80 text-rose-200 hover:text-white transition cursor-pointer border-l border-rose-700/50 flex items-center justify-center"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Tambah Pasien Baru */}
            <button
              onClick={onOpenAddPatientModal}
              className="h-8.5 inline-flex items-center gap-1.5 px-3 text-xs font-bold rounded-lg text-rose-950 bg-white hover:bg-rose-50 active:bg-rose-100 shadow-sm transition cursor-pointer shrink-0"
              title="Tambah 1 data pasien hemodialisa baru"
            >
              <Plus className="w-3.5 h-3.5 text-rose-900 shrink-0" />
              <span>Tambah Pasien</span>
            </button>

          </div>

        </div>
      </div>
    </header>
  );
};
