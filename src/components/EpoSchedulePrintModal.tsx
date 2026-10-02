import React, { useState, useRef, useMemo } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Check, 
  Copy,
  CalendarDays,
  FileSpreadsheet,
  RefreshCw
} from 'lucide-react';
import { PatientRecord } from '../types/dialysis';
import { 
  getMonthDaysInfo, 
  getDateDoseDisplayInfo, 
  DateDoseInfo
} from '../services/googleSheets';

interface EpoSchedulePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: PatientRecord[];
  selectedMonth: string;
}

interface DayScheduleData {
  dateNumber: number;
  dateString: string;
  dayName: string;
  fullDateTitle: string;
  pagiPatients: { name: string; noRm: string; status: string; hb: number }[];
  siangPatients: { name: string; noRm: string; status: string; hb: number }[];
  totalEpo: number;
}

export const EpoSchedulePrintModal: React.FC<EpoSchedulePrintModalProps> = ({
  isOpen,
  onClose,
  patients,
  selectedMonth,
}) => {
  if (!isOpen) return null;

  // View mode: 'SINGLE_DAY' (Satu Tanggal Sesuai Gambar) | 'ALL_DAYS' (Semua Hari di Bulan Ini)
  const [viewMode, setViewMode] = useState<'SINGLE_DAY' | 'ALL_DAYS'>('SINGLE_DAY');

  // Opsi Tambahan: Tampilkan No. RM di samping nama pasien
  const [showNoRm, setShowNoRm] = useState<boolean>(false);

  // Opsi Tambahan: Tampilkan Status Tindakan (✅ / 2000)
  const [showStatus, setShowStatus] = useState<boolean>(false);

  // Status Copy ke Clipboard
  const [copied, setCopied] = useState<boolean>(false);

  // Status proses cetak
  const [isPrinting, setIsPrinting] = useState<boolean>(false);
  const [printFeedback, setPrintFeedback] = useState<string | null>(null);

  const reportAreaRef = useRef<HTMLDivElement>(null);

  // Informasi hari & kalender
  const monthInfo = useMemo(() => getMonthDaysInfo(selectedMonth), [selectedMonth]);

  // Parsing bulan & tahun
  const [yearStr, monthStr] = selectedMonth.split('-');
  const year = parseInt(yearStr, 10) || 2026;
  const month = parseInt(monthStr, 10) || 10;
  const dateObj = new Date(year, month - 1, 1);
  const formattedMonth = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  // Data per hari terstruktur
  const daysData = useMemo(() => {
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const list: DayScheduleData[] = [];

    for (let d = 1; d <= monthInfo.daysInMonth; d++) {
      const dayData = monthInfo.days[d - 1];
      if (!dayData) continue;

      const pagiList: { name: string; noRm: string; status: string; hb: number }[] = [];
      const siangList: { name: string; noRm: string; status: string; hb: number }[] = [];

      patients.forEach((patient) => {
        const info: DateDoseInfo = getDateDoseDisplayInfo(patient, d, monthInfo);
        
        // Pasien yang terjadwal (2000), sudah diberikan (✅), atau ditunda (❌)
        if (info.cellCode === '2000' || info.cellCode === '✅' || info.cellCode === '❌') {
          const isPagi = patient.scheduleShift.includes('Pagi');
          const item = {
            name: patient.name,
            noRm: patient.noRm,
            status: info.cellCode === '✅' ? '✓ Selesai' : info.cellCode === '❌' ? '✕ Ditunda' : '2000',
            hb: patient.hbValue,
          };

          if (isPagi) {
            pagiList.push(item);
          } else {
            siangList.push(item);
          }
        }
      });

      // Urutkan nama pasien
      pagiList.sort((a, b) => a.name.localeCompare(b.name, 'id'));
      siangList.sort((a, b) => a.name.localeCompare(b.name, 'id'));

      const dayName = dayNames[dayData.dayOfWeek] || 'Hari';
      const fullDateTitle = `${dayName}, ${d} ${formattedMonth}`;

      list.push({
        dateNumber: d,
        dateString: dayData.dateString,
        dayName,
        fullDateTitle,
        pagiPatients: pagiList,
        siangPatients: siangList,
        totalEpo: pagiList.length + siangList.length,
      });
    }

    return list;
  }, [patients, monthInfo, formattedMonth]);

  // Daftar hari yang memiliki pasien EPO
  const activeEpoDays = useMemo(() => {
    return daysData.filter((d) => d.totalEpo > 0);
  }, [daysData]);

  // Tanggal aktif untuk mode SINGLE_DAY (default: hari ini atau hari pertama yang memiliki pasien EPO)
  const [selectedDateNumber, setSelectedDateNumber] = useState<number>(() => {
    const today = new Date().getDate();
    const hasToday = activeEpoDays.some((d) => d.dateNumber === today);
    if (hasToday) return today;
    return activeEpoDays[0]?.dateNumber || 1;
  });

  // Data hari yang dipilih
  const currentDayData = useMemo(() => {
    return daysData.find((d) => d.dateNumber === selectedDateNumber) || daysData[0];
  }, [daysData, selectedDateNumber]);

  // Navigasi ke hari sebelumnya / selanjutnya yang ada pasien EPO
  const handlePrevDay = () => {
    if (activeEpoDays.length === 0) return;
    const currentIndex = activeEpoDays.findIndex((d) => d.dateNumber === selectedDateNumber);
    if (currentIndex > 0) {
      setSelectedDateNumber(activeEpoDays[currentIndex - 1].dateNumber);
    } else {
      setSelectedDateNumber(activeEpoDays[activeEpoDays.length - 1].dateNumber);
    }
  };

  const handleNextDay = () => {
    if (activeEpoDays.length === 0) return;
    const currentIndex = activeEpoDays.findIndex((d) => d.dateNumber === selectedDateNumber);
    if (currentIndex >= 0 && currentIndex < activeEpoDays.length - 1) {
      setSelectedDateNumber(activeEpoDays[currentIndex + 1].dateNumber);
    } else {
      setSelectedDateNumber(activeEpoDays[0].dateNumber);
    }
  };

  // Fungsi untuk menghasilkan HTML tabel satu hari persis seperti gambar
  const generateDayTableHtml = (day: DayScheduleData): string => {
    const maxRows = Math.max(day.pagiPatients.length, day.siangPatients.length, 4);
    let rowsHtml = '';

    for (let i = 0; i < maxRows; i++) {
      const pPagi = day.pagiPatients[i];
      const pSiang = day.siangPatients[i];

      const pagiText = pPagi 
        ? `${pPagi.name}${showNoRm ? ` (${pPagi.noRm})` : ''}${showStatus ? ` [${pPagi.status}]` : ''}` 
        : '&nbsp;';
      const siangText = pSiang 
        ? `${pSiang.name}${showNoRm ? ` (${pSiang.noRm})` : ''}${showStatus ? ` [${pSiang.status}]` : ''}` 
        : '&nbsp;';

      rowsHtml += `
        <tr>
          <td style="border: 1px solid #000; text-align: center; font-weight: bold; background-color: #fff; padding: 6px 8px; width: 55px; vertical-align: middle;">
            ${i + 1}
          </td>
          <td style="border: 1px solid #000; background-color: #a4c2f4 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color: #000; padding: 6px 10px; font-weight: 500; vertical-align: middle;">
            ${pagiText}
          </td>
          <td style="border: 1px solid #000; background-color: #f9cb9c !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color: #000; padding: 6px 10px; font-weight: 500; vertical-align: middle;">
            ${siangText}
          </td>
        </tr>
      `;
    }

    return `
      <div style="width: 100%; max-width: 580px; margin: 0 auto 30px auto; page-break-inside: avoid;">
        <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #000; table-layout: fixed; font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #000;">
          <thead>
            <tr>
              <th style="border: none; width: 55px; padding: 0 0 6px 0;"></th>
              <th colspan="2" style="border: none; text-align: center; font-weight: bold; font-size: 13pt; text-transform: uppercase; padding: 0 0 8px 0; color: #000;">
                JADWAL PEMBERIAN EPO
              </th>
            </tr>
            <tr>
              <th style="border: 1px solid #000; background-color: #fff; text-align: center; font-weight: bold; padding: 6px 8px; width: 55px; color: #000;">
                NO
              </th>
              <th colspan="2" style="border: 1px solid #000; background-color: #fff; text-align: center; font-weight: bold; padding: 6px 10px; font-size: 11pt; color: #000;">
                ${day.fullDateTitle}
              </th>
            </tr>
            <tr>
              <th style="border: 1px solid #000; background-color: #fff; width: 55px;"></th>
              <th style="border: 1px solid #000; background-color: #9fc5e8 !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; text-align: center; font-weight: bold; padding: 6px 10px; width: 45%; color: #000;">
                Shif Pagi
              </th>
              <th style="border: 1px solid #000; background-color: #f9cb9c !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; text-align: center; font-weight: bold; padding: 6px 10px; width: 45%; color: #000;">
                Shif Siang
              </th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  };

  // Fungsi menghasilkan dokumen cetak lengkap
  const generateFullPrintHtml = (): string => {
    let bodyTables = '';
    if (viewMode === 'SINGLE_DAY' && currentDayData) {
      bodyTables = generateDayTableHtml(currentDayData);
    } else {
      bodyTables = activeEpoDays.map((d) => generateDayTableHtml(d)).join('\n');
    }

    const titleText = viewMode === 'SINGLE_DAY'
      ? `Jadwal-Pemberian-EPO-${currentDayData?.fullDateTitle.replace(/[^a-zA-Z0-9]/g, '-')}`
      : `Jadwal-Pemberian-EPO-Semua-Hari-${selectedMonth}`;

    return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>${titleText}</title>
  <style>
    @page { 
      size: portrait; 
      margin: 12mm; 
    }
    * { 
      box-sizing: border-box; 
      -webkit-print-color-adjust: exact !important; 
      print-color-adjust: exact !important; 
    }
    body { 
      font-family: Calibri, Arial, Helvetica, sans-serif; 
      font-size: 11pt; 
      color: #000000; 
      margin: 0; 
      padding: 15px; 
      background: #ffffff; 
    }
    table { 
      border-collapse: collapse !important; 
      -webkit-print-color-adjust: exact !important; 
      print-color-adjust: exact !important; 
    }
    th, td { 
      -webkit-print-color-adjust: exact !important; 
      print-color-adjust: exact !important; 
    }
    @media print {
      body { 
        padding: 0; 
        background: transparent; 
      }
      .no-print { 
        display: none !important; 
      }
    }
  </style>
</head>
<body>
  ${bodyTables}
</body>
</html>`;
  };

  // Fungsi cetak langsung menggunakan metode hidden iframe dengan fallback window.print
  const handlePrint = () => {
    setIsPrinting(true);
    setPrintFeedback('Membuka dialog cetak...');

    const fullHtml = generateFullPrintHtml();

    try {
      // 1. Buat elemen iframe tersembunyi untuk mencetak dokumen mandiri berorientasi portrait dengan warna presisi
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '1000px';
      iframe.style.height = '1000px';
      iframe.style.border = 'none';
      iframe.style.zIndex = '-9999';
      document.body.appendChild(iframe);

      const frameDoc = iframe.contentWindow?.document || iframe.contentDocument;
      if (frameDoc) {
        frameDoc.open();
        frameDoc.write(fullHtml);
        frameDoc.close();

        setTimeout(() => {
          try {
            iframe.contentWindow?.focus();
            iframe.contentWindow?.print();
          } catch (iframeErr) {
            console.warn('Pencetakan iframe dicegah browser sandbox, fallback ke window.print:', iframeErr);
            window.focus();
            window.print();
          } finally {
            setTimeout(() => {
              try {
                document.body.removeChild(iframe);
              } catch (_) {}
              setIsPrinting(false);
              setPrintFeedback(null);
            }, 1000);
          }
        }, 300);
      } else {
        window.focus();
        window.print();
        setIsPrinting(false);
        setPrintFeedback(null);
      }
    } catch (err) {
      console.warn('Gagal memicu pencetakan:', err);
      try {
        window.focus();
        window.print();
      } catch (_) {
        handleDownloadHtml();
      }
      setIsPrinting(false);
      setPrintFeedback(null);
    }
  };

  // Fungsi salin teks tabel ke clipboard
  const handleCopyText = () => {
    if (!currentDayData) return;
    const maxRows = Math.max(currentDayData.pagiPatients.length, currentDayData.siangPatients.length, 1);
    let text = `JADWAL PEMBERIAN EPO\n`;
    text += `NO\t${currentDayData.fullDateTitle}\n`;
    text += `\tShif Pagi\tShif Siang\n`;

    for (let i = 0; i < maxRows; i++) {
      const pPagi = currentDayData.pagiPatients[i]?.name || '';
      const pSiang = currentDayData.siangPatients[i]?.name || '';
      text += `${i + 1}\t${pPagi}\t${pSiang}\n`;
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Fungsi unduh dokumen cetak HTML mandiri
  const handleDownloadHtml = () => {
    const htmlDoc = generateFullPrintHtml();
    const titleText = viewMode === 'SINGLE_DAY'
      ? `Jadwal-Pemberian-EPO-${currentDayData?.fullDateTitle.replace(/[^a-zA-Z0-9]/g, '-')}`
      : `Jadwal-Pemberian-EPO-Semua-Hari-${selectedMonth}`;

    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${titleText}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Helper untuk merender tabel minimalis persis seperti di gambar
  const renderMinimalistTable = (day: DayScheduleData) => {
    // Tampilkan minimal 4 baris seperti pada gambar contoh (atau lebih jika pasien lebih dari 4)
    const maxRows = Math.max(day.pagiPatients.length, day.siangPatients.length, 4);

    return (
      <div key={day.dateNumber} className="w-full max-w-[580px] mx-auto my-3 print:my-4 print:break-inside-avoid bg-white">
        <table 
          className="w-full border-collapse text-slate-900 bg-white font-sans text-xs sm:text-sm"
          style={{ border: '1.5px solid #000000' }}
        >
          {/* Baris 1: Judul Tengah "JADWAL PEMBERIAN EPO" */}
          <thead>
            <tr>
              <th className="border-0 pb-1.5 w-12 sm:w-14"></th>
              <th 
                colSpan={2} 
                className="border-0 pb-1.5 text-center font-bold text-sm sm:text-base tracking-wide text-slate-900 uppercase"
              >
                JADWAL PEMBERIAN EPO
              </th>
            </tr>

            {/* Baris 2: NO | Hari, Tanggal Bulan Tahun */}
            <tr>
              <th 
                style={{ border: '1px solid #000000', backgroundColor: '#ffffff', color: '#000000' }}
                className="text-center font-bold py-1.5 px-2 w-12 sm:w-14"
              >
                NO
              </th>
              <th 
                colSpan={2} 
                style={{ border: '1px solid #000000', backgroundColor: '#ffffff', color: '#000000' }}
                className="text-center font-bold py-1.5 px-3 text-xs sm:text-sm"
              >
                {day.fullDateTitle}
              </th>
            </tr>

            {/* Baris 3: Header Shift: Shif Pagi (Biru #9fc5e8) | Shif Siang (Peach #f9cb9c) */}
            <tr>
              <th style={{ border: '1px solid #000000', backgroundColor: '#ffffff' }} className="w-12 sm:w-14"></th>
              <th 
                style={{ 
                  border: '1px solid #000000', 
                  backgroundColor: '#9fc5e8', 
                  WebkitPrintColorAdjust: 'exact', 
                  printColorAdjust: 'exact',
                  color: '#000000' 
                }}
                className="font-bold text-center py-1.5 px-3 w-[45%] text-xs sm:text-sm"
              >
                Shif Pagi
              </th>
              <th 
                style={{ 
                  border: '1px solid #000000', 
                  backgroundColor: '#f9cb9c', 
                  WebkitPrintColorAdjust: 'exact', 
                  printColorAdjust: 'exact',
                  color: '#000000' 
                }}
                className="font-bold text-center py-1.5 px-3 w-[45%] text-xs sm:text-sm"
              >
                Shif Siang
              </th>
            </tr>
          </thead>

          {/* Baris Data Pasien */}
          <tbody>
            {Array.from({ length: maxRows }).map((_, index) => {
              const pagiPatient = day.pagiPatients[index];
              const siangPatient = day.siangPatients[index];

              return (
                <tr key={index} className="leading-snug">
                  {/* Kolom Nomor */}
                  <td 
                    style={{ border: '1px solid #000000', backgroundColor: '#ffffff', color: '#000000' }}
                    className="text-center font-bold py-1.5 px-2"
                  >
                    {index + 1}
                  </td>

                  {/* Kolom Shif Pagi (Warna Biru Pastel #a4c2f4) */}
                  <td 
                    style={{ 
                      border: '1px solid #000000', 
                      backgroundColor: '#a4c2f4', 
                      WebkitPrintColorAdjust: 'exact', 
                      printColorAdjust: 'exact',
                      color: '#000000' 
                    }}
                    className="px-3 py-1.5 font-medium"
                  >
                    {pagiPatient ? (
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-semibold text-slate-950">
                          {pagiPatient.name}
                          {showNoRm && (
                            <span className="text-[10px] font-normal text-slate-800 ml-1">
                              ({pagiPatient.noRm})
                            </span>
                          )}
                        </span>
                        {showStatus && (
                          <span className="text-[9.5px] font-bold text-sky-950">
                            {pagiPatient.status}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-transparent select-none">&nbsp;</span>
                    )}
                  </td>

                  {/* Kolom Shif Siang (Warna Peach/Orange Pastel #f9cb9c) */}
                  <td 
                    style={{ 
                      border: '1px solid #000000', 
                      backgroundColor: '#f9cb9c', 
                      WebkitPrintColorAdjust: 'exact', 
                      printColorAdjust: 'exact',
                      color: '#000000' 
                    }}
                    className="px-3 py-1.5 font-medium"
                  >
                    {siangPatient ? (
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-semibold text-slate-950">
                          {siangPatient.name}
                          {showNoRm && (
                            <span className="text-[10px] font-normal text-slate-800 ml-1">
                              ({siangPatient.noRm})
                            </span>
                          )}
                        </span>
                        {showStatus && (
                          <span className="text-[9.5px] font-bold text-amber-950">
                            {siangPatient.status}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-transparent select-none">&nbsp;</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="print-modal-container fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs print:p-0 print:bg-white print:static print:z-auto">
      <div className="print-modal-card bg-white dark:bg-slate-900 rounded-xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-1 flex flex-col max-h-[92vh] print:max-h-none print:h-auto print:overflow-visible print:border-none print:shadow-none print:m-0 print:w-full">
        
        {/* Header Kontrol (Sembunyi saat dicetak) */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 print:hidden shrink-0 space-y-2.5">
          
          {/* Top Bar: Title & Primary Action Buttons */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold shrink-0">
                <FileSpreadsheet className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                  Cetak Tabel Jadwal Pemberian EPO (Format Minimalis)
                </h3>
                <p className="text-[11px] text-slate-500">
                  Format tabel minimalis per shift (Pagi & Siang) sesuai formulir kerja harian HD
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrint}
                disabled={isPrinting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:bg-teal-800 disabled:opacity-60 shadow-xs transition cursor-pointer"
                title="Cetak langsung ke printer atau simpan sebagai PDF"
              >
                {isPrinting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Printer className="w-3.5 h-3.5" />
                )}
                <span>{isPrinting ? 'Mencetak...' : 'Cetak Tabel'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyText}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer"
                title="Salin isi tabel untuk ditempel ke Excel / Word"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Tersalin' : 'Salin'}</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadHtml}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer"
                title="Unduh file HTML mandiri"
              >
                <Download className="w-3.5 h-3.5" />
                <span>HTML</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sub Bar: Navigasi Tanggal & Pengaturan Mode */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-200/60 dark:border-slate-800/60 text-xs">
            
            {/* Mode: Per Tanggal (Persis Gambar) vs Semua Hari */}
            <div className="inline-flex p-0.5 rounded-lg bg-slate-200/80 dark:bg-slate-800 border border-slate-300 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('SINGLE_DAY')}
                className={`px-3 py-1 rounded-md font-bold text-xs transition cursor-pointer ${
                  viewMode === 'SINGLE_DAY'
                    ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Per Tanggal (Persis Gambar)
              </button>

              <button
                type="button"
                onClick={() => setViewMode('ALL_DAYS')}
                className={`px-3 py-1 rounded-md font-bold text-xs transition cursor-pointer ${
                  viewMode === 'ALL_DAYS'
                    ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Semua Hari ({activeEpoDays.length} Hari)
              </button>
            </div>

            {/* Pilihan Tanggal Aktif (Mode SINGLE_DAY) */}
            {viewMode === 'SINGLE_DAY' && (
              <div className="flex items-center gap-1 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700 shadow-2xs">
                <button
                  type="button"
                  onClick={handlePrevDay}
                  title="Hari Sebelumnya"
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 transition cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <div className="flex items-center gap-1.5 px-1.5 font-bold text-xs text-slate-800 dark:text-slate-200">
                  <Calendar className="w-3.5 h-3.5 text-teal-600" />
                  <select
                    value={selectedDateNumber}
                    onChange={(e) => setSelectedDateNumber(parseInt(e.target.value, 10))}
                    className="bg-transparent font-bold text-xs text-slate-800 dark:text-slate-200 outline-none cursor-pointer"
                  >
                    {daysData.map((d) => (
                      <option key={d.dateNumber} value={d.dateNumber} className="dark:bg-slate-900">
                        {d.fullDateTitle} {d.totalEpo > 0 ? `(${d.totalEpo} Pasien)` : '(Kosong)'}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleNextDay}
                  title="Hari Selanjutnya"
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-600 dark:text-slate-300 transition cursor-pointer"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Checkbox Opsi Tampilan */}
            <div className="flex items-center gap-3">
              <label className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showNoRm}
                  onChange={(e) => setShowNoRm(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <span>Sertakan No. RM</span>
              </label>

              <label className="inline-flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showStatus}
                  onChange={(e) => setShowStatus(e.target.checked)}
                  className="rounded text-teal-600 focus:ring-teal-500 cursor-pointer"
                />
                <span>Sertakan Status</span>
              </label>
            </div>

          </div>

        </div>

        {/* Area Dokumen Cetak Minimalis */}
        <div className="print-modal-scrollable p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-950 text-slate-900 print:bg-white print:p-0 print:overflow-visible">
          <div ref={reportAreaRef} className="max-w-xl mx-auto space-y-4">
            
            {printFeedback && (
              <div className="bg-teal-50 dark:bg-teal-950/50 border border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200 text-xs px-3 py-2 rounded-lg flex items-center justify-between shadow-2xs print:hidden">
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
                  <span className="font-semibold">{printFeedback}</span>
                </span>
                <span className="text-[10px] text-teal-700 dark:text-teal-400">
                  Atau klik <strong>HTML</strong> / <strong>Salin</strong> jika browser membatasi jendela dialog cetak.
                </span>
              </div>
            )}

            {viewMode === 'SINGLE_DAY' ? (
              currentDayData ? (
                <div>
                  {renderMinimalistTable(currentDayData)}
                </div>
              ) : (
                <div className="text-center p-8 text-slate-500">
                  Tidak ada jadwal untuk tanggal yang dipilih.
                </div>
              )
            ) : (
              activeEpoDays.length === 0 ? (
                <div className="text-center p-8 text-slate-500">
                  Tidak ada jadwal pemberian EPO di bulan {formattedMonth}.
                </div>
              ) : (
                <div className="space-y-6">
                  {activeEpoDays.map((day) => renderMinimalistTable(day))}
                </div>
              )
            )}

          </div>
        </div>

      </div>
    </div>
  );
};
