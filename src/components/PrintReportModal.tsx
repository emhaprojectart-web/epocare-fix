import React, { useRef } from 'react';
import { X, Printer, Download, FileText, CheckCircle2, Droplet, Syringe, Sparkles } from 'lucide-react';
import { PatientRecord, isSelectiveHbCandidate } from '../types/dialysis';

interface PrintReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: PatientRecord[];
  selectedMonth: string;
  onSwitchToEpoSchedule?: () => void;
}

// Daftar catatan klinis demo yang telah dihapus sesuai arahan
const isRemovedNote = (note?: string): boolean => {
  if (!note) return true;
  const lower = note.toLowerCase().trim();
  return (
    lower.includes('penjadwalan epo hari awal: pemberian epo tgl 7 september 2026 ditunda') ||
    lower.includes('pasien mengeluh lemas, konjungtiva anemis berat') ||
    lower.includes('hasil lab hb awal bulan belum diinputkan') ||
    lower.includes('transfusi 1 bag saat hd running') ||
    lower.includes('rutin epo 4x sebulan di hari awal (senin)') ||
    lower.includes('rutin epo 4x sebulan, periksa saturasi transferin') ||
    lower.includes('target hb tercapai stabil, maintenance 1 ampul di m1') ||
    lower.includes('hb di atas target 12 g/dl, tunda injeksi epo bulan ini') ||
    lower.includes('hb diatas 12.00 mg/dl')
  );
};

