import * as XLSX from 'xlsx';
import { PatientRecord, HDDaySchedule } from '../types/dialysis';
import { buildScheduleMatrixTable, buildYearlySummaryTable, buildNextMonthLabScheduleTable, buildNextMonthCalendarMatrix, getMonthDaysInfo, SCHEDULE_SHEETS } from './googleSheets';

export interface ExcelExportOptions {
  period: string; // e.g. "2026-09"
  targetSchedule?: HDDaySchedule | 'ALL';
  includeSummaryTab?: boolean;
}

/**
 * Menghitung lebar kolom otomatis berdasarkan panjang teks maksimum pada setiap kolom
 */
function calculateColumnWidths(data: string[][]): { wch: number }[] {
  if (data.length === 0) return [];
  const colCount = Math.max(...data.map(row => row.length));
  const widths: number[] = new Array(colCount).fill(10);

  data.forEach(row => {
    row.forEach((cell, colIdx) => {
      const val = cell !== undefined && cell !== null ? String(cell) : '';
      const len = val.length;
      if (len > widths[colIdx]) {
        widths[colIdx] = len;
      }
    });
  });

  return widths.map((w, idx) => {
    // Beri batas minimum dan maksimum yang proporsional
    if (idx === 0) return { wch: 6 }; // No
    if (idx === 1) return { wch: Math.min(Math.max(w + 2, 22), 35) }; // Nama Pasien
    if (idx === 2) return { wch: Math.min(Math.max(w + 2, 12), 16) }; // No. RM
    if (idx === 3) return { wch: Math.min(Math.max(w + 2, 14), 20) }; // Frekuensi HD
    if (idx === 4) return { wch: Math.min(Math.max(w + 2, 12), 16) }; // Shift
    if (idx === 5) return { wch: 8 }; // Hb
    if (idx === 6) return { wch: Math.min(Math.max(w + 2, 24), 32) }; // Alokasi Klinis
    // Kolom tanggal harian
    if (idx >= 7 && idx < colCount - 6) return { wch: 5 };
    // Kolom ringkasan kanan
    return { wch: Math.min(Math.max(w + 2, 10), 22) };
  });
}

/**
 * Membangun Sheet Ringkasan Konsolidasi Seluruh Pasien
 */
