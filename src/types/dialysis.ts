export type ActionCategory = 
  | 'TRANSFUSI_2_RAWAT_INAP' 
  | 'TRANSFUSI_1_KANTONG' 
  | 'EPO_4X_2000' 
  | 'EPO_1X_2000' 
  | 'HOLD_EVALUASI'
  | 'MENUNGGU_HASIL_LAB';

export interface ClinicalRecommendation {
  category: ActionCategory;
  title: string;
  badgeColor: string;
  badgeBg: string;
  borderColor: string;
  doseDescription: string;
  totalEpoIu: number;
  totalEpoVials: number;
  transfusionBags: number;
  isInpatientNeeded: boolean;
  notes: string;
  protocolBadge: string;
}

export type HDDaySchedule = 'Senin - Kamis' | 'Selasa - Jumat' | 'Rabu - Sabtu';
export type HDShift = 'Shift 1 (Pagi)' | 'Shift 2 (Siang)';
export type HDFrequency = '2 kali dalam satu minggu' | '1 kali dalam satu minggu' | '1 kali / 2 minggu';
export type SingleHDDay = 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu';

export type DoseStatus = 'Belum' | 'Diberikan' | 'Tunda' | 'Batal' | 'Tidak Ada Jadwal';

export interface WeekScheduleItem {
  weekNumber: 1 | 2 | 3 | 4;
  plannedDate?: string;
  status: DoseStatus;
  doseIU: number;
  administeredAt?: string;
  administeredBy?: string; // Paraf / Nama perawat
  notes?: string;
}

export interface DailyActionRecord {
  status: DoseStatus; // 'Belum' | 'Diberikan' | 'Tunda' | 'Batal'
  postponedToDate?: number; // e.g. 7 ditunda ke 10
  postponedFromDate?: number; // e.g. 10 menerima penundaan dari 7
  administeredAt?: string;
  administeredBy?: string;
  notes?: string;
}

export type LabTestType = 
  | 'Cek Hb Pilihan (Hb ≤ 8.9)'
  | 'Cek Hb Pilihan (Hb ≤ 9.0)'
  | 'Cek Hb Pilihan (Hb < 9.0)'
  | 'Rutin Hb (Evaluasi EPO)'
  | 'Darah Lengkap & Hb'
  | 'Ureum & Kreatinin'
  | 'Profil Besi (Ferritin / TIBC)'
  | 'Elektrolit Lengkap'
  | 'Lengkap Rutin Bulanan'
  | 'Lainnya';

export type LabScheduleStatus = 'Terjadwal' | 'Selesai' | 'Ditunda';

export interface LabSchedule {
  scheduledDate: string; // YYYY-MM-DD
  testType: LabTestType;
  status: LabScheduleStatus;
  notes?: string;
  resultHb?: number;
  completedAt?: string;
  isSelectiveHb?: boolean; // Menandakan pemeriksaan merupakan Cek Hb Pilihan
  selectiveReason?: string; // Alasan: e.g. "Nilai Hb bulan sebelumnya ≤ 8.9 mg/dL"
}

export interface PatientRecord {
  id: string; // RM or generated UUID
  noRm: string;
  name: string;
  age?: number;
  gender?: 'L' | 'P';
  hdFrequency?: HDFrequency; // '2 kali dalam satu minggu' | '1 kali dalam satu minggu' | '1 kali / 2 minggu'
  singleDay?: SingleHDDay; // 'Senin' | 'Selasa' | 'Rabu' | 'Kamis' | 'Jumat' | 'Sabtu'
  lastHdDate?: string; // Tanggal sesi HD terakhir (YYYY-MM-DD), khusus acuan frekuensi '1 kali / 2 minggu'
  scheduleDay: HDDaySchedule;
  scheduleShift: HDShift;
  hbValue: number; // in g/dL, e.g. 7.8 (bulan berjalan)
  hbDate: string; // YYYY-MM-DD
  prevHbValue?: number; // in g/dL: Nilai Hb bulan sebelumnya untuk kriteria Cek Hb Pilihan (≤ 8.9)
  isSelectiveHb?: boolean; // Penanda manual/otomatis Cek Hb Pilihan
  labSchedule?: LabSchedule; // Jadwal pemeriksaan laboratorium manual
  monthPeriod: string; // e.g. '2026-09'
  recommendation: ClinicalRecommendation;
  weeks: {
    week1: WeekScheduleItem;
    week2: WeekScheduleItem;
    week3: WeekScheduleItem;
    week4: WeekScheduleItem;
  };
  dailyRecords?: Record<number, DailyActionRecord>;
  overallStatus: 'Menunggu' | 'Berjalan' | 'Selesai' | 'Perlu Perhatian';
  clinicalNotes?: string;
  doctorInCharge?: string; // DPJP
  updatedAt: string;
}

/**
 * Memeriksa apakah pasien memenuhi kriteria Cek Hb Pilihan:
 * Kriteria Klinis: Nilai Hb KURANG DARI ATAU SAMA DENGAN 8.9 mg/dL (Hb ≤ 8.9 mg/dL).
 * Nilai Hb 9.0 mg/dL ke atas TIDAK MASUK Cek Hb Pilihan (merupakan pemeriksaan Rutin Hb).
 */
export function isSelectiveHbCandidate(patient: PatientRecord): boolean {
  // Evaluasi acuan nilai Hb: utamakan riwayat Hb bulan sebelumnya, atau nilai Hb saat ini jika ada
  const refHb = (typeof patient.prevHbValue === 'number' && patient.prevHbValue > 0)
    ? Number(patient.prevHbValue.toFixed(1))
    : (patient.hbValue > 0 ? Number(patient.hbValue.toFixed(1)) : undefined);

  if (refHb !== undefined) {
    // Hanya Hb <= 8.9 mg/dl yang masuk Cek Hb Pilihan.
    // Jika Hb >= 9.0 mg/dl, mutlak BUKAN Cek Hb Pilihan (Rutin).
    return refHb <= 8.9;
  }

  // Jika belum ada nilai Hb sama sekali, periksa penanda manual
  if (patient.isSelectiveHb || patient.labSchedule?.isSelectiveHb) {
    return true;
  }

  return false;
}

export interface SpreadsheetConfig {
  spreadsheetId: string;
  spreadsheetName?: string;
  spreadsheetUrl?: string;
  sheetName: string;
  lastSyncedAt?: string;
  appsScriptUrl?: string;
  syncMode?: 'oauth' | 'appsscript' | 'csv';
}

export interface SheetRowData {
  noRm: string;
  name: string;
  schedule: string;
  hbDate: string;
  hbValue: string;
  rekomendasi: string;
  week1: string;
  week2: string;
  week3: string;
  week4: string;
  status: string;
  catatan: string;
  terakhirUpdate: string;
}