export const PrintReportModal: React.FC<PrintReportModalProps> = ({
  isOpen,
  onClose,
  patients,
  selectedMonth,
  onSwitchToEpoSchedule,
}) => {
  if (!isOpen) return null;

  // Format tanggal periode
  const [yearStr, monthStr] = selectedMonth.split('-');
  const dateObj = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
  const formattedMonth = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  // Ringkasan
  const ranap2Bag = patients.filter((p) => p.recommendation.category === 'TRANSFUSI_2_RAWAT_INAP');
  const transfusi1Bag = patients.filter((p) => p.recommendation.category === 'TRANSFUSI_1_KANTONG');
  const epo4x = patients.filter((p) => p.recommendation.category === 'EPO_4X_2000');
  const epo1x = patients.filter((p) => p.recommendation.category === 'EPO_1X_2000');
  const hold = patients.filter((p) => p.recommendation.category === 'HOLD_EVALUASI');
  const selectiveHbPatients = patients.filter(isSelectiveHbCandidate);

  const totalPrBags = (ranap2Bag.length * 2) + transfusi1Bag.length;
  const totalEpoVials = patients.reduce((sum, p) => sum + (p.recommendation.totalEpoVials || 0), 0);

  const reportAreaRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    try {
      window.focus();
      window.print();
    } catch (err) {
      console.warn('Gagal memicu window.print():', err);
      handleDownloadHtml();
    }
  };

  const handleDownloadHtml = () => {
    if (!reportAreaRef.current) return;
    const content = reportAreaRef.current.innerHTML;
    const htmlDoc = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Rekapitulasi Alokasi EPO & Transfusi HD - ${formattedMonth}</title>
  <style>
    @page { size: landscape; margin: 10mm; }
    body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; font-size: 11px; color: #0f172a; margin: 0; padding: 20px; background: #fff; }
    .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 14px; }
    .header h2 { font-size: 16px; margin: 0 0 4px 0; font-weight: 800; text-transform: uppercase; }
    .header h3 { font-size: 13px; margin: 0 0 4px 0; color: #be123c; font-weight: 700; text-transform: uppercase; }
    .header p { font-size: 10px; color: #64748b; margin: 0; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; background: #f8fafc; margin-bottom: 14px; font-size: 11px; }
    .summary-item span { font-size: 9px; color: #64748b; display: block; }
    .summary-item p { font-weight: 700; margin: 2px 0 0 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 10px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 6px; }
    th { background-color: #f1f5f9; font-weight: 700; text-align: left; }
    th.text-center, td.text-center { text-align: center; }
    .font-mono { font-family: monospace; }
    .font-bold { font-weight: 700; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); margin-top: 30px; text-align: center; font-size: 10px; page-break-inside: avoid; }
    .sig-line { border-bottom: 1px solid #94a3b8; margin: 45px 30px 6px; }
    @media print {
      body { padding: 0; }
      .summary-grid { background: transparent; }
    }
  </style>
</head>
<body>
  ${content}
</body>
</html>`;

    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Rekapitulasi-EPO-HD-${selectedMonth}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="print-modal-container fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-slate-900/60 backdrop-blur-xs print:p-0 print:bg-white print:static print:z-auto">
      <div className="print-modal-card bg-white dark:bg-slate-900 rounded-xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-1 flex flex-col max-h-[88vh] print:max-h-none print:h-auto print:overflow-visible print:border-none print:shadow-none print:m-0 print:w-full">
        
        {/* Header - Not printed (Pinned) */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850 print:hidden shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-rose-700 text-white flex items-center justify-center shrink-0">
              <Printer className="w-4 h-4 text-rose-100" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                Pratinjau Rekapitulasi Alokasi EPO & Transfusi HD
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Dokumen resmi untuk Depo Farmasi, Ruang HD, dan DPJP
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onSwitchToEpoSchedule && (
              <button
                type="button"
                onClick={onSwitchToEpoSchedule}
                className="h-8.5 inline-flex items-center gap-1.5 px-3 text-xs font-semibold rounded-lg text-teal-800 dark:text-teal-200 bg-teal-100 hover:bg-teal-200 dark:bg-teal-950 dark:hover:bg-teal-900 border border-teal-300 dark:border-teal-700 transition cursor-pointer"
                title="Buka tabel jadwal pemberian EPO per shift & hari"
              >
                <Syringe className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>Jadwal EPO per Shift</span>
              </button>
            )}
            <button
              type="button"
              onClick={handlePrint}
              className="h-8.5 inline-flex items-center gap-1.5 px-3.5 text-xs font-semibold rounded-lg text-white bg-rose-700 hover:bg-rose-800 active:bg-rose-900 shadow-xs transition cursor-pointer"
              title="Cetak langsung atau simpan sebagai file PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Paper Area (Compact & Scrollable) */}
        <div 
          ref={reportAreaRef}
          id="printable-report-area"
          className="print-modal-scrollable p-4 sm:p-5 overflow-y-auto print:p-0 print:overflow-visible bg-white text-slate-900 dark:bg-slate-900 dark:text-white text-xs flex-1 print:text-black print:bg-white"
        >
          
          {/* Hospital Header / Kop Surat */}
          <div className="border-b-2 border-slate-900 dark:border-slate-100 pb-2 mb-3 text-center">
            <h2 className="text-sm sm:text-base font-extrabold tracking-wide">
              Unit Dialisis RS Happy Land Medical Centre Yogyakarta
            </h2>
            <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
              REKAPITULASI ALOKASI ERITROPOIETIN & RENCANA TRANSFUSI DARAH PASIEN HD
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Periode Evaluasi Hb Awal Bulan: <strong>{formattedMonth}</strong> • Dicetak: {new Date().toLocaleDateString('id-ID', { dateStyle: 'medium' })}
            </p>
          </div>

          {/* Ringkasan Kebutuhan Farmasi & Bank Darah */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3 p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 text-xs">
            <div>
              <span className="text-[10px] text-slate-500">Total Pasien:</span>
              <p className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">{patients.length} Pasien</p>
            </div>
            <div>
              <span className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">Cek Hb Pilihan:</span>
              <p className="font-bold text-xs sm:text-sm text-amber-600 dark:text-amber-400">{selectiveHbPatients.length} Pasien (&lt; 9.0)</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500">Alokasi EPO 2000 IU:</span>
              <p className="font-bold text-xs sm:text-sm text-blue-600 dark:text-blue-400">
                {totalEpoVials} Ampul ({totalEpoVials * 2000} IU)
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500">Kebutuhan PRC:</span>
              <p className="font-bold text-xs sm:text-sm text-rose-600 dark:text-rose-400">{totalPrBags} Kantong</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500">Rincian Transfusi:</span>
              <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                {ranap2Bag.length} Ranap (2 Bag) • {transfusi1Bag.length} HD (1 Bag)
              </p>
            </div>
          </div>

          {/* Patient Detail Table */}
          <table className="w-full border-collapse border border-slate-300 dark:border-slate-700 text-[10px] mb-4">
            <thead>
              <tr className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                <th className="border border-slate-300 dark:border-slate-700 p-1 text-center w-7">No</th>
                <th className="border border-slate-300 dark:border-slate-700 p-1 text-left">No. RM</th>
                <th className="border border-slate-300 dark:border-slate-700 p-1 text-left">Nama Pasien</th>
                <th className="border border-slate-300 dark:border-slate-700 p-1 text-left">Jadwal HD</th>
                <th className="border border-slate-300 dark:border-slate-700 p-1 text-center">Hb</th>
                <th className="border border-slate-300 dark:border-slate-700 p-1 text-left">Rekomendasi Klinis</th>
                <th className="border border-slate-300 dark:border-slate-700 p-1 text-center w-10">M1</th>
                <th className="border border-slate-300 dark:border-slate-700 p-1 text-center w-10">M2</th>
                <th className="border border-slate-300 dark:border-slate-700 p-1 text-center w-10">M3</th>
                <th className="border border-slate-300 dark:border-slate-700 p-1 text-center w-10">M4</th>
                <th className="border border-slate-300 dark:border-slate-700 p-1 text-left">Catatan</th>
              </tr>
            </thead>
            <tbody>
              {patients.map((p, idx) => (
                <tr key={`${p.id || p.noRm}-${idx + 1}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="border border-slate-300 dark:border-slate-700 p-1 text-center font-mono">
                    {idx + 1}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 p-1 font-mono font-semibold">
                    {p.noRm}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 p-1 font-bold">
                    <div className="flex items-center gap-1 flex-wrap">
                      <span>{p.name}</span>
                      {isSelectiveHbCandidate(p) && (
                        <span className="px-1 py-0.2 rounded text-[7.5px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                          ⭐ Cek Pilihan
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 p-1">
                    <div>{p.scheduleDay}</div>
                    {p.hdFrequency && (
                      <span className="text-[9px] text-slate-500 font-medium">
                        {p.hdFrequency.includes('1 kali') ? '1x/mgg' : '2x/mgg'}
                      </span>
                    )}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 p-1 text-center font-bold font-mono">
                    {p.hbValue.toFixed(1)}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 p-1">
                    <span className="font-semibold">{p.recommendation.title}</span>
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 p-1 text-center">
                    {p.weeks.week1.status === 'Tidak Ada Jadwal' ? '-' : p.weeks.week1.status}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 p-1 text-center">
                    {p.weeks.week2.status === 'Tidak Ada Jadwal' ? '-' : p.weeks.week2.status}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 p-1 text-center">
                    {p.weeks.week3.status === 'Tidak Ada Jadwal' ? '-' : p.weeks.week3.status}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 p-1 text-center">
                    {p.weeks.week4.status === 'Tidak Ada Jadwal' ? '-' : p.weeks.week4.status}
                  </td>
                  <td className="border border-slate-300 dark:border-slate-700 p-1 text-slate-500">
                    {(!p.clinicalNotes || isRemovedNote(p.clinicalNotes)) ? '-' : p.clinicalNotes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Lembar Tanda Tangan Resmi */}
          <div className="grid grid-cols-3 gap-4 pt-3 text-center text-[10px] break-inside-avoid">
            <div>
              <p className="text-slate-500 mb-6">Disiapkan Oleh (Perawat HD):</p>
              <div className="border-b border-slate-400 mx-6"></div>
              <p className="font-bold mt-1">( ............................................ )</p>
              <p className="text-[9px] text-slate-500">NIP / Perawat Penanggung Jawab</p>
            </div>
            <div>
              <p className="text-slate-500 mb-6">Petugas Depo Farmasi:</p>
              <div className="border-b border-slate-400 mx-6"></div>
              <p className="font-bold mt-1">( ............................................ )</p>
              <p className="text-[9px] text-slate-500">Apoteker / Farmasi Klinis</p>
            </div>
            <div>
              <p className="text-slate-500 mb-6">Mengetahui (Dokter DPJP):</p>
              <div className="border-b border-slate-400 mx-6"></div>
              <p className="font-bold mt-1">dr. Sp.PD-KGH</p>
              <p className="text-[9px] text-slate-500">SIP: ............................................</p>
            </div>
          </div>

        </div>

        {/* Modal Bottom Footer (Pinned) */}
        <div className="px-3.5 py-2 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between print:hidden shrink-0">
          <span className="text-[10px] text-slate-500">
            Total {patients.length} Pasien • {totalEpoVials} ampul EPO
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadHtml}
              className="px-3 py-1.5 rounded-md font-semibold text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750 transition cursor-pointer inline-flex items-center gap-1.5 shadow-2xs"
              title="Unduh laporan dalam format dokumen HTML mandiri (bisa dibuka di browser dan langsung disimpan PDF)"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Unduh File (.html)</span>
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 rounded-md font-bold text-xs text-white bg-rose-700 hover:bg-rose-800 active:bg-rose-900 shadow-xs transition cursor-pointer inline-flex items-center gap-1.5"
              title="Buka dialog cetak browser atau Simpan sebagai PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / Simpan PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-md font-medium text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