function buildConsolidatedSummaryTable(patients: PatientRecord[], period: string): string[][] {
  const [yearStr, monthStr] = period.split('-');
  const dateObj = new Date(parseInt(yearStr, 10) || 2026, (parseInt(monthStr, 10) || 9) - 1, 1);
  const monthName = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  const headers = [
    'No',
    'Nama Pasien',
    'No. Rekam Medis',
    'Jadwal Rutin HD',
    'Frekuensi HD',
    'Shift HD',
    'Nilai Hb (g/dL)',
    'Kategori Klinis & Alokasi',
    'Target EPO (Ampul)',
    'Realisasi EPO Diberikan',
    'Kebutuhan Transfusi PRC (Kantong)',
    'Status Keseluruhan',
    'Status Cek Lab Hb',
    'Kategori Cek Hb Pilihan (≤ 8.9)',
    'Catatan Klinis Pasien',
  ];

  const rows: string[][] = [
    [`REKAPITULASI ALOKASI ERITROPOIETIN & TRANSFUSI HD - PERIODE ${monthName.toUpperCase()}`],
    [`RS HAPPY LAND MEDICAL CENTRE YOGYAKARTA`],
    [`Tanggal Unduh: ${new Date().toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })} | Total Pasien: ${patients.length}`],
    [], // Baris kosong
    headers,
  ];

  let totalTargetEpo = 0;
  let totalRealisasiEpo = 0;
  let totalPrc = 0;
  let totalSelectiveHb = 0;

  const getScheduleSortRank = (p: PatientRecord): number => {
    const day = (p.scheduleDay || '').toLowerCase();
    const shift = (p.scheduleShift || '').toLowerCase();
    const isPagi = shift.includes('pagi') || shift.includes('1');

    if (day.includes('senin') || day.includes('kamis')) {
      return isPagi ? 1 : 2;
    }
    if (day.includes('selasa') || day.includes('jumat')) {
      return isPagi ? 3 : 4;
    }
    if (day.includes('rabu') || day.includes('sabtu')) {
      return isPagi ? 5 : 6;
    }
    return isPagi ? 7 : 8;
  };

  const sortedPatients = [...patients].sort((a, b) => {
    const rankA = getScheduleSortRank(a);
    const rankB = getScheduleSortRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return a.name.localeCompare(b.name, 'id');
  });

  sortedPatients.forEach((patient, idx) => {
    const reco = patient.recommendation;
    const targetEpo = reco.totalEpoVials || 0;
    
    // Hitung realisasi dari dailyRecords atau weeks
    let realisasiEpo = 0;
    if (patient.dailyRecords) {
      Object.values(patient.dailyRecords).forEach(r => {
        if (r.status === 'Diberikan') realisasiEpo++;
      });
    } else if (patient.weeks) {
      Object.values(patient.weeks).forEach(w => {
        if (w.status === 'Diberikan') realisasiEpo++;
      });
    }

    const prcBags = reco.transfusionBags || 0;
    const prevRounded = typeof patient.prevHbValue === 'number' && patient.prevHbValue > 0 
      ? Number(patient.prevHbValue.toFixed(1)) 
      : undefined;
    const curRounded = patient.hbValue > 0 ? Number(patient.hbValue.toFixed(1)) : undefined;
    const isSelective = (prevRounded !== undefined && prevRounded <= 8.9) || 
      (prevRounded === undefined && curRounded !== undefined && curRounded <= 8.9) || 
      Boolean(patient.isSelectiveHb);

    totalTargetEpo += targetEpo;
    totalRealisasiEpo += realisasiEpo;
    totalPrc += prcBags;
    if (isSelective) totalSelectiveHb++;

    rows.push([
      String(idx + 1),
      patient.name,
      patient.noRm,
      patient.scheduleDay,
      patient.hdFrequency === '1 kali dalam satu minggu' 
        ? `1x/minggu (${patient.singleDay || 'Rutin'})` 
        : '2x/minggu',
      patient.scheduleShift,
      patient.hbValue > 0 ? patient.hbValue.toFixed(1) : 'Belum diinput (Hb: 0)',
      reco.title,
      String(targetEpo),
      String(realisasiEpo),
      prcBags > 0 ? `${prcBags} Kantong` : '-',
      patient.overallStatus,
      patient.labSchedule?.status || (patient.hbValue > 0 ? 'Selesai' : 'Belum Diambil'),
      isSelective ? `⭐ Ya (< 9.0 g/dL${patient.prevHbValue ? ` [${patient.prevHbValue}]` : ''})` : 'Tidak',
      patient.clinicalNotes || '',
    ]);
  });

  // Baris Total Akumulasi
  rows.push([]);
  rows.push([
    '',
    'TOTAL KESELURUHAN',
    '',
    '',
    '',
    '',
    '',
    '',
    String(totalTargetEpo),
    String(totalRealisasiEpo),
    `${totalPrc} Kantong`,
    `${patients.length} Pasien`,
    '',
    `${totalSelectiveHb} Pasien Pilihan`,
    `Capaian: ${totalTargetEpo > 0 ? Math.round((totalRealisasiEpo / totalTargetEpo) * 100) : 0}%`,
  ]);

  return rows;
}

/**
 * Ekspor data ke file Excel (.xlsx) murni di browser tanpa login!
 */
export function exportDialysisToExcel(
  patients: PatientRecord[],
  options: ExcelExportOptions
): { fileName: string; sheetCount: number } {
  const { period, targetSchedule = 'ALL', includeSummaryTab = true } = options;
  const [yearStr, monthStr] = period.split('-');
  const dateObj = new Date(parseInt(yearStr, 10) || 2026, (parseInt(monthStr, 10) || 9) - 1, 1);
  const monthName = dateObj.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

  // Buat workbook baru
  const wb = XLSX.utils.book_new();
  let sheetCount = 0;

  // 1. Tentukan sheet jadwal yang akan diekspor
  const sheetsToExport = targetSchedule === 'ALL'
    ? SCHEDULE_SHEETS
    : SCHEDULE_SHEETS.filter(s => s.title === targetSchedule);

  sheetsToExport.forEach(({ title, tabName }) => {
    const matrixRows = buildScheduleMatrixTable(patients, title, period);
    const ws = XLSX.utils.aoa_to_sheet(matrixRows);

    // Tetapkan lebar kolom
    ws['!cols'] = calculateColumnWidths(matrixRows);

    // Kunci / Freeze baris header & kolom identitas pasien
    ws['!freeze'] = {
      xSplit: 5,
      ySplit: 1,
      topLeftCell: 'F2',
      activePane: 'bottomRight',
      state: 'frozen',
    };

    XLSX.utils.book_append_sheet(wb, ws, tabName);
    sheetCount++;
  });

  // 2. Tambahkan Sheet Ringkasan Konsolidasi jika dipilih atau target 'ALL'
  if (includeSummaryTab) {
    const filteredPatients = targetSchedule === 'ALL'
      ? patients
      : patients.filter(p => p.scheduleDay === targetSchedule);

    const summaryRows = buildConsolidatedSummaryTable(filteredPatients, period);
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);

    // Atur lebar kolom untuk sheet ringkasan
    wsSummary['!cols'] = [
      { wch: 6 },  // No
      { wch: 25 }, // Nama Pasien
      { wch: 15 }, // No RM
      { wch: 16 }, // Jadwal Rutin HD
      { wch: 16 }, // Frekuensi HD
      { wch: 14 }, // Shift
      { wch: 15 }, // Hb
      { wch: 30 }, // Kategori Klinis
      { wch: 14 }, // Target EPO
      { wch: 14 }, // Realisasi
      { wch: 18 }, // Transfusi PRC
      { wch: 16 }, // Status
      { wch: 16 }, // Status Lab
      { wch: 20 }, // Cek Hb Pilihan
      { wch: 30 }, // Catatan
    ];

    XLSX.utils.book_append_sheet(wb, wsSummary, 'Rekapitulasi Pasien');
    sheetCount++;
  }

  // 3. Tambahkan Tab REKAP_HB_TAHUNAN (Integrasi 1 Tahun & Acuan Hb Sebelumnya)
  if (targetSchedule === 'ALL') {
    const yearlyRows = buildYearlySummaryTable(patients, period);
    const wsYearly = XLSX.utils.aoa_to_sheet(yearlyRows);
    wsYearly['!cols'] = [
      { wch: 6 },  // No
      { wch: 25 }, // Nama Pasien
      { wch: 14 }, // No RM
      { wch: 16 }, // Jadwal Rutin HD
      { wch: 12 }, // Shift
      { wch: 15 }, // Frekuensi HD
      { wch: 15 }, // Hb Acuan Bln Lalu
      { wch: 15 }, // Hb Bln Ini
      { wch: 25 }, // Rencana Cek Hb
      { wch: 22 }, // Alokasi Terapi
      ...new Array(12).fill({ wch: 8 }), // 12 Bulan (Jan-Des)
      { wch: 20 }, // DPJP
      { wch: 30 }, // Catatan
    ];
    wsYearly['!freeze'] = {
      xSplit: 3,
      ySplit: 1,
      topLeftCell: 'D2',
      activePane: 'bottomRight',
      state: 'frozen',
    };
    XLSX.utils.book_append_sheet(wb, wsYearly, 'REKAP_HB_TAHUNAN');
    sheetCount++;

    // 4. Tambahkan Tab JADWAL_CEK_HB (Penjadwalan Cek Hb Bulan Selanjutnya)
    const labRows = buildNextMonthLabScheduleTable(patients, period);
    const wsLab = XLSX.utils.aoa_to_sheet(labRows);
    wsLab['!cols'] = [
      { wch: 6 },  // No
      { wch: 16 }, // Tanggal Terjadwal
      { wch: 12 }, // Hari
      { wch: 15 }, // Shift HD
      { wch: 16 }, // Jadwal Rutin
      { wch: 14 }, // No RM
      { wch: 28 }, // Nama Pasien
      { wch: 14 }, // Frekuensi HD
      { wch: 14 }, // Hb Terakhir
      { wch: 26 }, // Kategori Pemeriksaan
      { wch: 26 }, // Rekomendasi Terapi
      { wch: 14 }, // Status Sampling
      { wch: 16 }, // Hasil Lab Hb Baru
      { wch: 26 }, // Paraf / Catatan
    ];
    wsLab['!freeze'] = {
      xSplit: 4,
      ySplit: 1,
      topLeftCell: 'E2',
      activePane: 'bottomRight',
      state: 'frozen',
    };
    XLSX.utils.book_append_sheet(wb, wsLab, 'JADWAL_CEK_HB');
    sheetCount++;

    // 5. Tambahkan Tab MATRIKS_CEK_HB (Matriks 6 Hari Sesi Pertama HD)
    const matRows = buildNextMonthCalendarMatrix(patients, period);
    const wsMat = XLSX.utils.aoa_to_sheet(matRows);
    wsMat['!cols'] = new Array(matRows[0]?.length || 6).fill({ wch: 30 });
    wsMat['!freeze'] = {
      xSplit: 0,
      ySplit: 1,
      topLeftCell: 'A2',
      activePane: 'bottomLeft',
      state: 'frozen',
    };
    XLSX.utils.book_append_sheet(wb, wsMat, 'MATRIKS_CEK_HB');
    sheetCount++;
  }

  // Nama file yang rapi dan informatif
  const scheduleSuffix = targetSchedule === 'ALL' 
    ? 'Semua_Jadwal' 
    : targetSchedule.replace(/\s+/g, '_');
  const fileName = `EPOCARE_Jadwal_HD_${scheduleSuffix}_${monthName.replace(/\s+/g, '_')}_${period}.xlsx`;

  // Tulis & Download file langsung ke browser tanpa perlu login apa pun!
  XLSX.writeFile(wb, fileName, { bookType: 'xlsx', type: 'binary' });

  return { fileName, sheetCount };
}

export const exportToExcel = exportDialysisToExcel;
