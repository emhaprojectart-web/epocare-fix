import { PatientRecord, HDDaySchedule, HDShift, HDFrequency, SingleHDDay, DoseStatus, DailyActionRecord, isSelectiveHbCandidate } from '../types/dialysis';
import { calculateClinicalRecommendation, generateDefaultWeeks } from './clinicalRules';

export const DEFAULT_APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxn0Iym9cWYr6fENri-ZMJx_oo5vS5LvN6UD5pU_mOiOrhjS8wXDn2hy6_51mjA4Ic7kg/exec';

export const OFFICIAL_SPREADSHEET_ID = '1O7mUzJoS19u4v4BYD5wI4xe2mjfBYn3wzNLmi11KlY8';
export const OFFICIAL_SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1O7mUzJoS19u4v4BYD5wI4xe2mjfBYn3wzNLmi11KlY8/edit';

export const SCHEDULE_SHEETS: { title: HDDaySchedule; tabName: string }[] = [
  { title: 'Senin - Kamis', tabName: 'Senin-Kamis' },
  { title: 'Selasa - Jumat', tabName: 'Selasa-Jumat' },
  { title: 'Rabu - Sabtu', tabName: 'Rabu-Sabtu' },
];

/**
 * Mendapatkan indeks hari (1=Senin s/d 6=Sabtu) dari pilihan hari tunggal
 */
export function getDayOfWeekFromSingleDay(day: SingleHDDay): number {
  switch (day) {
    case 'Senin': return 1;
    case 'Selasa': return 2;
    case 'Rabu': return 3;
    case 'Kamis': return 4;
    case 'Jumat': return 5;
    case 'Sabtu': return 6;
    default: return 1;
  }
}

/**
 * Menentukan grup sheet HD ('Senin - Kamis', 'Selasa - Jumat', 'Rabu - Sabtu')
 * berdasarkan pilihan hari tunggal
 */
export function getScheduleDayFromSingleDay(day: SingleHDDay): HDDaySchedule {
  if (day === 'Senin' || day === 'Kamis') return 'Senin - Kamis';
  if (day === 'Selasa' || day === 'Jumat') return 'Selasa - Jumat';
  return 'Rabu - Sabtu';
}

/**
 * Mendapatkan SingleHDDay ('Senin' s/d 'Sabtu') dari string tanggal (YYYY-MM-DD)
 */
export function getSingleDayFromDate(dateStr: string): SingleHDDay {
  if (!dateStr) return 'Senin';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return 'Senin';
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  if (!y || !m || !d) return 'Senin';
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  switch (day) {
    case 1: return 'Senin';
    case 2: return 'Selasa';
    case 3: return 'Rabu';
    case 4: return 'Kamis';
    case 5: return 'Jumat';
    case 6: return 'Sabtu';
    default: return 'Senin';
  }
}

/**
 * Menentukan jadwal HD aktif ('Senin - Kamis', 'Selasa - Jumat', 'Rabu - Sabtu')
 * berdasarkan hari kalender real-time saat ini.
 */
export function getActiveHDDaySchedule(date = new Date()): HDDaySchedule {
  const day = date.getDay(); // 0 = Minggu, 1 = Senin, 2 = Selasa, 3 = Rabu, 4 = Kamis, 5 = Jumat, 6 = Sabtu
  switch (day) {
    case 1: // Senin
    case 4: // Kamis
      return 'Senin - Kamis';
    case 2: // Selasa
    case 5: // Jumat
      return 'Selasa - Jumat';
    case 3: // Rabu
    case 6: // Sabtu
      return 'Rabu - Sabtu';
    case 0: // Minggu (Hari libur HD, default mengacu ke sesi terdekat Senin - Kamis)
    default:
      return 'Senin - Kamis';
  }
}

/**
 * Mendapatkan nama hari real-time bahasa Indonesia (Senin s/d Minggu)
 */
export function getTodayDayName(date = new Date()): string {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return days[date.getDay()];
}

/**
 * Mendapatkan jumlah hari dalam bulan tertentu dan daftar hari per tanggal
 */
export function getMonthDaysInfo(yearMonth: string) {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10) || new Date().getFullYear();
  const month = parseInt(monthStr, 10) || (new Date().getMonth() + 1);

  const daysInMonth = new Date(year, month, 0).getDate();
  const days: { dateNumber: number; dayOfWeek: number; dateString: string }[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    days.push({
      dateNumber: d,
      dayOfWeek: dateObj.getDay(), // 0 = Minggu, 1 = Senin, ... 6 = Sabtu
      dateString: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    });
  }

  return { year, month, daysInMonth, days };
}

/**
 * Mengecek apakah tanggal tertentu merupakan hari jadwal sesi HD pasien.
 * Mendukung:
 * - Pasien 2x/minggu (Senin-Kamis, Selasa-Jumat, Rabu-Sabtu)
 * - Pasien 1x/minggu (Senin s/d Sabtu)
 * - Pasien 1x / 2 minggu (2 minggu sekali berjarak 14 hari dari Jadwal HD Terakhir pasien)
 */
export function isDateInHDDay(
  dayOfWeek: number, 
  scheduleDay: HDDaySchedule,
  singleDay?: SingleHDDay,
  hdFrequency?: HDFrequency,
  dateString?: string,
  lastHdDate?: string
): boolean {
  if (hdFrequency === '1 kali / 2 minggu') {
    const effectiveSingleDay = singleDay || (lastHdDate ? getSingleDayFromDate(lastHdDate) : undefined);
    if (effectiveSingleDay) {
      if (dayOfWeek !== getDayOfWeekFromSingleDay(effectiveSingleDay)) {
        return false;
      }
    } else {
      const primaryDay = scheduleDay === 'Senin - Kamis' ? 1 : scheduleDay === 'Selasa - Jumat' ? 2 : 3;
      if (dayOfWeek !== primaryDay) return false;
    }

    // Jika ada tanggal acuan HD Terakhir (lastHdDate) dan dateString:
    if (lastHdDate && dateString) {
      const [lY, lM, lD] = lastHdDate.split('-').map(Number);
      const [cY, cM, cD] = dateString.split('-').map(Number);
      if (lY && lM && lD && cY && cM && cD) {
        const lastUtc = Date.UTC(lY, lM - 1, lD);
        const currUtc = Date.UTC(cY, cM - 1, cD);
        const diffDays = Math.round((currUtc - lastUtc) / (1000 * 60 * 60 * 24));
        return Math.abs(diffDays) % 14 === 0;
      }
    }

    // Fallback jika belum mengisi lastHdDate: dua sesi berjarak 14 hari
    if (dateString) {
      const dayNum = parseInt(dateString.split('-')[2], 10);
      return dayNum <= 7 || (dayNum >= 15 && dayNum <= 21);
    }
    return true;
  }

  if (hdFrequency === '1 kali dalam satu minggu' && singleDay) {
    return dayOfWeek === getDayOfWeekFromSingleDay(singleDay);
  }
  if (scheduleDay === 'Senin - Kamis') {
    return dayOfWeek === 1 || dayOfWeek === 4; // Senin (1), Kamis (4)
  }
  if (scheduleDay === 'Selasa - Jumat') {
    return dayOfWeek === 2 || dayOfWeek === 5; // Selasa (2), Jumat (5)
  }
  if (scheduleDay === 'Rabu - Sabtu') {
    return dayOfWeek === 3 || dayOfWeek === 6; // Rabu (3), Sabtu (6)
  }
  return false;
}

/**
 * Menemukan tanggal sesi HD pertama pasien di bulan berjalan (Awal Pertemuan saat jadwal HD dilaksanakan).
 * Digunakan sebagai acuan klinis utama tanggal pemeriksaan Hb lab awal bulan.
 */
export function getFirstHDDateOfMonth(
  yearMonth: string,
  scheduleDay: HDDaySchedule,
  singleDay?: SingleHDDay,
  hdFrequency?: HDFrequency,
  lastHdDate?: string
): { dateNumber: number; dateString: string } {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10) || new Date().getFullYear();
  const month = parseInt(monthStr, 10) || (new Date().getMonth() + 1);
  const daysInMonth = new Date(year, month, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const dayOfWeek = new Date(year, month - 1, d).getDay();
    const dateString = `${yearMonth}-${String(d).padStart(2, '0')}`;
    if (isDateInHDDay(dayOfWeek, scheduleDay, singleDay, hdFrequency, dateString, lastHdDate)) {
      return { dateNumber: d, dateString };
    }
  }

  return { dateNumber: 1, dateString: `${yearMonth}-01` };
}

/**
 * Mengecek apakah hari/tanggal ini merupakan Hari Awal dari pasangan jadwal HD pasien:
 * - Senin - Kamis => Hari Awal = Senin (dayOfWeek === 1)
 * - Selasa - Jumat => Hari Awal = Selasa (dayOfWeek === 2)
 * - Rabu - Sabtu => Hari Awal = Rabu (dayOfWeek === 3)
 * Untuk pasien 1x/minggu dan 1x/2 minggu, setiap sesinya merupakan Sesi Utama.
 */
export function isPrimaryHDDay(
  dayOfWeek: number, 
  scheduleDay: HDDaySchedule,
  singleDay?: SingleHDDay,
  hdFrequency?: HDFrequency
): boolean {
  if (hdFrequency === '1 kali dalam satu minggu' || hdFrequency === '1 kali / 2 minggu') {
    return true;
  }
  if (scheduleDay === 'Senin - Kamis') return dayOfWeek === 1;
  if (scheduleDay === 'Selasa - Jumat') return dayOfWeek === 2;
  if (scheduleDay === 'Rabu - Sabtu') return dayOfWeek === 3;
  return false;
}

/**
 * Apakah tanggal tertentu merupakan sesi pengecekan Hb awal bulan bagi pasien ini?
 * Acuan klinis: Cek HB tetap dilaksanakan diawal pertemuan pada saat jadwal HD dilaksanakan,
 * baik untuk pasien 2x/minggu, 1x/minggu, maupun 1x/2 minggu.
 */
export function isPatientHbCheckDay(
  dateNumber: number,
  days: { dateNumber: number; dayOfWeek: number; dateString: string }[],
  patient: PatientRecord
): boolean {
  const currentDay = days[dateNumber - 1];
  if (!currentDay || !isDateInHDDay(currentDay.dayOfWeek, patient.scheduleDay, patient.singleDay, patient.hdFrequency, currentDay.dateString, patient.lastHdDate)) {
    return false;
  }

  // Cari tanggal sesi HD pertama pasien di bulan berjalan (diawal pertemuan saat jadwal HD dilaksanakan)
  let firstHDDateNumber: number | null = null;
  for (let d = 1; d <= days.length; d++) {
    if (isDateInHDDay(days[d - 1].dayOfWeek, patient.scheduleDay, patient.singleDay, patient.hdFrequency, days[d - 1].dateString, patient.lastHdDate)) {
      firstHDDateNumber = d;
      break;
    }
  }

  // Prioritas 1: Jika pasien memiliki jadwal cek lab manual yang ditentukan pengguna
  if (patient.labSchedule?.scheduledDate) {
    const targetLabDay = days.find((d) => d.dateString === patient.labSchedule?.scheduledDate);
    if (targetLabDay) {
      return dateNumber === targetLabDay.dateNumber;
    }
  }

  // Prioritas 2: Jika pasien memiliki hbDate spesifik yang valid pada salah satu hari jadwal HD pasien di bulan ini
  if (patient.hbDate) {
    const targetDay = days.find((d) => d.dateString === patient.hbDate);
    if (targetDay && isDateInHDDay(targetDay.dayOfWeek, patient.scheduleDay, patient.singleDay, patient.hdFrequency, targetDay.dateString, patient.lastHdDate)) {
      return dateNumber === targetDay.dateNumber;
    }
  }

  // Default: Cek HB tetap dilaksanakan diawal pertemuan pada saat jadwal HD dilaksanakan
  return dateNumber === firstHDDateNumber;
}

/**
 * Menghitung sesi HD pasangan atau sesi HD berikutnya saat penundaan:
 * - Pasien 1x/2 minggu: Sesi berikutnya adalah 14 hari kemudian (+14 hari)
 * - Pasien 1x/minggu: Sesi berikutnya adalah 7 hari kemudian (+7 hari)
 * - Pasien 2x/minggu:
 *   Hari Awal (Senin/Selasa/Rabu) berpasangan dengan Hari Kedua (+3 hari, misal 7 Sept -> 10 Sept)
 *   Hari Kedua (Kamis/Jumat/Sabtu) merujuk ke Hari Awal (-3 hari)
 */
export function getPairedHDDate(
  dateNumber: number,
  dayOfWeek: number,
  scheduleDay: HDDaySchedule,
  daysInMonth: number,
  hdFrequency?: HDFrequency,
  singleDay?: SingleHDDay
): { isPrimary: boolean; pairedDate: number | null; nextHDDate?: number | null } {
  if (hdFrequency === '1 kali / 2 minggu') {
    const paired = dateNumber + 14;
    return {
      isPrimary: true,
      pairedDate: paired <= daysInMonth ? paired : null,
      nextHDDate: paired <= daysInMonth ? paired : null,
    };
  }

  if (hdFrequency === '1 kali dalam satu minggu') {
    // Untuk pasien 1x/minggu: penundaan sesi dialihkan ke sesi HD berikutnya pada hari rutin yang sama (+7 hari)
    const paired = dateNumber + 7;
    return { 
      isPrimary: true, 
      pairedDate: paired <= daysInMonth ? paired : null,
      nextHDDate: paired <= daysInMonth ? paired : null,
    };
  }

  const isPrimary = isPrimaryHDDay(dayOfWeek, scheduleDay);
  if (isPrimary) {
    const paired = dateNumber + 3;
    return { 
      isPrimary: true, 
      pairedDate: paired <= daysInMonth ? paired : null,
      nextHDDate: paired <= daysInMonth ? paired : null,
    };
  } else {
    // Hari Kedua (Kamis/Jumat/Sabtu):
    // Pasangan mingguan di masa lalu (Hari Awal): dateNumber - 3
    // Sesi HD berikutnya untuk penundaan: dateNumber + 4 (Senin/Selasa/Rabu minggu berikutnya)
    const paired = dateNumber - 3;
    const nextHD = dateNumber + 4;
    return { 
      isPrimary: false, 
      pairedDate: paired >= 1 ? paired : null,
      nextHDDate: nextHD <= daysInMonth ? nextHD : null,
    };
  }
}

/**
 * Menentukan alokasi tanggal spesifik pemberian Terapi EPO 1x 2000 IU (Maintenance):
 * Aturan Klinis:
 * 1. Kuota bulanan tepat 1x 2000 IU (1 vial/bulan).
 * 2. Jika dosis sudah berstatus 'Diberikan' (✅) pada suatu tanggal di bulan ini,
 *    seluruh tanggal HD lainnya menjadi sesi rutin biasa ('HD').
 * 3. Jika dosis ditunda ('Tunda' / ❌), tanggal tujuan pengalihan (postponedToDate) menjadi aktif (2000),
 *    sedangkan tanggal lainnya tetap 'HD'.
 * 4. Jika belum ada tindakan, default dijadwalkan pada Minggu 1 (M1):
 *    - Jadwal 2x/minggu:
 *      * Jika Hari Awal (Senin/Selasa/Rabu) adalah jadwal Cek Hb (isHbCheck), maka 1x 2000 IU
 *        dialokasikan di Hari Kedua (Kamis/Jumat/Sabtu) pada minggu yang sama setelah hasil lab Hb.
 *      * Jika Hari Awal BUKAN Cek Hb, dialokasikan di Hari Awal M1.
 *    - Jadwal 1x/minggu:
 *      * Dialokasikan pada sesi HD pertama di bulan tersebut.
 *    - Jadwal 1x/2 minggu:
 *      * Dialokasikan pada sesi HD pertama pasien di bulan tersebut.
 */
export function getScheduledDateForEpo1x(
  patient: PatientRecord,
  monthInfo: { daysInMonth: number; days: { dateNumber: number; dayOfWeek: number; dateString: string }[] }
): {
  scheduledDate: number | null;
  givenDate: number | null;
  postponedDate: number | null;
  postponedToDate: number | null;
} {
  const records = patient.dailyRecords || {};

  // 1. Cek apakah sudah pernah Diberikan (✅) di tanggal berapapun
  for (const [dateStr, rec] of Object.entries(records)) {
    if (rec.status === 'Diberikan') {
      const gDate = parseInt(dateStr, 10);
      return {
        scheduledDate: null,
        givenDate: gDate,
        postponedDate: null,
        postponedToDate: null,
      };
    }
  }

  // 2. Cek apakah ada penundaan aktif (Tunda / ❌)
  for (const [dateStr, rec] of Object.entries(records)) {
    if (rec.status === 'Tunda') {
      const pDate = parseInt(dateStr, 10);
      const dest = rec.postponedToDate;
      return {
        scheduledDate: (dest && dest <= monthInfo.daysInMonth) ? dest : null,
        givenDate: null,
        postponedDate: pDate,
        postponedToDate: dest || null,
      };
    }
  }

  // 3. Cek apakah ada tanggal yang menerima pengalihan penundaan (status Belum dengan postponedFromDate)
  for (const [dateStr, rec] of Object.entries(records)) {
    if (rec.status === 'Belum' && rec.postponedFromDate) {
      const sDate = parseInt(dateStr, 10);
      return {
        scheduledDate: sDate,
        givenDate: null,
        postponedDate: rec.postponedFromDate,
        postponedToDate: sDate,
      };
    }
  }

  // 4. Cek apakah ada tanggal yang di-set manual Belum di dailyRecords
  for (const [dateStr, rec] of Object.entries(records)) {
    if (rec.status === 'Belum') {
      const sDate = parseInt(dateStr, 10);
      return {
        scheduledDate: sDate,
        givenDate: null,
        postponedDate: null,
        postponedToDate: null,
      };
    }
  }

  // 5. Default Alokasi: Minggu 1 (atau minggu pertama yang aktif di patient.weeks)
  let targetWeek: 1 | 2 | 3 | 4 = 1;
  if (patient.weeks) {
    if (patient.weeks.week1?.status === 'Tidak Ada Jadwal' && patient.weeks.week2?.status !== 'Tidak Ada Jadwal') {
      targetWeek = 2;
    } else if (patient.weeks.week1?.status === 'Tidak Ada Jadwal' && patient.weeks.week2?.status === 'Tidak Ada Jadwal' && patient.weeks.week3?.status !== 'Tidak Ada Jadwal') {
      targetWeek = 3;
    } else if (patient.weeks.week1?.status === 'Tidak Ada Jadwal' && patient.weeks.week2?.status === 'Tidak Ada Jadwal' && patient.weeks.week3?.status === 'Tidak Ada Jadwal' && patient.weeks.week4?.status !== 'Tidak Ada Jadwal') {
      targetWeek = 4;
    }
  }

  // Kumpulkan seluruh tanggal sesi HD pasien di bulan ini
  const allHdDates: number[] = [];
  const targetWeekDates: number[] = [];

  for (let d = 1; d <= monthInfo.daysInMonth; d++) {
    const day = monthInfo.days[d - 1];
    if (day && isDateInHDDay(day.dayOfWeek, patient.scheduleDay, patient.singleDay, patient.hdFrequency, day.dateString, patient.lastHdDate)) {
      allHdDates.push(d);
      const w = getHDSessionWeek(d, monthInfo.daysInMonth, patient.scheduleDay, undefined, patient.singleDay, patient.hdFrequency);
      if (w === targetWeek) {
        targetWeekDates.push(d);
      }
    }
  }

  if (targetWeekDates.length === 0) {
    return {
      scheduledDate: allHdDates[0] || null,
      givenDate: null,
      postponedDate: null,
      postponedToDate: null,
    };
  }

  // Untuk pasien 1x/minggu atau 1x/2 minggu: alokasikan sesi HD pertama di target week
  if (patient.hdFrequency === '1 kali dalam satu minggu' || patient.hdFrequency === '1 kali / 2 minggu') {
    return {
      scheduledDate: targetWeekDates[0],
      givenDate: null,
      postponedDate: null,
      postponedToDate: null,
    };
  }

  // Untuk pasien 2x/minggu (Senin-Kamis, Selasa-Jumat, Rabu-Sabtu):
  // Jika tanggal sesi pertama di minggu ini merupakan jadwal Cek Hb (isHbCheck),
  // maka pemberian EPO 1x dialokasikan ke sesi Hari Kedua di minggu tersebut setelah evaluasi lab.
  const hariAwal = targetWeekDates[0];
  const hariKedua = targetWeekDates.length > 1 ? targetWeekDates[1] : null;

  const isAwalHbCheck = isPatientHbCheckDay(hariAwal, monthInfo.days, patient);
  const chosenDate = (isAwalHbCheck && hariKedua) ? hariKedua : hariAwal;

  return {
    scheduledDate: chosenDate,
    givenDate: null,
    postponedDate: null,
    postponedToDate: null,
  };
}

export interface DateDoseInfo {
  isHD: boolean;
  isHbCheck: boolean;
  isPrimary: boolean;
  pairedDate: number | null;
  cellCode: 'PRC 2' | 'PRC 1' | 'Cek' | '✅' | '❌' | '2000' | 'HD' | 'Hold' | 'Batal' | '-';
  title: string;
  isCatchUp: boolean;
  canTakeAction: boolean;
  currentStatus?: DoseStatus;
  postponedToDate?: number;
  postponedFromDate?: number;
  labCheckInfo?: {
    testType: string;
    status: string;
    notes?: string;
  };
}

export function getDateDoseDisplayInfo(
  patient: PatientRecord,
  dateNumber: number,
  monthInfo: { daysInMonth: number; days: { dateNumber: number; dayOfWeek: number; dateString: string }[] }
): DateDoseInfo {
  const dayInfo = monthInfo.days[dateNumber - 1];
  if (!dayInfo || !isDateInHDDay(dayInfo.dayOfWeek, patient.scheduleDay, patient.singleDay, patient.hdFrequency, dayInfo.dateString, patient.lastHdDate)) {
    return {
      isHD: false,
      isHbCheck: false,
      isPrimary: false,
      pairedDate: null,
      cellCode: '-',
      title: 'Bukan Hari Hemodialisa',
      isCatchUp: false,
      canTakeAction: false,
    };
  }

  const isOnceWeekly = patient.hdFrequency === '1 kali dalam satu minggu';
  const isBiweekly = patient.hdFrequency === '1 kali / 2 minggu';
  const isHbCheck = isPatientHbCheckDay(dateNumber, monthInfo.days, patient);
  const reco = patient.recommendation;
  const existingRecord = patient.dailyRecords?.[dateNumber];

  const { isPrimary, pairedDate } = getPairedHDDate(
    dateNumber,
    dayInfo.dayOfWeek,
    patient.scheduleDay,
    monthInfo.daysInMonth,
    patient.hdFrequency,
    patient.singleDay
  );

  // 1. Sesi Pengecekan HB Awal Bulan:
  // Cek HB dilaksanakan pada jadwal yang diinput/diatur di Jadwal Cek HB atau diawal pertemuan HD
  if (isHbCheck && (!existingRecord || existingRecord.status === 'Belum')) {
    if (reco.category === 'TRANSFUSI_2_RAWAT_INAP') {
      return {
        isHD: true,
        isHbCheck: true,
        isPrimary,
        pairedDate,
        cellCode: 'PRC 2',
        title: `PRC 2 = Transfusi Protokol 2 (${patient.hbValue <= 0 ? 'Hb: 0' : patient.hbValue.toFixed(1) + ' g/dL'} — Transfusi 2 Bag Rawat Inap)`,
        isCatchUp: false,
        canTakeAction: true,
      };
    }
    if (reco.category === 'TRANSFUSI_1_KANTONG') {
      return {
        isHD: true,
        isHbCheck: true,
        isPrimary,
        pairedDate,
        cellCode: 'PRC 1',
        title: `PRC 1 = Transfusi Protokol 1 (${patient.hbValue.toFixed(1)} g/dL — Transfusi 1 Bag PRC)`,
        isCatchUp: false,
        canTakeAction: true,
      };
    }

    const labStatus = patient.labSchedule?.status || (patient.hbValue > 0 ? 'Selesai' : 'Terjadwal');

    // Jika status pemeriksaan Hb masih Terjadwal: Tombol CEK (warna biru)
    if (labStatus !== 'Selesai') {
      return {
        isHD: true,
        isHbCheck: true,
        isPrimary,
        pairedDate,
        cellCode: 'Cek',
        title: `Cek = Jadwal Cek HB Lab Awal Bulan [Status: Terjadwal] — Nilai Hb: ${patient.hbValue <= 0 ? 'Belum Diinput' : patient.hbValue.toFixed(1) + ' g/dL'}`,
        isCatchUp: false,
        canTakeAction: true,
        labCheckInfo: patient.labSchedule ? {
          testType: patient.labSchedule.testType,
          status: patient.labSchedule.status,
          notes: patient.labSchedule.notes,
        } : undefined,
      };
    }

    // Jika status pemeriksaan Hb sudah Selesai:
    // Khusus pasien EPO 1x 2000 IU: jika hari ini BUKAN tanggal jadwal pemberian EPO 1x, tampilkan HD (✓Lab)
    if (reco.category === 'EPO_1X_2000') {
      const epo1xSchedule = getScheduledDateForEpo1x(patient, monthInfo);
      if (dateNumber !== epo1xSchedule.scheduledDate) {
        return {
          isHD: true,
          isHbCheck: true,
          isPrimary,
          pairedDate,
          cellCode: 'HD',
          title: `HD = Sesi Rutin (Pemeriksaan Cek HB Selesai — Nilai: ${patient.hbValue.toFixed(1)} g/dL • EPO 1x 2000 IU terjadwal pada tgl ${epo1xSchedule.scheduledDate || 'M1'})`,
          isCatchUp: false,
          canTakeAction: true,
          labCheckInfo: patient.labSchedule ? {
            testType: patient.labSchedule.testType,
            status: 'Selesai',
            notes: patient.labSchedule.notes,
          } : undefined,
        };
      }
    } else if (reco.category !== 'EPO_4X_2000') {
      return {
        isHD: true,
        isHbCheck: true,
        isPrimary,
        pairedDate,
        cellCode: 'HD',
        title: `HD = Sesi Rutin (Pemeriksaan Cek HB Selesai — Nilai: ${patient.hbValue > 0 ? patient.hbValue.toFixed(1) + ' g/dL' : 'Sampel Selesai Diambil'})`,
        isCatchUp: false,
        canTakeAction: true,
        labCheckInfo: patient.labSchedule ? {
          testType: patient.labSchedule.testType,
          status: 'Selesai',
          notes: patient.labSchedule.notes,
        } : undefined,
      };
    }
  }

  // 2. Kategori Non-EPO (Transfusi, Hold, Menunggu Lab) pada sesi rutin
  if (reco.category === 'HOLD_EVALUASI') {
    return {
      isHD: true,
      isHbCheck,
      isPrimary,
      pairedDate,
      cellCode: 'HD',
      title: 'HD = Sesi Rutin (Protokol Klinis ke-5: HB > 12.00 mg/dl tidak mendapatkan terapi EPO)',
      isCatchUp: false,
      canTakeAction: false,
    };
  }
  if (reco.category === 'MENUNGGU_HASIL_LAB') {
    return {
      isHD: true,
      isHbCheck,
      isPrimary,
      pairedDate,
      cellCode: 'HD',
      title: 'HD = Sesi Rutin (Menunggu hasil lab Hb awal bulan)',
      isCatchUp: false,
      canTakeAction: false,
    };
  }
  if (reco.category === 'TRANSFUSI_2_RAWAT_INAP' || reco.category === 'TRANSFUSI_1_KANTONG') {
    return {
      isHD: true,
      isHbCheck,
      isPrimary,
      pairedDate,
      cellCode: 'HD',
      title: 'HD = Sesi Rutin',
      isCatchUp: false,
      canTakeAction: false,
    };
  }

  // 3. KATEGORI KHUSUS: TERAPI EPO 1x 2000 IU (MAINTENANCE)
  // Alokasi kuota tepat 1x 2000 IU (1 vial) per bulan.
  if (reco.category === 'EPO_1X_2000') {
    const { nextHDDate } = getPairedHDDate(
      dateNumber,
      dayInfo.dayOfWeek,
      patient.scheduleDay,
      monthInfo.daysInMonth,
      patient.hdFrequency,
      patient.singleDay
    );

    // Cek jika tanggal ini memiliki record status langsung (Diberikan / Tunda / Batal)
    if (existingRecord) {
      if (existingRecord.status === 'Diberikan') {
        const catchUpText = existingRecord.postponedFromDate
          ? ` (Pengalihan dari penundaan tgl ${existingRecord.postponedFromDate})`
          : '';
        return {
          isHD: true,
          isHbCheck,
          isPrimary,
          pairedDate,
          cellCode: '✅',
          title: `✅ = EPO 1x 2000 IU Diberikan (Maintenance)${catchUpText}${existingRecord.administeredAt ? ' (' + existingRecord.administeredAt + ')' : ''}`,
          isCatchUp: Boolean(existingRecord.postponedFromDate),
          canTakeAction: true,
          currentStatus: 'Diberikan',
          postponedFromDate: existingRecord.postponedFromDate,
        };
      }
      if (existingRecord.status === 'Tunda') {
        const dest = existingRecord.postponedToDate || nextHDDate || pairedDate;
        return {
          isHD: true,
          isHbCheck,
          isPrimary,
          pairedDate,
          cellCode: '❌',
          title: `❌ = Ditunda (Dialihkan ke sesi HD berikutnya tgl ${dest || '-'})`,
          isCatchUp: false,
          canTakeAction: true,
          currentStatus: 'Tunda',
          postponedToDate: dest || undefined,
        };
      }
      if (existingRecord.status === 'Batal') {
        return {
          isHD: true,
          isHbCheck,
          isPrimary,
          pairedDate,
          cellCode: 'Batal',
          title: 'Pemberian EPO 1x 2000 IU Dibatalkan',
          isCatchUp: false,
          canTakeAction: true,
          currentStatus: 'Batal',
        };
      }
    }

    const epo1x = getScheduledDateForEpo1x(patient, monthInfo);

    // Jika dosis 1x 2000 IU sudah diberikan pada tanggal lain di bulan ini
    if (epo1x.givenDate !== null && epo1x.givenDate !== dateNumber) {
      return {
        isHD: true,
        isHbCheck,
        isPrimary,
        pairedDate,
        cellCode: 'HD',
        title: `HD = Sesi Rutin (Maintenance: Dosis EPO 1x 2000 IU telah diberikan pada tgl ${epo1x.givenDate})`,
        isCatchUp: false,
        canTakeAction: true,
      };
    }

    // Jika tanggal ini adalah tanggal alokasi Terjadwal EPO 1x 2000 IU
    if (epo1x.scheduledDate === dateNumber) {
      const isCarryover = Boolean(epo1x.postponedDate);
      const titleDesc = isCarryover
        ? `2000 = Terjadwal EPO 1x (Pengalihan dari penundaan tgl ${epo1x.postponedDate})`
        : `2000 = Terjadwal EPO 1x 2000 IU (Maintenance M1${isPrimary ? ' - Hari Awal' : ' - Hari Kedua'})`;
      return {
        isHD: true,
        isHbCheck,
        isPrimary,
        pairedDate,
        cellCode: '2000',
        title: titleDesc,
        isCatchUp: isCarryover,
        canTakeAction: true,
        currentStatus: 'Belum',
        postponedToDate: nextHDDate || undefined,
        postponedFromDate: epo1x.postponedDate || undefined,
      };
    }

    // Seluruh tanggal sesi HD lainnya adalah sesi rutin HD biasa tanpa EPO
    return {
      isHD: true,
      isHbCheck,
      isPrimary,
      pairedDate,
      cellCode: 'HD',
      title: `HD = Sesi Rutin (Maintenance: Alokasi EPO 1x 2000 IU terjadwal pada tgl ${epo1x.scheduledDate || 'M1'})`,
      isCatchUp: false,
      canTakeAction: true,
    };
  }

  // 4. KATEGORI TERAPI EPO 4x 2000 IU (DOSIS PENUH)
  // Check if date has incoming carryover postponement from an earlier date
  const incomingSourceDate = existingRecord?.postponedFromDate || (
    !isOnceWeekly && pairedDate ? (patient.dailyRecords?.[pairedDate]?.status === 'Tunda' ? pairedDate : null) : null
  );

  const { nextHDDate } = getPairedHDDate(
    dateNumber,
    dayInfo.dayOfWeek,
    patient.scheduleDay,
    monthInfo.daysInMonth,
    patient.hdFrequency,
    patient.singleDay
  );

  if (isPrimary) {
    // Sesi Utama (Senin/Selasa/Rabu untuk 2x/minggu, atau Setiap Sesi Mingguan untuk 1x/minggu)
    if (existingRecord) {
      if (existingRecord.status === 'Diberikan') {
        const catchUpText = existingRecord.postponedFromDate 
          ? ` (Pengalihan dari penundaan tgl ${existingRecord.postponedFromDate})` 
          : '';
        return {
          isHD: true,
          isHbCheck,
          isPrimary,
          pairedDate,
          cellCode: '✅',
          title: `✅ = EPO Diberikan${catchUpText}${existingRecord.administeredAt ? ' (' + existingRecord.administeredAt + ')' : ''}`,
          isCatchUp: Boolean(existingRecord.postponedFromDate),
          canTakeAction: true,
          currentStatus: 'Diberikan',
          postponedFromDate: existingRecord.postponedFromDate,
        };
      }
      if (existingRecord.status === 'Tunda') {
        const dest = existingRecord.postponedToDate || pairedDate;
        const destDesc = isBiweekly
          ? `Sesi HD Berikutnya (14 hari) tgl ${dest}`
          : isOnceWeekly 
          ? `Sesi HD Berikutnya tgl ${dest}` 
          : `Hari Ke-2 tgl ${dest}`;
        return {
          isHD: true,
          isHbCheck,
          isPrimary,
          pairedDate,
          cellCode: '❌',
          title: `❌ = Ditunda (Ke ${destDesc})`,
          isCatchUp: false,
          canTakeAction: true,
          currentStatus: 'Tunda',
          postponedToDate: dest || undefined,
        };
      }
      if (existingRecord.status === 'Batal') {
        return {
          isHD: true,
          isHbCheck,
          isPrimary,
          pairedDate,
          cellCode: 'Batal',
          title: 'Pemberian EPO Dibatalkan',
          isCatchUp: false,
          canTakeAction: true,
          currentStatus: 'Batal',
        };
      }
    }

    // Jika ada penundaan yang dialihkan ke tanggal ini
    if (incomingSourceDate) {
      return {
        isHD: true,
        isHbCheck,
        isPrimary,
        pairedDate,
        cellCode: '2000',
        title: `2000 = Terjadwal EPO (Pengalihan dari penundaan tgl ${incomingSourceDate})`,
        isCatchUp: true,
        canTakeAction: true,
        currentStatus: 'Belum',
        postponedFromDate: incomingSourceDate,
        postponedToDate: pairedDate || undefined,
      };
    }

    // Default: Terjadwal 2000 IU
    const destStr = pairedDate 
      ? (isOnceWeekly ? `(dialihkan ke tgl ${pairedDate} jika ditunda)` : `(dialihkan ke Hari Kedua tgl ${pairedDate} jika ditunda)`)
      : '';
    const checkNote = isHbCheck ? ' [Sesi Cek Hb Awal Pertemuan]' : '';
    return {
      isHD: true,
      isHbCheck,
      isPrimary,
      pairedDate,
      cellCode: '2000',
      title: `2000 = Terjadwal EPO ${destStr}${checkNote}`.trim(),
      isCatchUp: false,
      canTakeAction: true,
      currentStatus: 'Belum',
      postponedToDate: pairedDate || undefined,
    };
  } else {
    // HARI KEDUA (Kamis / Jumat / Sabtu untuk pasien 2x/minggu)
    const isPairedPostponed = pairedDate ? patient.dailyRecords?.[pairedDate]?.status === 'Tunda' : false;
    const isPairedHbCheck = pairedDate ? isPatientHbCheckDay(pairedDate, monthInfo.days, patient) : false;
    const isCatchUpScheduled = isPairedPostponed || isPairedHbCheck || Boolean(incomingSourceDate);

    if (isCatchUpScheduled) {
      const sourceDate = incomingSourceDate || pairedDate;
      if (existingRecord) {
        if (existingRecord.status === 'Diberikan') {
          return {
            isHD: true,
            isHbCheck,
            isPrimary,
            pairedDate,
            cellCode: '✅',
            title: `✅ = EPO Diberikan pada Hari Kedua (Jadwal Pengalihan dari penundaan tgl ${sourceDate})`,
            isCatchUp: true,
            canTakeAction: true,
            currentStatus: 'Diberikan',
            postponedFromDate: sourceDate || undefined,
          };
        }
        if (existingRecord.status === 'Tunda') {
          const dest = existingRecord.postponedToDate || nextHDDate;
          return {
            isHD: true,
            isHbCheck,
            isPrimary,
            pairedDate,
            cellCode: '❌',
            title: `❌ = Ditunda pada Hari Kedua (tgl ${dateNumber})`,
            isCatchUp: true,
            canTakeAction: true,
            currentStatus: 'Tunda',
            postponedToDate: dest || undefined,
            postponedFromDate: sourceDate || undefined,
          };
        }
        if (existingRecord.status === 'Batal') {
          return {
            isHD: true,
            isHbCheck,
            isPrimary,
            pairedDate,
            cellCode: 'Batal',
            title: 'Jadwal Pengganti Dibatalkan',
            isCatchUp: true,
            canTakeAction: true,
            currentStatus: 'Batal',
            postponedFromDate: sourceDate || undefined,
          };
        }
      }

      // Jadwal Pengganti yang belum diberikan: Tampilkan 2000
      const reasonDesc = isPairedHbCheck
        ? `pengganti sesi Cek Hb tgl ${pairedDate}`
        : `dialihkan dari penundaan Hari Awal tgl ${sourceDate}`;
      return {
        isHD: true,
        isHbCheck,
        isPrimary,
        pairedDate,
        cellCode: '2000',
        title: `2000 = Terjadwal EPO (${reasonDesc})`,
        isCatchUp: true,
        canTakeAction: true,
        currentStatus: 'Belum',
        postponedToDate: nextHDDate || undefined,
        postponedFromDate: sourceDate || undefined,
      };
    }

    // Jika Hari Awal sudah diberikan atau terjadwal normal (tidak ditunda):
    return {
      isHD: true,
      isHbCheck,
      isPrimary,
      pairedDate,
      cellCode: 'HD',
      title: `HD = Sesi Rutin`,
      isCatchUp: false,
      canTakeAction: false,
    };
  }
}

/**
 * Menghitung sesi HD minggu ke berapa dalam bulan tersebut untuk pasien.
 * Menormalkan tanggal Hari Kedua (Kamis/Jumat/Sabtu) ke Hari Awal (Senin/Selasa/Rabu) pasangannya,
 * sehingga kedua sesi dalam satu minggu HD selalu berada di minggu yang sama!
 */
export function getHDSessionWeek(
  dateNumber: number,
  daysInMonth: number,
  scheduleDay?: HDDaySchedule,
  postponedFromDate?: number,
  singleDay?: SingleHDDay,
  hdFrequency?: HDFrequency
): 1 | 2 | 3 | 4 {
  // Jika ini adalah pengalihan dari penundaan hari lain, gunakan tanggal asal
  const targetDate = postponedFromDate || dateNumber;

  let normalizedDate = targetDate;
  if (hdFrequency !== '1 kali dalam satu minggu' && scheduleDay && normalizedDate > 3) {
    // Hari kedua (Kamis untuk Senin-Kamis, Jumat untuk Selasa-Jumat, Sabtu untuk Rabu-Sabtu)
    // berjarak 3 hari dari Hari Awalnya. Jika dinormalkan -3, selalu merujuk pada Hari Awal yang sama.
    const refDay = new Date(2026, 8, targetDate).getDay(); // Acuan Sept 2026
    if (!isPrimaryHDDay(refDay, scheduleDay) && normalizedDate - 3 >= 1) {
      normalizedDate = normalizedDate - 3;
    }
  }

  if (normalizedDate <= 7) return 1;
  if (normalizedDate <= 14) return 2;
  if (normalizedDate <= 21) return 3;
  return 4;
}

/**
 * Ekstraksi Spreadsheet ID dari input teks
 */
export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return trimmed;
}

/**
 * Mengambil detail spreadsheet
 */
export async function getSpreadsheetDetails(spreadsheetId: string, accessToken: string) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    let message = 'Gagal mengakses Google Spreadsheet.';
    if (res.status === 404) message = 'Spreadsheet tidak ditemukan.';
    if (res.status === 403) message = 'Akses ditolak. Pastikan akun Google memiliki hak akses edit.';
    throw new Error(`${message} (${res.status}): ${errorText}`);
  }

  return await res.json();
}

/**
 * Membangun array baris matriks untuk Sheet Jadwal tertentu
 * DENGAN PEMISAHAN JELAS ANTARA SHIFT PAGI DAN SHIFT SIANG PADA BARIS TERPISAH
 * SERTA KODE MINIMALIS (P, 2000, PRC, HD) AGAR MUDAH DIBACA DI KOLOM BERUKURAN KECIL
 */
export function buildScheduleMatrixTable(
  patients: PatientRecord[],
  scheduleDay: HDDaySchedule,
  yearMonth: string
): string[][] {
  const { daysInMonth, days } = getMonthDaysInfo(yearMonth);
  const filteredPatients = patients.filter((p) => p.scheduleDay === scheduleDay);

  // Pisahkan pasien berdasarkan shift: Pagi dan Siang (Shift Sore dihapus sesuai kebijakan operasional HD)
  const pagiPatients = filteredPatients.filter((p) => p.scheduleShift.includes('Pagi'));
  const siangPatients = filteredPatients.filter((p) => p.scheduleShift.includes('Siang'));

  // Baris Header Kolom
  const header: string[] = [
    'No',
    'Nama Pasien',
    'No. RM',
    'Frekuensi HD',
    'Shift',
    'Hb',
    'Alokasi Klinis / Dosis',
  ];

  // Kolom tanggal 1 s/d 30/31
  for (let d = 1; d <= daysInMonth; d++) {
    header.push(String(d));
  }

  // Kolom ringkasan di sebelah kanan
  header.push(
    'Target EPO',
    'Realisasi',
    'Rasio',
    'PRC',
    'Status',
    'Catatan Klinis'
  );

  const rows: string[][] = [header];

  // Inisialisasi akumulator rekap harian
  const dailyPagiCount = new Array(daysInMonth).fill(0);
  const dailySiangCount = new Array(daysInMonth).fill(0);
  const dailyEpoScheduledCount = new Array(daysInMonth).fill(0);
  const dailyEpoGivenCount = new Array(daysInMonth).fill(0);
  const dailyPrcCount = new Array(daysInMonth).fill(0);
  const dailyTotalPatients = new Array(daysInMonth).fill(0);

  let grandTargetEpo = 0;
  let grandRealisasiEpo = 0;
  let grandTotalPrc = 0;

  // Helper untuk membuat baris pasien
  const renderPatientRow = (patient: PatientRecord, displayNo: number) => {
    const freqDisplay = patient.hdFrequency === '1 kali dalam satu minggu'
      ? (patient.singleDay ? `1x / mgg (${patient.singleDay})` : '1x / mgg')
      : '2x / mgg';
    const row: string[] = [
      String(displayNo),
      patient.name,
      patient.noRm,
      freqDisplay,
      patient.scheduleShift.includes('Pagi') ? 'Pagi (P)' : 'Siang (S)',
      patient.hbValue.toFixed(1),
      patient.recommendation.title,
    ];

    const reco = patient.recommendation;
    let patientEpoGiven = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const info = getDateDoseDisplayInfo(patient, d, { daysInMonth, days });
      if (!info.isHD) {
        row.push('-');
      } else {
        dailyTotalPatients[d - 1]++;
        if (patient.scheduleShift.includes('Pagi')) dailyPagiCount[d - 1]++;
        else dailySiangCount[d - 1]++;

        if (info.cellCode === '2000') {
          dailyEpoScheduledCount[d - 1]++;
        } else if (info.cellCode === '✅' || (info.cellCode as any) === 'P') {
          patientEpoGiven++;
          dailyEpoGivenCount[d - 1]++;
        }

        if (info.cellCode === 'PRC 2' || (info.cellCode as any) === 'PRC') {
          dailyPrcCount[d - 1] += 2;
        } else if (info.cellCode === 'PRC 1') {
          dailyPrcCount[d - 1] += 1;
        }

        row.push(info.cellCode);
      }
    }

    const targetEpo = reco.totalEpoVials;
    grandTargetEpo += targetEpo;
    grandRealisasiEpo += patientEpoGiven;
    grandTotalPrc += reco.transfusionBags;

    row.push(
      String(targetEpo),
      String(patientEpoGiven),
      `${patientEpoGiven} : ${targetEpo}`,
      String(reco.transfusionBags > 0 ? reco.transfusionBags : '-'),
      patient.overallStatus,
      patient.clinicalNotes || ''
    );

    return row;
  };

  // Helper untuk membuat baris pemisah kelompok shift (bebas dari tanda '=' atau '==' agar tidak memicu #ERROR! formula parse)
  const makeShiftBannerRow = (label: string, shiftTag: string) => {
    const banner = ['•', label, '', shiftTag, '', '', ''];
    for (let d = 1; d <= daysInMonth; d++) {
      banner.push('');
    }
    banner.push('', '', '', '', '', 'Sub Bagian Shift');
    return banner;
  };

  // 1. BAGIAN SHIFT 1: PAGI (DIPISAHKAN PADA BARIS SENDIRI)
  if (pagiPatients.length > 0) {
    rows.push(makeShiftBannerRow('KELOMPOK SHIFT PAGI (07:00 WIB)', 'Shift 1 (Pagi)'));
    pagiPatients.forEach((patient, idx) => {
      rows.push(renderPatientRow(patient, idx + 1));
    });
  }

  // Baris Pemisah / Spasi Antara Shift
  rows.push(new Array(header.length).fill(''));

  // 2. BAGIAN SHIFT 2: SIANG (DIPISAHKAN PADA BARIS SENDIRI)
  if (siangPatients.length > 0) {
    rows.push(makeShiftBannerRow('KELOMPOK SHIFT SIANG (12:30 WIB)', 'Shift 2 (Siang)'));
    siangPatients.forEach((patient, idx) => {
      rows.push(renderPatientRow(patient, idx + 1));
    });
  }

  // Spasi sebelum baris total ringkasan
  rows.push(new Array(header.length).fill(''));

  // BARIS TOTAL RINGKASAN BAWAH (PERSIS SEPERTI BARIS 19-24 PADA GOOGLE SHEETS HEMOSHIF)
  const prefixPagi = ['', 'Total Shift Pagi (P)', '-', '-', 'Sif Pagi', '-', '-'];
  const prefixSiang = ['', 'Total Shift Siang (S)', '-', '-', 'Sif Siang', '-', '-'];
  const prefixPrc = ['', 'Total Kebutuhan PRC (Kantong)', '-', '-', 'Bank Darah', '-', '-'];
  const prefixEpoTerjadwal = ['', 'Kebutuhan Harian EPO (Ampul 2000 IU)', '-', '-', 'Terjadwal', '-', '-'];
  const prefixEpoKeluar = ['', 'Epo Keluar', '-', '-', 'Diberikan', '-', '-'];
  const prefixTotal = ['', 'Total Pasien HD Harian', '-', '-', 'Total Sesi', '-', '-'];

  for (let d = 0; d < daysInMonth; d++) {
    prefixPagi.push(dailyPagiCount[d] > 0 ? String(dailyPagiCount[d]) : '-');
    prefixSiang.push(dailySiangCount[d] > 0 ? String(dailySiangCount[d]) : '-');
    prefixPrc.push(dailyPrcCount[d] > 0 ? String(dailyPrcCount[d]) : '-');
    prefixEpoTerjadwal.push(dailyEpoScheduledCount[d] > 0 ? String(dailyEpoScheduledCount[d]) : '-');
    prefixEpoKeluar.push(dailyEpoGivenCount[d] > 0 ? String(dailyEpoGivenCount[d]) : '-');
    prefixTotal.push(dailyTotalPatients[d] > 0 ? String(dailyTotalPatients[d]) : '-');
  }

  // Ringkasan Total Kanan
  prefixPagi.push('-', '-', '-', '-', '-', `${dailyPagiCount.reduce((a, b) => a + b, 0)} Sesi Pagi`);
  prefixSiang.push('-', '-', '-', '-', '-', `${dailySiangCount.reduce((a, b) => a + b, 0)} Sesi Siang`);
  prefixPrc.push('-', '-', '-', String(grandTotalPrc), '-', 'Total Kantong');
  prefixEpoTerjadwal.push(String(grandTargetEpo), '-', '-', '-', '-', `${dailyEpoScheduledCount.reduce((a, b) => a + b, 0)} Ampul Terjadwal`);
  prefixEpoKeluar.push('-', String(grandRealisasiEpo), `${grandRealisasiEpo} : ${grandTargetEpo}`, '-', '-', `${dailyEpoGivenCount.reduce((a, b) => a + b, 0)} Ampul Keluar`);
  prefixTotal.push('-', '-', '-', '-', `${filteredPatients.length} Pasien`, 'Grand Total');

  rows.push(prefixPagi);
  rows.push(prefixSiang);
  rows.push(prefixPrc);
  rows.push(prefixEpoTerjadwal);
  rows.push(prefixEpoKeluar);
  rows.push(prefixTotal);

  return rows;
}

/**
 * Membuat spreadsheet baru dengan 3 sheet jadwal:
 * 1. Senin-Kamis
 * 2. Selasa-Jumat
 * 3. Rabu-Sabtu
 */
export async function createNewSpreadsheet(title: string, accessToken: string) {
  const payload = {
    properties: {
      title: title || `Jadwal & Alokasi EPO HD - ${new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}`,
    },
    sheets: SCHEDULE_SHEETS.map((item) => ({
      properties: {
        title: item.tabName,
        gridProperties: {
          frozenRowCount: 1,
          frozenColumnCount: 5,
          rowCount: 120,
          columnCount: 46,
        },
      },
    })),
  };

  const res = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gagal membuat spreadsheet baru: ${errorText}`);
  }

  return await res.json();
}

/**
 * Menyimpan seluruh data pasien ke 3 sheet Google Sheets:
 * - Tab 'Senin-Kamis'
 * - Tab 'Selasa-Jumat'
 * - Tab 'Rabu-Sabtu'
 * Serta menerapkan ukuran kolom minimalis dan pemisahan baris per shift
 */
export async function pushPatientsToSheet(
  spreadsheetId: string,
  patients: PatientRecord[],
  accessToken: string,
  yearMonth: string = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  targetSchedule?: HDDaySchedule
) {
  const metadata = await getSpreadsheetDetails(spreadsheetId, accessToken);
  const existingSheets: string[] = (metadata.sheets || []).map((s: any) => s.properties?.title);

  const sheetsToUpdate = targetSchedule 
    ? SCHEDULE_SHEETS.filter((s) => s.title === targetSchedule)
    : SCHEDULE_SHEETS;

  // Buat tab jadwal yang belum ada
  for (const item of sheetsToUpdate) {
    if (!existingSheets.includes(item.tabName)) {
      await addSheetTab(spreadsheetId, item.tabName, accessToken);
    }
  }

  // Kirim data matriks ke masing-masing sheet jadwal secara paralel
  await Promise.all(
    sheetsToUpdate.map(async (item) => {
      const tableData = buildScheduleMatrixTable(patients, item.title, yearMonth);
      const range = `${item.tabName}!A1:${getColLetter(tableData[0]?.length || 40)}${tableData.length + 10}`;
      return updateSheetValues(spreadsheetId, range, tableData, accessToken);
    })
  );

  // Buat atau Update Tab REKAP_HB_TAHUNAN (Integrasi 1 Tahun)
  try {
    if (!existingSheets.includes('REKAP_HB_TAHUNAN')) {
      await addSheetTab(spreadsheetId, 'REKAP_HB_TAHUNAN', accessToken);
    }
    const yearlyTable = buildYearlySummaryTable(patients, yearMonth);
    const yearlyRange = `REKAP_HB_TAHUNAN!A1:${getColLetter(yearlyTable[0]?.length || 24)}${yearlyTable.length + 5}`;
    await updateSheetValues(spreadsheetId, yearlyRange, yearlyTable, accessToken);
  } catch (err) {
    console.warn('Gagal memperbarui REKAP_HB_TAHUNAN via direct API:', err);
  }

  // Buat atau Update Tab JADWAL_CEK_HB & MATRIKS_CEK_HB (Penjadwalan Cek Hb Bulan Selanjutnya)
  try {
    if (!existingSheets.includes('JADWAL_CEK_HB')) {
      await addSheetTab(spreadsheetId, 'JADWAL_CEK_HB', accessToken);
    }
    const labTable = buildNextMonthLabScheduleTable(patients, yearMonth);
    const labRange = `JADWAL_CEK_HB!A1:${getColLetter(labTable[0]?.length || 14)}${labTable.length + 5}`;
    await updateSheetValues(spreadsheetId, labRange, labTable, accessToken);

    if (!existingSheets.includes('MATRIKS_CEK_HB')) {
      await addSheetTab(spreadsheetId, 'MATRIKS_CEK_HB', accessToken);
    }
    const matTable = buildNextMonthCalendarMatrix(patients, yearMonth);
    const matRange = `MATRIKS_CEK_HB!A1:${getColLetter(matTable[0]?.length || 6)}${matTable.length + 5}`;
    await updateSheetValues(spreadsheetId, matRange, matTable, accessToken);
  } catch (err) {
    console.warn('Gagal memperbarui JADWAL_CEK_HB via direct API:', err);
  }

  // Terapkan styling visual & UKURAN KOLOM MINIMALIS
  try {
    await applyHeaderAndColumnStyling(spreadsheetId, accessToken);
  } catch (err) {
    console.warn('Gagal menerapkan styling conditional (data tetap tersimpan):', err);
  }

  return { success: true };
}

/**
 * Membaca data pasien dari 3 sheet jadwal: 'Senin-Kamis', 'Selasa-Jumat', 'Rabu-Sabtu'
 * dan menyinkronkan acuan Hb sebelumnya dari 'REKAP_HB_TAHUNAN' jika ada
 */
export async function readPatientsFromSheet(
  spreadsheetId: string,
  accessToken: string,
  currentMonth: string
): Promise<PatientRecord[]> {
  const metadata = await getSpreadsheetDetails(spreadsheetId, accessToken);
  const existingSheets: string[] = (metadata.sheets || []).map((s: any) => s.properties?.title);

  // Baca REKAP_HB_TAHUNAN jika ada
  let yearlyMap = new Map<string, number>();
  if (existingSheets.includes('REKAP_HB_TAHUNAN')) {
    try {
      const yRange = 'REKAP_HB_TAHUNAN!A1:X150';
      const yRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(yRange)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (yRes.ok) {
        const yJson = await yRes.json();
        const yRows: string[][] = yJson.values || [];
        const [_, curMonthPart] = currentMonth.split('-');
        const monthNum = parseInt(curMonthPart, 10) || (new Date().getMonth() + 1);
        const prevColIdx = monthNum >= 2 ? (9 + monthNum - 1) : -1;

        yRows.slice(1).forEach((yr) => {
          const rm = (yr[2] || '').trim().toLowerCase();
          if (!rm) return;
          let prevHb: number | undefined = undefined;
          if (prevColIdx !== -1 && yr[prevColIdx]) {
            const parsed = parseFloat(String(yr[prevColIdx]).replace(',', '.'));
            if (!isNaN(parsed) && parsed > 0) prevHb = parsed;
          }
          if (prevHb === undefined && yr[6]) {
            const parsed = parseFloat(String(yr[6]).replace(',', '.'));
            if (!isNaN(parsed) && parsed > 0) prevHb = parsed;
          }
          if (prevHb !== undefined) yearlyMap.set(rm, prevHb);
        });
      }
    } catch (e) {
      console.warn('Gagal membaca REKAP_HB_TAHUNAN:', e);
    }
  }

  const targetTabs = SCHEDULE_SHEETS.filter((s) => existingSheets.includes(s.tabName));

  if (targetTabs.length === 0 && existingSheets.length > 0) {
    const singleData = await readSingleSheetData(spreadsheetId, existingSheets[0], 'Senin - Kamis', accessToken, currentMonth);
    return singleData;
  }

  // Baca seluruh tab secara paralel untuk kecepatan maksimal
  const results = await Promise.all(
    targetTabs.map((item) =>
      readSingleSheetData(spreadsheetId, item.tabName, item.title, accessToken, currentMonth)
    )
  );

  const flatPatients = results.flat();

  // Lengkapi dengan acuan Hb sebelumnya dari REKAP_HB_TAHUNAN jika ada
  return flatPatients.map((p) => {
    const prevHb = yearlyMap.get(p.noRm.toLowerCase().trim());
    if (prevHb !== undefined) {
      const isSelective = prevHb < 9.0;
      return {
        ...p,
        prevHbValue: prevHb,
        isSelectiveHb: isSelective,
        labSchedule: {
          scheduledDate: p.labSchedule?.scheduledDate || getFirstHDDateOfMonth(currentMonth, p.scheduleDay, p.singleDay, p.hdFrequency).dateString,
          testType: isSelective ? 'Cek Hb Pilihan (Hb < 9.0)' : 'Rutin Hb (Evaluasi EPO)',
          status: p.hbValue > 0 ? 'Selesai' : 'Terjadwal',
          isSelectiveHb: isSelective,
          selectiveReason: isSelective ? `Nilai Hb sebelumnya ${prevHb.toFixed(1)} g/dL (< 9.0 g/dL)` : undefined,
        },
      };
    }
    return p;
  });
}

/**
 * Mengecek apakah baris merupakan header, banner shift, atau baris total ringkasan
 * (Total Shift Pagi, Total Shift Siang, Kebutuhan PRC, Kebutuhan EPO, Epo Keluar, Total Pasien)
 * agar tidak salah terimpor sebagai data pasien.
 */
export function isSummaryOrHeaderRow(name: string, noRm: string = '', fullLine: string = ''): boolean {
  const n = (name || '').toLowerCase().trim();
  const rm = (noRm || '').toLowerCase().trim();
  const line = (fullLine || '').toLowerCase().trim();

  if (!n && !rm) return true;
  if (n.startsWith('==') || n.startsWith('•') || n.startsWith('#')) return true;
  if (n.includes('#error') || rm.includes('#error') || line.includes('#error')) return true;

  const summaryKeywords = [
    'total shift',
    'shift pagi',
    'shift siang',
    'sif pagi',
    'sif siang',
    'kebutuhan transfusi',
    'transfusi prc',
    'kantong prc',
    'kebutuhan harian epo',
    'kebutuhan epo',
    'kebutuhan harian',
    'epo keluar',
    'total kebutuhan',
    'total pasien',
    'pasien hd per hari',
    'pasien hd harian',
    'kelompok shift',
    'grand total',
    'bank darah',
    'target epo',
    'ampul terjadwal',
    'ampul diberikan',
    'ampul keluar',
  ];

  if (summaryKeywords.some((kw) => n.includes(kw) || rm.includes(kw) || line.includes(kw))) {
    return true;
  }

  // Cek kata kunci awalan
  if (n.startsWith('total') || n === 'epo keluar' || n.includes('kebutuhan') || n.startsWith('kelompok')) {
    return true;
  }

  return false;
}

/**
 * Fungsi dekoder cerdas untuk membaca nilai Hb dari Google Sheets:
 * Mencegah & memperbaiki bug Google Sheets yang secara otomatis mengubah angka desimal
 * seperti 8.9, 10.8, 12.5 menjadi objek Tanggal/ISO (misal: "2026-08-08T17:00:00.000Z")
 * karena regional setting Indonesia (koma vs titik).
 */
export function decodeHbFromValue(rawVal: any, doseText?: string): number {
  if (rawVal === undefined || rawVal === null) return 0;
  const s = String(rawVal).trim();
  if (!s || s === '0' || s === '0.0' || s === '-' || s.toLowerCase() === 'null') return 0;

  // 1. Jika terformat sebagai ISO Date String dari Google Sheets / Apps Script (misal: "2026-08-08T17:00:00.000Z")
  if ((s.includes('T') && s.endsWith('Z')) || s.match(/^\d{4}-\d{2}-\d{2}/)) {
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      // Konversi ke zona waktu Indonesia Barat (WIB = UTC+7)
      const wib = new Date(d.getTime() + 7 * 3600 * 1000);
      const day = wib.getUTCDate();
      const month = wib.getUTCMonth() + 1; // 1 to 12

      const dose = (doseText || '').toLowerCase();
      const isMaintenance = dose.includes('1 x 2000') || dose.includes('maintenance') || dose.includes('1x 2000');
      const isOver12 = dose.includes('> 12') || dose.includes('protokol 5') || dose.includes('tidak mendapatkan');
      const is4x = dose.includes('4 x 2000') || dose.includes('4x 2000') || dose.includes('1x/minggu');
      const isTransfusion2 = dose.includes('2 bag') || dose.includes('rawat inap');
      const isTransfusion1 = dose.includes('1 bag') || dose.includes('1 kantong');

      if (isTransfusion2) {
        return day < 7 ? parseFloat(`${day}.${month}`) : 6.8;
      }
      if (isTransfusion1) {
        return day >= 7 && day <= 8 ? parseFloat(`${day}.${month}`) : 7.5;
      }
      if (isOver12) {
        if (day > 12) return parseFloat(`${day}.${month}`);
        if (month > 0 && month <= 9) return parseFloat(`12.${month}`);
        return parseFloat(`${day}.${month}`);
      }
      if (isMaintenance) {
        if (day >= 10 && day <= 12) return parseFloat(`${day}.${month}`);
        if (day === 9) {
          if (month === 8) return 10.8;
          if (month === 7) return 10.7;
          if (month === 2) return 10.2;
          return parseFloat(`10.${month}`);
        }
        if (month >= 10 && month <= 12) return parseFloat(`${month}.${day}`);
        return parseFloat(`${day}.${month}`);
      }
      if (is4x) {
        if (day === 8) return parseFloat(`8.${month}`);
        if (month === 8) return parseFloat(`8.${day}`);
        if (day === 7) return parseFloat(`7.${month}`);
        if (month === 7) return parseFloat(`8.${day}`);
        if (day === 9) return parseFloat(`8.${month}`);
        return parseFloat(`${day}.${month}`);
      }

      if (day >= 7 && day <= 9) return parseFloat(`8.${month}`);
      if (day >= 10 && day <= 12) return parseFloat(`10.${month}`);
      return parseFloat(`${day}.${month}`);
    }
  }

  // 2. Format tanggal umum (DD/MM/YYYY atau MM/DD/YYYY)
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const p1 = parseInt(slashMatch[1], 10);
    const p2 = parseInt(slashMatch[2], 10);
    const dose = (doseText || '').toLowerCase();
    if (dose.includes('1 x 2000') || dose.includes('maintenance')) {
      if (p1 >= 10 && p1 <= 12) return parseFloat(`${p1}.${p2}`);
      if (p2 >= 10 && p2 <= 12) return parseFloat(`${p2}.${p1}`);
      return 10.8;
    }
    if (dose.includes('4 x 2000')) {
      if (p1 >= 7 && p1 <= 9) return parseFloat(`${p1}.${p2}`);
      if (p2 >= 7 && p2 <= 9) return parseFloat(`${p2}.${p1}`);
      return 8.8;
    }
  }

  // 3. Format angka standar dengan koma atau titik
  const num = parseFloat(s.replace(',', '.'));
  if (isNaN(num)) return 0;
  // Jika nilai tidak wajar untuk Hb manusia (> 30 g/dL), cegah tahun 2026 yang ter-parse
  if (num > 30) {
    if (doseText) {
      if (doseText.includes('1 x 2000') || doseText.includes('Maintenance')) return 10.8;
      if (doseText.includes('4 x 2000')) return 8.8;
      if (doseText.includes('> 12')) return 12.5;
    }
    return 0;
  }
  return num < 0 ? 0 : num;
}

/**
 * Merekonstruksi rekaman harian (dailyRecords) dan jadwal mingguan (weeks)
 * langsung dari baris matriks tanggal 1 s/d 31 di Google Sheets
 */
export function parseDailyRecordsFromRow(
  row: string[],
  daysInMonth: number,
  recommendationCategory: string,
  scheduleDay: HDDaySchedule,
  currentMonth: string
): { dailyRecords: Record<number, DailyActionRecord>; weeks: PatientRecord['weeks'] } {
  const dailyRecords: Record<number, DailyActionRecord> = {};
  const weeks = generateDefaultWeeks(recommendationCategory as any, currentMonth);

  // Kolom tanggal dimulai pada indeks 7 (Kolom ke-8)
  for (let d = 1; d <= daysInMonth; d++) {
    const cellIdx = 6 + d;
    if (cellIdx >= row.length) break;
    const rawCell = (row[cellIdx] || '').toString().trim();
    if (!rawCell || rawCell === '-') continue;

    if (rawCell === '✅' || rawCell.toUpperCase() === 'P' || rawCell.includes('✅')) {
      dailyRecords[d] = {
        status: 'Diberikan',
        administeredAt: 'Tercatat di Google Sheets',
        administeredBy: 'Perawat HD',
      };
      const weekNum = getHDSessionWeek(d, daysInMonth, scheduleDay);
      const wKey = `week${weekNum}` as 'week1' | 'week2' | 'week3' | 'week4';
      if (weeks[wKey]) {
        weeks[wKey].status = 'Diberikan';
        weeks[wKey].administeredAt = 'Tercatat di Google Sheets';
        weeks[wKey].administeredBy = 'Perawat HD';
      }
    } else if (rawCell === '❌' || rawCell.includes('❌')) {
      dailyRecords[d] = {
        status: 'Tunda',
        notes: 'Ditunda di Google Sheets',
      };
      const weekNum = getHDSessionWeek(d, daysInMonth, scheduleDay);
      const wKey = `week${weekNum}` as 'week1' | 'week2' | 'week3' | 'week4';
      if (weeks[wKey] && weeks[wKey].status !== 'Diberikan') {
        weeks[wKey].status = 'Tunda';
        weeks[wKey].notes = 'Ditunda di Google Sheets';
      }
    } else if (rawCell.toLowerCase() === 'batal') {
      dailyRecords[d] = {
        status: 'Batal',
        notes: 'Dibatalkan di Google Sheets',
      };
    } else if (rawCell === '2000') {
      // Untuk EPO 1x 2000 IU, jika sudah ada tanggal terjadwal '2000' atau sudah diberikan, abaikan '2000' duplikat dari sheet lama
      const isEpo1x = recommendationCategory === 'EPO_1X_2000';
      const hasAlreadyScheduled = Object.values(dailyRecords).some((r) => r.status === 'Belum' || r.status === 'Diberikan');
      if (!isEpo1x || !hasAlreadyScheduled) {
        dailyRecords[d] = {
          status: 'Belum',
        };
      }
    }
  }

  // Khusus EPO 1x 2000 IU: jika sudah berstatus Diberikan di satu tanggal, bersihkan record Belum lainnya
  if (recommendationCategory === 'EPO_1X_2000') {
    const hasGiven = Object.values(dailyRecords).some((r) => r.status === 'Diberikan');
    if (hasGiven) {
      for (const [dateStr, rec] of Object.entries(dailyRecords)) {
        if (rec.status === 'Belum') {
          delete dailyRecords[parseInt(dateStr, 10)];
        }
      }
    }
  }

  return { dailyRecords, weeks };
}

async function readSingleSheetData(
  spreadsheetId: string,
  tabName: string,
  scheduleDay: HDDaySchedule,
  accessToken: string,
  currentMonth: string
): Promise<PatientRecord[]> {
  const range = `${tabName}!A1:AZ150`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

  if (!res.ok) return [];

  const json = await res.json();
  const rows: string[][] = json.values || [];
  if (rows.length <= 1) return [];

  const { daysInMonth } = getMonthDaysInfo(currentMonth);
  const dataRows = rows.slice(1);
  const patients: PatientRecord[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const name = (row[1] || '').trim();
    const noRm = (row[2] || '').trim();

    // Lewati baris kosong, header kelompok shift, baris total ringkasan, atau baris error
    if (!name || isSummaryOrHeaderRow(name, noRm, row.join(' '))) {
      continue;
    }

    const col3 = (row[3] || '').trim();
    const col3Lower = col3.toLowerCase();
    let hdFrequency: HDFrequency = '2 kali dalam satu minggu';
    let singleDay: SingleHDDay | undefined = undefined;
    let scheduleShift: HDShift = 'Shift 1 (Pagi)';
    let rawHb = 0;
    let doseTextHint = (row[6] || '').trim();

    if (col3Lower.includes('pagi') || col3Lower.includes('siang')) {
      // Format Lama (tanpa kolom Frekuensi HD)
      scheduleShift = col3Lower.includes('siang') ? 'Shift 2 (Siang)' : 'Shift 1 (Pagi)';
      doseTextHint = (row[5] || '').trim();
      rawHb = decodeHbFromValue(row[4], doseTextHint);
    } else {
      // Format Baru (dengan kolom Frekuensi HD)
      hdFrequency = col3Lower.includes('1') ? '1 kali dalam satu minggu' : '2 kali dalam satu minggu';
      if (col3Lower.includes('senin')) singleDay = 'Senin';
      else if (col3Lower.includes('selasa')) singleDay = 'Selasa';
      else if (col3Lower.includes('rabu')) singleDay = 'Rabu';
      else if (col3Lower.includes('kamis')) singleDay = 'Kamis';
      else if (col3Lower.includes('jumat')) singleDay = 'Jumat';
      else if (col3Lower.includes('sabtu')) singleDay = 'Sabtu';

      if (hdFrequency === '1 kali dalam satu minggu' && singleDay) {
        scheduleDay = getScheduleDayFromSingleDay(singleDay);
      }

      const shiftStr = (row[4] || '').toLowerCase();
      scheduleShift = shiftStr.includes('siang') ? 'Shift 2 (Siang)' : 'Shift 1 (Pagi)';
      rawHb = decodeHbFromValue(row[5], doseTextHint);
    }

    const hbValue = isNaN(rawHb) || rawHb < 0 ? 0 : rawHb;
    const reco = calculateClinicalRecommendation(hbValue);

    // Rekonstruksi status harian dan mingguan dari matriks tanggal
    const { dailyRecords, weeks } = parseDailyRecordsFromRow(row, daysInMonth, reco.category, scheduleDay, currentMonth);

    const statusColIndex = row.length - 2;
    const overallStatusRaw = (row[statusColIndex] || '').trim();
    let overallStatus: PatientRecord['overallStatus'] = 'Berjalan';
    if (overallStatusRaw.includes('Selesai')) overallStatus = 'Selesai';
    else if (overallStatusRaw.includes('Perhatian') || reco.category === 'TRANSFUSI_2_RAWAT_INAP') overallStatus = 'Perlu Perhatian';

    const notes = row[row.length - 1] || '';

    const cleanNoRm = noRm ? noRm.replace(/[^a-zA-Z0-9_-]/g, '') : `RM${1000 + i}`;
    const uniqueSuffix = `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`;

    patients.push({
      id: `sheet-${tabName.toLowerCase()}-${cleanNoRm}-${uniqueSuffix}`,
      noRm: noRm || `RM-${1000 + i}`,
      name,
      hdFrequency,
      singleDay,
      scheduleDay,
      scheduleShift,
      hbValue,
      hbDate: `${currentMonth}-02`,
      monthPeriod: currentMonth,
      recommendation: reco,
      weeks,
      dailyRecords,
      overallStatus,
      clinicalNotes: notes,
      updatedAt: new Date().toISOString(),
    });
  }

  return patients;
}

/**
 * Membangun tabel matriks tahunan terintegrasi (REKAP_HB_TAHUNAN)
 * Menampilkan data pasien, Hb acuan bulan lalu, rencana cek lab bulan depan,
 * serta 12 kolom riwayat Hb bulanan (Jan s/d Des) dalam 1 lembar kerja.
 */
export function buildYearlySummaryTable(
  patients: PatientRecord[],
  yearMonth: string
): string[][] {
  const [yearStr, monthStr] = yearMonth.split('-');
  const monthNum = parseInt(monthStr, 10) || (new Date().getMonth() + 1);
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const curMonthName = monthNames[monthNum - 1] || 'Bulan Ini';

  const header: string[] = [
    'No',
    'Nama Pasien',
    'No. RM',
    'Jadwal HD',
    'Shift',
    'Frekuensi HD',
    'Hb Acuan (Bln Lalu)',
    `Hb Bulan Ini (${curMonthName})`,
    'Rencana Cek Hb Bln Depan',
    'Alokasi Terapi Saat Ini',
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
    'Dokter DPJP',
    'Catatan Klinis Pasien'
  ];

  const rows: string[][] = [header];

  // Urutkan pasien sesuai urutan operasional klinis HD:
  // 1. Senin-Kamis (Pagi)
  // 2. Senin-Kamis (Siang)
  // 3. Selasa-Jumat (Pagi)
  // 4. Selasa-Jumat (Siang)
  // 5. Rabu-Sabtu (Pagi)
  // 6. Rabu-Sabtu (Siang)
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

  const sorted = [...patients].sort((a, b) => {
    const rankA = getScheduleSortRank(a);
    const rankB = getScheduleSortRank(b);
    if (rankA !== rankB) return rankA - rankB;

    // Di dalam kelompok jadwal dan shift yang sama, urutkan nama pasien secara alfabetis
    return a.name.localeCompare(b.name, 'id');
  });

  sorted.forEach((p, idx) => {
    const prevVal = typeof p.prevHbValue === 'number' && p.prevHbValue > 0 ? p.prevHbValue : undefined;
    const curVal = p.hbValue > 0 ? p.hbValue : undefined;

    // Evaluasi klinis untuk rencana cek Hb bulan berikutnya:
    // Acuan utama: jika nilai Hb terakhir <= 8.9 mg/dL -> Cek Hb Pilihan (≤ 8.9)
    const effectiveHbForNext = curVal !== undefined ? curVal : prevVal;
    let rencanaCek = 'Rutin Hb (Evaluasi EPO)';

    if (effectiveHbForNext !== undefined) {
      const roundedVal = Number(effectiveHbForNext.toFixed(1));
      if (roundedVal <= 8.9) {
        rencanaCek = '⭐ Cek Hb Pilihan (≤ 8.9)';
      } else if (roundedVal >= 9.0 && roundedVal <= 12.0) {
        rencanaCek = 'Rutin Maintenance';
      } else if (roundedVal > 12.0) {
        rencanaCek = 'Hold EPO (Evaluasi Ulang)';
      }
    } else if (isSelectiveHbCandidate(p)) {
      rencanaCek = '⭐ Cek Hb Pilihan (≤ 8.9)';
    } else {
      rencanaCek = 'Menunggu Input Lab';
    }

    const prevHbDisplay = prevVal !== undefined ? prevVal.toFixed(1) : '-';
    const curHbDisplay = curVal !== undefined ? curVal.toFixed(1) : '-';

    const row: string[] = [
      String(idx + 1),
      p.name,
      p.noRm,
      p.scheduleDay,
      p.scheduleShift.includes('Pagi') ? 'Pagi (P)' : 'Siang (S)',
      p.hdFrequency === '1 kali dalam satu minggu'
        ? (p.singleDay ? `1x/mgg (${p.singleDay})` : '1x/mgg')
        : '2x/mgg',
      prevHbDisplay,
      curHbDisplay,
      rencanaCek,
      p.recommendation.title,
    ];

    // Kolom 12 Bulan (Jan s/d Des)
    for (let m = 1; m <= 12; m++) {
      if (m === monthNum) {
        row.push(curHbDisplay);
      } else if (m === monthNum - 1 && prevVal !== undefined) {
        row.push(prevHbDisplay);
      } else {
        row.push('');
      }
    }

    row.push(p.doctorInCharge || 'dr. Sp.PD-KGH');
    row.push(p.clinicalNotes || '');

    rows.push(row);
  });

  return rows;
}

/**
 * Mendapatkan string tahun-bulan (YYYY-MM) untuk bulan selanjutnya
 */
export function getNextYearMonth(yearMonth: string): string {
  const [yearStr, monthStr] = yearMonth.split('-');
  const year = parseInt(yearStr, 10) || new Date().getFullYear();
  const month = parseInt(monthStr, 10) || (new Date().getMonth() + 1);
  const nextDate = new Date(year, month, 1);
  return `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Membangun tabel penjadwalan CEK HB bulan selanjutnya (JADWAL_CEK_HB)
 * Berisi nama-nama seluruh pasien yang terjadwal cek Hb pada bulan berikutnya,
 * tersusun rapi dengan kolom lengkap:
 * No, Tanggal Terjadwal, Hari, Shift, Jadwal Rutin, No RM, Nama Pasien, Frekuensi,
 * Hb Terakhir, Kategori Pemeriksaan (⭐ Cek Hb Pilihan vs Rutin), Rekomendasi Terapi,
 * Status Sampling, Kolom Kosong Hasil Lab Baru, Paraf / Catatan.
 */
export function buildNextMonthLabScheduleTable(
  patients: PatientRecord[],
  currentYearMonth: string
): string[][] {
  const nextMonth = getNextYearMonth(currentYearMonth);
  const [yStr, mStr] = nextMonth.split('-');
  const nextYear = parseInt(yStr, 10) || new Date().getFullYear();
  const nextMonthNum = parseInt(mStr, 10) || (new Date().getMonth() + 1);
  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const nextMonthLabel = `${monthNames[nextMonthNum - 1]} ${nextYear}`;

  const header: string[] = [
    'No',
    'Tanggal Terjadwal',
    'Hari',
    'Shift HD',
    'Jadwal Rutin',
    'No. RM',
    'Nama Pasien',
    'Frekuensi HD',
    'Hb Terakhir (g/dL)',
    'Kategori Pemeriksaan',
    'Rekomendasi Terapi Saat Ini',
    'Status Sampling',
    'Hasil Lab Hb Baru (g/dL)',
    'Paraf Petugas / Catatan'
  ];

  const rows: string[][] = [header];
  const dayNamesIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  // Petakan dan urutkan pasien berdasarkan Tanggal Terjadwal -> Shift -> Nama Pasien
  const mapped = patients.map((p) => {
    let targetDate = p.labSchedule?.scheduledDate;
    if (!targetDate || !targetDate.startsWith(nextMonth)) {
      targetDate = getFirstHDDateOfMonth(nextMonth, p.scheduleDay, p.singleDay, p.hdFrequency).dateString;
    }

    const [tY, tM, tD] = targetDate.split('-');
    const dateObj = new Date(parseInt(tY, 10), parseInt(tM, 10) - 1, parseInt(tD, 10));
    const dayOfWeek = dateObj.getDay();
    const dayName = dayNamesIndo[dayOfWeek] || 'Senin';
    const formattedDate = `${String(tD).padStart(2, '0')}/${String(tM).padStart(2, '0')}/${tY}`;

    // Kriteria Cek Hb Pilihan: jika riwayat Hb terakhir/sebelumnya <= 8.9 mg/dL
    const isPilihan = isSelectiveHbCandidate(p);
    let testType = 'Rutin Hb (Evaluasi EPO)';
    if (isPilihan) {
      testType = '⭐ Cek Hb Pilihan (Hb ≤ 8.9)';
    } else if (p.labSchedule?.testType && !p.labSchedule.testType.includes('Pilihan')) {
      testType = p.labSchedule.testType;
    }

    const curVal = p.hbValue > 0 ? p.hbValue : undefined;
    const prevVal = typeof p.prevHbValue === 'number' && p.prevHbValue > 0 ? p.prevHbValue : undefined;
    const lastHb = curVal !== undefined ? curVal.toFixed(1) : (prevVal !== undefined ? prevVal.toFixed(1) : '-');

    const statusSampling = p.labSchedule?.status || 'Terjadwal';
    const resultHb = p.labSchedule?.resultHb ? p.labSchedule.resultHb.toFixed(1) : '';
    const notes = p.labSchedule?.notes || p.clinicalNotes || '';

    return {
      patient: p,
      targetDate,
      formattedDate,
      dayName,
      shift: p.scheduleShift,
      isPilihan,
      testType,
      lastHb,
      statusSampling,
      resultHb,
      notes,
    };
  });

  mapped.sort((a, b) => {
    if (a.targetDate !== b.targetDate) return a.targetDate.localeCompare(b.targetDate);
    if (a.shift !== b.shift) return a.shift.localeCompare(b.shift);
    return a.patient.name.localeCompare(b.patient.name);
  });

  mapped.forEach((item, idx) => {
    const p = item.patient;
    const freqDisplay = p.hdFrequency === '1 kali dalam satu minggu'
      ? (p.singleDay ? `1x/mgg (${p.singleDay})` : '1x/mgg')
      : '2x/mgg';

    rows.push([
      String(idx + 1),
      item.formattedDate,
      item.dayName,
      item.shift.includes('Pagi') ? 'Shift 1 (Pagi)' : 'Shift 2 (Siang)',
      p.scheduleDay,
      p.noRm,
      p.name,
      freqDisplay,
      item.lastHb,
      item.testType,
      p.recommendation.title,
      item.statusSampling,
      item.resultHb,
      item.notes,
    ]);
  });

  return rows;
}

/**
 * Membangun tabel matriks kalender 6 hari sesi HD pertama bulan selanjutnya (MATRIKS_CEK_HB)
 * Menampilkan 6 kolom untuk 6 hari siklus pertama HD bulan depan,
 * dengan pembagian blok SHIFT 1 (PAGI) dan SHIFT 2 (SIANG).
 */
export function buildNextMonthCalendarMatrix(
  patients: PatientRecord[],
  currentYearMonth: string
): string[][] {
  const nextMonth = getNextYearMonth(currentYearMonth);
  const { days } = getMonthDaysInfo(nextMonth);
  const operatingDays = days.filter((d) => d.dayOfWeek !== 0).slice(0, 6);
  const dayNamesIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

  const colHeaders: string[] = operatingDays.map((d) => {
    const dName = dayNamesIndo[d.dayOfWeek] || '';
    const [_, m, dt] = d.dateString.split('-');
    return `${dName}, ${dt}/${m}`;
  });

  const matrixRows: string[][] = [
    colHeaders,
    colHeaders.map(() => '▶ SHIFT 1 (PAGI)')
  ];

  const pagiPatientsPerCol: string[][] = [];
  const siangPatientsPerCol: string[][] = [];

  operatingDays.forEach((d) => {
    const onThisDay = patients.filter((p) => {
      let targetDate = p.labSchedule?.scheduledDate;
      if (!targetDate || !targetDate.startsWith(nextMonth)) {
        targetDate = getFirstHDDateOfMonth(nextMonth, p.scheduleDay, p.singleDay, p.hdFrequency).dateString;
      }
      return targetDate === d.dateString;
    });

    const pagi = onThisDay
      .filter((p) => p.scheduleShift.includes('Pagi'))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p, idx) => `${idx + 1}. ${p.name}`);

    const siang = onThisDay
      .filter((p) => p.scheduleShift.includes('Siang'))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((p, idx) => `${idx + 1}. ${p.name}`);

    pagiPatientsPerCol.push(pagi);
    siangPatientsPerCol.push(siang);
  });

  const maxPagiRows = Math.max(...pagiPatientsPerCol.map((list) => list.length), 1);
  for (let r = 0; r < maxPagiRows; r++) {
    const row: string[] = [];
    for (let c = 0; c < operatingDays.length; c++) {
      row.push(pagiPatientsPerCol[c][r] || '');
    }
    matrixRows.push(row);
  }

  matrixRows.push(colHeaders.map(() => '▶ SHIFT 2 (SIANG)'));

  const maxSiangRows = Math.max(...siangPatientsPerCol.map((list) => list.length), 1);
  for (let r = 0; r < maxSiangRows; r++) {
    const row: string[] = [];
    for (let c = 0; c < operatingDays.length; c++) {
      row.push(siangPatientsPerCol[c][r] || '');
    }
    matrixRows.push(row);
  }

  return matrixRows;
}

/**
 * Kode Google Apps Script Terintegrasi 1 Tahun:
 * 1. Mengelola 3 Tab Jadwal Harian: 'Senin-Kamis', 'Selasa-Jumat', 'Rabu-Sabtu'
 * 2. Mengelola 1 Tab Master Tahunan: 'REKAP_HB_TAHUNAN' (12 Bulan Jan-Des)
 * 3. Otomatis menghubungkan acuan Hb bulan sebelumnya dengan rencana Cek Hb Pilihan (<9.0)
 * 4. Mendukung batch writing super cepat & penginputan langsung di Google Sheets
 */
export const APPS_SCRIPT_SAMPLE_CODE = `/**
 * EPOCARE - Google Apps Script Sinkronisasi Terintegrasi 1 Tahun
 * RS Happy Land Medical Centre Yogyakarta
 */
function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetNames = ["Senin-Kamis", "Selasa-Jumat", "Rabu-Sabtu", "REKAP_HB_TAHUNAN", "JADWAL_CEK_HB", "MATRIKS_CEK_HB"];
  var result = {};
  
  sheetNames.forEach(function(name) {
    var sh = ss.getSheetByName(name);
    if (sh) {
      result[name] = sh.getDataRange().getDisplayValues();
    }
  });

  // Jika tab spesifik belum dibuat, baca juga sheet lain yang ada (seperti Sheet1 / Data Pasien)
  var allSheets = ss.getSheets();
  allSheets.forEach(function(sh) {
    var sName = sh.getName();
    if (!result[sName] && sh.getLastRow() > 0) {
      result[sName] = sh.getDataRange().getDisplayValues();
    }
  });
  
  return ContentService.createTextOutput(JSON.stringify({ status: "success", data: result }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var yearMonth = body.yearMonth || "";
    var monthNum = 0;
    if (yearMonth) {
      var parts = yearMonth.split("-");
      if (parts.length >= 2) monthNum = parseInt(parts[1], 10) || 0;
    }

    // 1. SINKRONISASI TAB JADWAL HARIAN (Senin-Kamis, Selasa-Jumat, Rabu-Sabtu)
    if (body.scheduleData) {
      for (var tabName in body.scheduleData) {
        var rows = body.scheduleData[tabName];
        if (!rows || rows.length === 0) continue;
        
        var sheet = ss.getSheetByName(tabName);
        if (!sheet) {
          sheet = ss.insertSheet(tabName);
        }
        
        sheet.clearContents();
        sheet.clearFormats();
        
        var numRows = rows.length;
        var numCols = rows[0].length;
        var range = sheet.getRange(1, 1, numRows, numCols);
        
        // Kunci format kolom No. RM (3), Frekuensi (4), Shift (5), Hb (6), Alokasi (7) sebagai Plain Text
        sheet.getRange(1, 3, numRows, 5).setNumberFormat("@");
        
        var dateColCount = (numCols - 6) - 8 + 1;
        if (dateColCount > 0) {
          sheet.getRange(1, 8, numRows, dateColCount).setNumberFormat("@");
        }
        
        range.setValues(rows);
        
        // Header Format (Biru Navy #1c4587)
        var headerRange = sheet.getRange(1, 1, 1, numCols);
        headerRange.setBackground("#1c4587")
                   .setFontColor("#ffffff")
                   .setFontWeight("bold")
                   .setHorizontalAlignment("center");
                   
        sheet.setFrozenRows(1);
        sheet.setFrozenColumns(4);
        
        // Atur Lebar Kolom Harian Batch
        sheet.setColumnWidth(1, 45);       // No
        sheet.setColumnWidth(2, 190);      // Nama Pasien
        sheet.setColumnWidth(3, 95);       // No. RM
        sheet.setColumnWidth(4, 140);      // Frekuensi HD
        sheet.setColumnWidth(5, 85);       // Shift
        sheet.setColumnWidth(6, 55);       // Hb
        sheet.setColumnWidth(7, 165);      // Alokasi Klinis / Dosis
        
        if (dateColCount > 0) {
          sheet.setColumnWidths(8, dateColCount, 32);
        }
        
        for (var c = numCols - 5; c <= numCols; c++) {
          sheet.setColumnWidth(c, 80);
        }
        
        // Warna Baris Shift & Ringkasan Batch
        var bgColors = [];
        var fontWeights = [];
        for (var r = 0; r < numRows; r++) {
          var rowBg = [];
          var rowFw = [];
          var valB = rows[r][1] ? rows[r][1].toString() : "";
          
          if (r === 0) {
            for (var c = 0; c < numCols; c++) {
              rowBg.push("#1c4587");
              rowFw.push("bold");
            }
          } else if (valB.indexOf("SHIFT PAGI") !== -1 || valB.indexOf("Total Shift Pagi") !== -1) {
            for (var c = 0; c < numCols; c++) {
              rowBg.push("#cfe2f3");
              rowFw.push("bold");
            }
          } else if (valB.indexOf("SHIFT SIANG") !== -1 || valB.indexOf("Total Shift Siang") !== -1) {
            for (var c = 0; c < numCols; c++) {
              rowBg.push("#fff2cc");
              rowFw.push("bold");
            }
          } else if (valB.indexOf("Total Kebutuhan") !== -1 || valB.indexOf("Kebutuhan Harian") !== -1 || valB.indexOf("Epo Keluar") !== -1) {
            for (var c = 0; c < numCols; c++) {
              rowBg.push("#d9ead3");
              rowFw.push("bold");
            }
          } else {
            for (var c = 0; c < numCols; c++) {
              rowBg.push("#ffffff");
              rowFw.push("normal");
            }
          }
          bgColors.push(rowBg);
          fontWeights.push(rowFw);
        }
        range.setBackgrounds(bgColors);
        range.setFontWeights(fontWeights);
      }
    }

    // 2. SINKRONISASI TAB MASTER TAHUNAN (REKAP_HB_TAHUNAN)
    if (body.yearlyData && body.yearlyData.length > 1) {
      var yearlySheet = ss.getSheetByName("REKAP_HB_TAHUNAN");
      var isNewSheet = false;
      if (!yearlySheet) {
        yearlySheet = ss.insertSheet("REKAP_HB_TAHUNAN", 0);
        isNewSheet = true;
      }

      var incomingRows = body.yearlyData;
      var finalYearlyRows = [];

      if (isNewSheet || yearlySheet.getLastRow() <= 1) {
        finalYearlyRows = incomingRows;
      } else {
        var existingData = yearlySheet.getDataRange().getDisplayValues();
        finalYearlyRows.push(incomingRows[0]); // Header

        var existingMap = {};
        for (var ex = 1; ex < existingData.length; ex++) {
          var rmKey = (existingData[ex][2] || "").toString().trim().toLowerCase();
          if (rmKey) existingMap[rmKey] = existingData[ex];
        }

        var targetMonthColIdx = (monthNum >= 1 && monthNum <= 12) ? (9 + monthNum) : -1;
        var prevMonthColIdx = (monthNum >= 2 && monthNum <= 12) ? (9 + monthNum - 1) : -1;

        for (var inc = 1; inc < incomingRows.length; inc++) {
          var inRow = incomingRows[inc];
          var incRm = (inRow[2] || "").toString().trim().toLowerCase();
          var exRow = existingMap[incRm];

          if (exRow) {
            var merged = exRow.slice();
            while (merged.length < inRow.length) merged.push("");

            merged[0] = inRow[0]; // No
            merged[1] = inRow[1]; // Nama
            merged[3] = inRow[3]; // Jadwal
            merged[4] = inRow[4]; // Shift
            merged[5] = inRow[5]; // Frekuensi

            if (prevMonthColIdx !== -1 && exRow[prevMonthColIdx]) {
              merged[6] = exRow[prevMonthColIdx];
            } else if (inRow[6] && inRow[6] !== "-") {
              merged[6] = inRow[6];
            }

            merged[7] = inRow[7];
            merged[8] = inRow[8];
            merged[9] = inRow[9];

            if (targetMonthColIdx !== -1 && inRow[7] && inRow[7] !== "-") {
              merged[targetMonthColIdx] = inRow[7];
            }

            if (inRow[22]) merged[22] = inRow[22];
            if (inRow[23]) merged[23] = inRow[23];

            finalYearlyRows.push(merged);
            delete existingMap[incRm];
          } else {
            finalYearlyRows.push(inRow);
          }
        }

        for (var remKey in existingMap) {
          finalYearlyRows.push(existingMap[remKey]);
        }
      }

      yearlySheet.clearContents();
      yearlySheet.clearFormats();

      var yRows = finalYearlyRows.length;
      var yCols = finalYearlyRows[0].length;
      var yRange = yearlySheet.getRange(1, 1, yRows, yCols);
      
      // Kunci Plain Text untuk Tab Tahunan agar desimal tidak berubah jadi tanggal
      yRange.setNumberFormat("@");
      yRange.setValues(finalYearlyRows);

      // Format Header Tab Tahunan
      yearlySheet.getRange(1, 1, 1, yCols)
                 .setBackground("#1c4587")
                 .setFontColor("#ffffff")
                 .setFontWeight("bold")
                 .setHorizontalAlignment("center");

      yearlySheet.setFrozenRows(1);
      yearlySheet.setFrozenColumns(3);

      yearlySheet.setColumnWidth(1, 40);   // No
      yearlySheet.setColumnWidth(2, 190);  // Nama Pasien
      yearlySheet.setColumnWidth(3, 95);   // No. RM
      yearlySheet.setColumnWidth(4, 110);  // Jadwal HD
      yearlySheet.setColumnWidth(5, 85);   // Shift
      yearlySheet.setColumnWidth(6, 120);  // Frekuensi HD
      yearlySheet.setColumnWidth(7, 95);   // Hb Acuan Bln Lalu
      yearlySheet.setColumnWidth(8, 95);   // Hb Bln Ini
      yearlySheet.setColumnWidth(9, 180);  // Rencana Cek Hb
      yearlySheet.setColumnWidth(10, 165); // Alokasi Terapi

      yearlySheet.setColumnWidths(11, 12, 55); // 12 Kolom Bulan (Jan-Des)
      yearlySheet.setColumnWidth(23, 130); // DPJP
      yearlySheet.setColumnWidth(24, 220); // Catatan

      // Highlight Warna Otomatis untuk Hb & Rencana Cek Hb
      var yBgs = [];
      var yFws = [];
      var yColors = [];
      for (var yr = 0; yr < yRows; yr++) {
        var rB = [];
        var rF = [];
        var rC = [];
        if (yr === 0) {
          for (var yc = 0; yc < yCols; yc++) {
            rB.push("#1c4587");
            rF.push("bold");
            rC.push("#ffffff");
          }
        } else {
          var rowData = finalYearlyRows[yr];
          var rencanaStr = (rowData[8] || "").toString();

          for (var yc = 0; yc < yCols; yc++) {
            var cellVal = rowData[yc];
            var numVal = parseFloat(String(cellVal).replace(",", "."));

            if (yc === 8 && rencanaStr.indexOf("Cek Hb Pilihan") !== -1) {
              rB.push("#fce8e6");
              rF.push("bold");
              rC.push("#c5221f");
            } else if ((yc === 6 || yc === 7 || (yc >= 10 && yc <= 21)) && !isNaN(numVal) && numVal > 0) {
              if (numVal <= 8.9) {
                rB.push("#fce8e6");
                rF.push("bold");
                rC.push("#c5221f");
              } else if (numVal >= 9.0 && numVal <= 12.0) {
                rB.push("#e6f4ea");
                rF.push("bold");
                rC.push("#137333");
              } else if (numVal > 12.0) {
                rB.push("#fef7e0");
                rF.push("bold");
                rC.push("#b06000");
              } else {
                rB.push("#ffffff");
                rF.push("normal");
                rC.push("#000000");
              }
            } else {
              rB.push(yr % 2 === 0 ? "#f8fafc" : "#ffffff");
              rF.push("normal");
              rC.push("#000000");
            }
          }
        }
        yBgs.push(rB);
        yFws.push(rF);
        yColors.push(rC);
      }
      yRange.setBackgrounds(yBgs);
      yRange.setFontWeights(yFws);
      yRange.setFontColors(yColors);
    }

    // 3. SINKRONISASI TAB PENJADWALAN CEK HB BULAN SELANJUTNYA (JADWAL_CEK_HB)
    if (body.labScheduleData && body.labScheduleData.length > 1) {
      var labSheet = ss.getSheetByName("JADWAL_CEK_HB");
      if (!labSheet) {
        labSheet = ss.insertSheet("JADWAL_CEK_HB");
      }
      var lRows = body.labScheduleData;
      var numLRows = lRows.length;
      var numLCols = lRows[0].length;
      labSheet.clearContents();
      labSheet.clearFormats();

      var lRange = labSheet.getRange(1, 1, numLRows, numLCols);
      lRange.setNumberFormat("@");
      lRange.setValues(lRows);

      // Header Format
      labSheet.getRange(1, 1, 1, numLCols)
              .setBackground("#1c4587")
              .setFontColor("#ffffff")
              .setFontWeight("bold")
              .setHorizontalAlignment("center");

      labSheet.setFrozenRows(1);
      labSheet.setFrozenColumns(4);

      // Lebar kolom tabel Cek Hb
      labSheet.setColumnWidth(1, 45);   // No
      labSheet.setColumnWidth(2, 110);  // Tanggal Terjadwal
      labSheet.setColumnWidth(3, 80);   // Hari
      labSheet.setColumnWidth(4, 95);   // Shift HD
      labSheet.setColumnWidth(5, 115);  // Jadwal Rutin
      labSheet.setColumnWidth(6, 95);   // No. RM
      labSheet.setColumnWidth(7, 210);  // Nama Pasien
      labSheet.setColumnWidth(8, 90);   // Frekuensi HD
      labSheet.setColumnWidth(9, 85);   // Hb Terakhir (g/dL)
      labSheet.setColumnWidth(10, 180); // Kategori Pemeriksaan
      labSheet.setColumnWidth(11, 185); // Rekomendasi Terapi Saat Ini
      labSheet.setColumnWidth(12, 95);  // Status Sampling
      labSheet.setColumnWidth(13, 110); // Hasil Lab Hb Baru (g/dL)
      labSheet.setColumnWidth(14, 190); // Paraf Petugas / Catatan

      var lBgs = [];
      var lFws = [];
      var lColors = [];
      for (var lr = 0; lr < numLRows; lr++) {
        var rB = [];
        var rF = [];
        var rC = [];
        if (lr === 0) {
          for (var lc = 0; lc < numLCols; lc++) {
            rB.push("#1c4587");
            rF.push("bold");
            rC.push("#ffffff");
          }
        } else {
          var rowD = lRows[lr];
          var kat = (rowD[9] || "").toString();
          var shiftVal = (rowD[3] || "").toString();
          var isPilihan = kat.indexOf("Cek Hb Pilihan") !== -1 || kat.indexOf("< 9.0") !== -1;

          for (var lc = 0; lc < numLCols; lc++) {
            if (isPilihan) {
              rB.push("#fce8e6");
              rF.push("bold");
              rC.push(lc === 9 ? "#c5221f" : "#000000");
            } else if (shiftVal.indexOf("Pagi") !== -1) {
              rB.push(lr % 2 === 0 ? "#f0f7ff" : "#ffffff");
              rF.push("normal");
              rC.push("#000000");
            } else {
              rB.push(lr % 2 === 0 ? "#fffcf0" : "#ffffff");
              rF.push("normal");
              rC.push("#000000");
            }
          }
        }
        lBgs.push(rB);
        lFws.push(rF);
        lColors.push(rC);
      }
      lRange.setBackgrounds(lBgs);
      lRange.setFontWeights(lFws);
      lRange.setFontColors(lColors);
    }

    // 4. SINKRONISASI TAB MATRIKS KALENDER 6 HARI (MATRIKS_CEK_HB)
    if (body.labMatrixData && body.labMatrixData.length > 1) {
      var matSheet = ss.getSheetByName("MATRIKS_CEK_HB");
      if (!matSheet) {
        matSheet = ss.insertSheet("MATRIKS_CEK_HB");
      }
      var mRows = body.labMatrixData;
      var numMRows = mRows.length;
      var numMCols = mRows[0].length;
      matSheet.clearContents();
      matSheet.clearFormats();

      // Sanitasi nilai agar karakter '=' atau '+' tidak memicu #ERROR! formula
      for (var mr = 0; mr < numMRows; mr++) {
        for (var mc = 0; mc < numMCols; mc++) {
          var mVal = mRows[mr][mc];
          if (typeof mVal === 'string' && (mVal.charAt(0) === '=' || mVal.charAt(0) === '+')) {
            mRows[mr][mc] = "'" + mVal;
          }
        }
      }

      var mRange = matSheet.getRange(1, 1, numMRows, numMCols);
      mRange.setNumberFormat("@");
      mRange.setValues(mRows);

      // Header tanggal utama (Baris 1)
      matSheet.getRange(1, 1, 1, numMCols)
              .setBackground("#1c4587")
              .setFontColor("#ffffff")
              .setFontWeight("bold")
              .setHorizontalAlignment("center");

      // Beri warna latar dan format tebal pada baris pemisah Shift 1 dan Shift 2
      for (var rIdx = 0; rIdx < numMRows; rIdx++) {
        var rowText = String(mRows[rIdx][0] || '');
        if (rowText.indexOf("SHIFT 1") !== -1) {
          matSheet.getRange(rIdx + 1, 1, 1, numMCols)
                  .setBackground("#e8f0fe")
                  .setFontColor("#1967d2")
                  .setFontWeight("bold")
                  .setHorizontalAlignment("center");
        } else if (rowText.indexOf("SHIFT 2") !== -1) {
          matSheet.getRange(rIdx + 1, 1, 1, numMCols)
                  .setBackground("#fef3c7")
                  .setFontColor("#b45309")
                  .setFontWeight("bold")
                  .setHorizontalAlignment("center");
        }
      }

      matSheet.setFrozenRows(1);
      matSheet.setColumnWidths(1, numMCols, 240);
    }

    return ContentService.createTextOutput(JSON.stringify({ 
      status: "success", 
      message: "Sukses mensinkronisasikan 3 jadwal harian, tab REKAP_HB_TAHUNAN, dan lembar JADWAL_CEK_HB bulan selanjutnya secara otomatis!" 
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

/**
 * Sinkronisasi via Google Apps Script:
 * 1. Membaca 3 tab jadwal ('Senin-Kamis', 'Selasa-Jumat', 'Rabu-Sabtu')
 * 2. Membaca tab master 'REKAP_HB_TAHUNAN' untuk mengekstrak Hb acuan bulan sebelumnya (prevHbValue)
 * 3. Membaca lembar 'JADWAL_CEK_HB' untuk mengekstrak tanggal & status sampling laboratorium
 * 4. Otomatis menjadwalkan 'Cek Hb Pilihan (<9.0)' jika Hb bulan lalu < 9.0 g/dL
 * 5. Mendekode nilai desimal Hb secara cerdas (mencegah bug konversi tanggal ISO)
 * 6. Merekonstruksi status harian (dailyRecords) dan mingguan (weeks)
 */
/**
 * Membersihkan dan memvalidasi Web App URL Google Apps Script:
 * Otomatis mengganti /edit atau /dev menjadi /exec jika pengguna menyalin dari editor skrip
 */
export function sanitizeAppsScriptUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim().replace(/[\r\n\t\s]+/g, '');
  if (url.includes('/edit')) {
    url = url.replace(/\/edit(\?.*)?$/, '/exec');
  } else if (url.includes('/dev')) {
    url = url.replace(/\/dev(\?.*)?$/, '/exec');
  }
  return url;
}

export async function pullViaAppsScript(webAppUrl: string, currentMonth: string): Promise<PatientRecord[]> {
  const cleanUrl = sanitizeAppsScriptUrl(webAppUrl);
  if (!cleanUrl) {
    throw new Error('Web App URL Google Apps Script belum diisi.');
  }

  const separator = cleanUrl.includes('?') ? '&' : '?';
  const fetchUrl = `${cleanUrl}${separator}_t=${Date.now()}`;
  
  let res: Response;
  try {
    res = await fetch(fetchUrl, {
      method: 'GET',
      redirect: 'follow',
    });
  } catch (netErr: any) {
    throw new Error(
      `Gagal terhubung ke Google Apps Script (${netErr.message || 'Network Error'}). ` +
      `Paling sering terjadi karena opsi "Who has access" (Siapa yang memiliki akses) di Apps Script belum diubah ke "Anyone" (Siapa saja), atau URL Web App belum disetel berakhiran /exec.`
    );
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(
      `Gagal menghubungi Apps Script (HTTP ${res.status}): ${errorText.substring(0, 150) || 'Akses ditolak'}. ` +
      `Pastikan pada menu Deployment di Apps Script disetel "Execute as: Me" dan "Who has access: Anyone".`
    );
  }
  const json = await res.json();
  const allPatients: PatientRecord[] = [];
  const tabData = json.data || {};

  // Ekstraksi data dari tab REKAP_HB_TAHUNAN jika ada
  const yearlyRows: string[][] = tabData['REKAP_HB_TAHUNAN'] || [];
  const yearlyMap = new Map<string, { prevHb?: number; currentHb?: number; doctor?: string; notes?: string }>();

  const [_, curMonthPart] = currentMonth.split('-');
  const monthNum = parseInt(curMonthPart, 10) || (new Date().getMonth() + 1);
  const targetColIdx = 9 + monthNum; // Kolom bulan berjalan (Jan=10, Feb=11, ... Des=21)
  const prevColIdx = monthNum >= 2 ? (9 + monthNum - 1) : -1;

  if (yearlyRows.length > 1) {
    yearlyRows.slice(1).forEach((yRow) => {
      const rm = (yRow[2] || '').trim().toLowerCase();
      if (!rm || isSummaryOrHeaderRow(yRow[1], rm)) return;

      let prevHb: number | undefined = undefined;
      if (prevColIdx !== -1 && yRow[prevColIdx]) {
        const decoded = decodeHbFromValue(yRow[prevColIdx]);
        if (decoded > 0) prevHb = decoded;
      }
      if (prevHb === undefined && yRow[6]) {
        const decoded = decodeHbFromValue(yRow[6]);
        if (decoded > 0) prevHb = decoded;
      }

      let currentHb: number | undefined = undefined;
      if (targetColIdx !== -1 && yRow[targetColIdx]) {
        const decoded = decodeHbFromValue(yRow[targetColIdx]);
        if (decoded > 0) currentHb = decoded;
      }
      if (currentHb === undefined && yRow[7]) {
        const decoded = decodeHbFromValue(yRow[7]);
        if (decoded > 0) currentHb = decoded;
      }

      yearlyMap.set(rm, {
        prevHb,
        currentHb,
        doctor: yRow[22] || undefined,
        notes: yRow[23] || undefined,
      });
    });
  }

  // Ekstraksi data dari tab JADWAL_CEK_HB jika ada
  const labRows: string[][] = tabData['JADWAL_CEK_HB'] || [];
  const labMap = new Map<string, { scheduledDate?: string; testType?: string; status?: string; resultHb?: number; notes?: string }>();

  if (labRows.length > 1) {
    labRows.slice(1).forEach((lRow) => {
      const rm = (lRow[5] || '').trim().toLowerCase(); // Col 5 = No. RM
      if (!rm || isSummaryOrHeaderRow(lRow[6], rm)) return;

      let rawDate = (lRow[1] || '').trim(); // Col 1 = Tanggal Terjadwal (misal: "01/10/2026" atau "2026-10-01")
      let isoDate: string | undefined = undefined;
      if (rawDate) {
        if (rawDate.includes('/')) {
          const [d, m, y] = rawDate.split('/');
          if (d && m && y) isoDate = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
        } else if (rawDate.match(/^\d{4}-\d{2}-\d{2}/)) {
          isoDate = rawDate.substring(0, 10);
        }
      }

      const testTypeRaw = (lRow[9] || '').trim();
      const statusRaw = (lRow[11] || '').trim();
      const newHbRaw = (lRow[12] || '').trim();
      const notesRaw = (lRow[13] || '').trim();

      let resultHb: number | undefined = undefined;
      if (newHbRaw) {
        const decodedNew = decodeHbFromValue(newHbRaw);
        if (decodedNew > 0) resultHb = decodedNew;
      }

      labMap.set(rm, {
        scheduledDate: isoDate,
        testType: testTypeRaw || undefined,
        status: statusRaw || undefined,
        resultHb,
        notes: notesRaw || undefined,
      });
    });
  }

  const { daysInMonth } = getMonthDaysInfo(currentMonth);

  SCHEDULE_SHEETS.forEach(({ title, tabName }) => {
    const rows: string[][] = tabData[tabName] || [];
    if (rows.length <= 1) return;

    const dataRows = rows.slice(1);
    dataRows.forEach((row, i) => {
      const name = (row[1] || '').trim();
      const noRm = (row[2] || '').trim();

      if (!name || isSummaryOrHeaderRow(name, noRm, row.join(' '))) {
        return;
      }

      const col3 = (row[3] || '').trim();
      const col3Lower = col3.toLowerCase();
      let hdFrequency: HDFrequency = '2 kali dalam satu minggu';
      let singleDay: SingleHDDay | undefined = undefined;
      let scheduleDay: HDDaySchedule = title;
      let scheduleShift: HDShift = 'Shift 1 (Pagi)';
      let rawHb = 0;
      let doseTextHint = (row[6] || '').trim();

      if (col3Lower.includes('pagi') || col3Lower.includes('siang')) {
        // Format Lama (tanpa kolom Frekuensi HD)
        scheduleShift = col3Lower.includes('siang') ? 'Shift 2 (Siang)' : 'Shift 1 (Pagi)';
        doseTextHint = (row[5] || '').trim();
        rawHb = decodeHbFromValue(row[4], doseTextHint);
      } else {
        // Format Baru (dengan kolom Frekuensi HD)
        hdFrequency = col3Lower.includes('1') ? '1 kali dalam satu minggu' : '2 kali dalam satu minggu';
        if (col3Lower.includes('senin')) singleDay = 'Senin';
        else if (col3Lower.includes('selasa')) singleDay = 'Selasa';
        else if (col3Lower.includes('rabu')) singleDay = 'Rabu';
        else if (col3Lower.includes('kamis')) singleDay = 'Kamis';
        else if (col3Lower.includes('jumat')) singleDay = 'Jumat';
        else if (col3Lower.includes('sabtu')) singleDay = 'Sabtu';

        if (hdFrequency === '1 kali dalam satu minggu' && singleDay) {
          scheduleDay = getScheduleDayFromSingleDay(singleDay);
        }

        const shiftStr = (row[4] || '').toLowerCase();
        scheduleShift = shiftStr.includes('siang') ? 'Shift 2 (Siang)' : 'Shift 1 (Pagi)';
        rawHb = decodeHbFromValue(row[5], doseTextHint);
      }

      const rmLookupKey = noRm.toLowerCase().trim();
      const yearlyInfo = yearlyMap.get(rmLookupKey);
      const labInfo = labMap.get(rmLookupKey);

      // Jika Hb di tab jadwal kosong atau 0 tapi diisi di REKAP_HB_TAHUNAN atau JADWAL_CEK_HB
      if (rawHb <= 0 && yearlyInfo?.currentHb && yearlyInfo.currentHb > 0) {
        rawHb = yearlyInfo.currentHb;
      }
      if (rawHb <= 0 && labInfo?.resultHb && labInfo.resultHb > 0) {
        rawHb = labInfo.resultHb;
      }

      const hbValue = isNaN(rawHb) || rawHb < 0 ? 0 : rawHb;
      const reco = calculateClinicalRecommendation(hbValue);

      // Rekonstruksi status harian dan mingguan dari matriks tanggal
      const { dailyRecords, weeks } = parseDailyRecordsFromRow(row, daysInMonth, reco.category, scheduleDay, currentMonth);

      const statusColIndex = row.length - 2;
      const overallStatusRaw = (row[statusColIndex] || '').trim();
      let overallStatus: PatientRecord['overallStatus'] = 'Berjalan';
      if (overallStatusRaw.includes('Selesai')) overallStatus = 'Selesai';
      else if (overallStatusRaw.includes('Perhatian') || reco.category === 'TRANSFUSI_2_RAWAT_INAP') overallStatus = 'Perlu Perhatian';

      const cleanNoRm = noRm ? noRm.replace(/[^a-zA-Z0-9_-]/g, '') : `RM${1000 + i}`;
      // ID deterministik stabil untuk menjaga kesinambungan state komponen React
      const stablePatientId = `pat-${cleanNoRm.toLowerCase()}`;

      const prevHbValue = yearlyInfo?.prevHb;
      const isSelective = (typeof prevHbValue === 'number' && prevHbValue > 0 && Number(prevHbValue.toFixed(1)) <= 8.9) ||
        (hbValue > 0 && Number(hbValue.toFixed(1)) <= 8.9);

      const firstHDDate = getFirstHDDateOfMonth(currentMonth, scheduleDay, singleDay, hdFrequency).dateString;

      allPatients.push({
        id: stablePatientId,
        noRm: noRm || `RM-${1000 + i}`,
        name,
        hdFrequency,
        singleDay,
        scheduleDay,
        scheduleShift,
        hbValue,
        hbDate: `${currentMonth}-02`,
        prevHbValue,
        isSelectiveHb: isSelective,
        labSchedule: {
          scheduledDate: labInfo?.scheduledDate || firstHDDate,
          testType: (labInfo?.testType as any) || (isSelective ? 'Cek Hb Pilihan (Hb ≤ 8.9)' : 'Rutin Hb (Evaluasi EPO)'),
          status: labInfo?.status?.includes('Selesai') ? 'Selesai' : (hbValue > 0 ? 'Selesai' : 'Terjadwal'),
          resultHb: labInfo?.resultHb,
          isSelectiveHb: isSelective,
          selectiveReason: isSelective ? `Nilai Hb sebelumnya ${prevHbValue ? prevHbValue.toFixed(1) : '≤ 8.9'} g/dL (≤ 8.9 g/dL)` : undefined,
          notes: labInfo?.notes,
        },
        monthPeriod: currentMonth,
        recommendation: reco,
        weeks,
        dailyRecords,
        overallStatus,
        clinicalNotes: labInfo?.notes || yearlyInfo?.notes || row[row.length - 1] || '',
        doctorInCharge: yearlyInfo?.doctor || 'dr. Sp.PD-KGH',
        updatedAt: new Date().toISOString(),
      });
    });
  });

  // FALLBACK 1: Jika 3 sheet jadwal kosong tapi REKAP_HB_TAHUNAN memiliki baris pasien
  if (allPatients.length === 0 && yearlyRows.length > 1) {
    yearlyRows.slice(1).forEach((yRow, i) => {
      const name = (yRow[1] || '').trim();
      const noRm = (yRow[2] || '').trim();
      if (!name || isSummaryOrHeaderRow(name, noRm)) return;

      const scheduleRaw = (yRow[3] || '').trim();
      let scheduleDay: HDDaySchedule = 'Senin - Kamis';
      if (scheduleRaw.includes('Selasa') || scheduleRaw.includes('Jumat')) scheduleDay = 'Selasa - Jumat';
      else if (scheduleRaw.includes('Rabu') || scheduleRaw.includes('Sabtu')) scheduleDay = 'Rabu - Sabtu';

      const shiftRaw = (yRow[4] || '').toLowerCase();
      const scheduleShift: HDShift = shiftRaw.includes('siang') ? 'Shift 2 (Siang)' : 'Shift 1 (Pagi)';

      const freqRaw = (yRow[5] || '').toLowerCase();
      let hdFrequency: HDFrequency = '2 kali dalam satu minggu';
      let singleDay: SingleHDDay | undefined = undefined;
      if (freqRaw.includes('2 minggu') || freqRaw.includes('1/2')) {
        hdFrequency = '1 kali / 2 minggu';
      } else if (freqRaw.includes('1')) {
        hdFrequency = '1 kali dalam satu minggu';
      }
      if (freqRaw.includes('senin')) singleDay = 'Senin';
      else if (freqRaw.includes('selasa')) singleDay = 'Selasa';
      else if (freqRaw.includes('rabu')) singleDay = 'Rabu';
      else if (freqRaw.includes('kamis')) singleDay = 'Kamis';
      else if (freqRaw.includes('jumat')) singleDay = 'Jumat';
      else if (freqRaw.includes('sabtu')) singleDay = 'Sabtu';

      const rmLookupKey = noRm.toLowerCase().trim();
      const yInfo = yearlyMap.get(rmLookupKey);
      const curHb = yInfo?.currentHb || decodeHbFromValue(yRow[7]) || 0;
      const prevHb = yInfo?.prevHb || decodeHbFromValue(yRow[6]) || undefined;

      const reco = calculateClinicalRecommendation(curHb, hdFrequency);
      const weeks = generateDefaultWeeks(reco.category, currentMonth, hdFrequency);
      const cleanNoRm = noRm ? noRm.replace(/[^a-zA-Z0-9_-]/g, '') : `RM${1000 + i}`;

      allPatients.push({
        id: `pat-${cleanNoRm.toLowerCase()}`,
        noRm: noRm || `RM-${1000 + i}`,
        name,
        hdFrequency,
        singleDay,
        scheduleDay,
        scheduleShift,
        hbValue: curHb,
        hbDate: `${currentMonth}-02`,
        prevHbValue: prevHb,
        isSelectiveHb: (typeof prevHb === 'number' && prevHb > 0 && Number(prevHb.toFixed(1)) <= 8.9) || (curHb > 0 && Number(curHb.toFixed(1)) <= 8.9),
        monthPeriod: currentMonth,
        recommendation: reco,
        weeks,
        overallStatus: curHb === 0 ? 'Menunggu' : 'Berjalan',
        clinicalNotes: yInfo?.notes || yRow[23] || '',
        doctorInCharge: yInfo?.doctor || yRow[22] || 'dr. Sp.PD-KGH',
        updatedAt: new Date().toISOString(),
      });
    });
  }

  // FALLBACK 2: Jika masih kosong, cek apakah ada sheet generik (seperti Sheet1) dengan data
  if (allPatients.length === 0) {
    for (const [key, rawRows] of Object.entries(tabData)) {
      if (key === 'MATRIKS_CEK_HB') continue;
      const rows = rawRows as string[][];
      if (!Array.isArray(rows) || rows.length <= 1) continue;

      rows.slice(1).forEach((row, i) => {
        const p1 = (row[1] || row[0] || '').trim();
        const p2 = (row[2] || row[1] || '').trim();
        if (!p1 || isSummaryOrHeaderRow(p1, p2)) return;

        let name = p1;
        let noRm = p2;
        let hbValue = 0;
        for (let c = 2; c < row.length; c++) {
          const val = decodeHbFromValue(row[c]);
          if (val > 0 && val < 25) {
            hbValue = val;
            break;
          }
        }

        const cleanNoRm = noRm ? noRm.replace(/[^a-zA-Z0-9_-]/g, '') : `RM${2000 + i}`;
        const reco = calculateClinicalRecommendation(hbValue);
        allPatients.push({
          id: `pat-gen-${cleanNoRm.toLowerCase()}-${i}`,
          noRm: noRm || `RM-${2000 + i}`,
          name,
          scheduleDay: 'Senin - Kamis',
          scheduleShift: 'Shift 1 (Pagi)',
          hbValue,
          hbDate: `${currentMonth}-02`,
          monthPeriod: currentMonth,
          recommendation: reco,
          weeks: generateDefaultWeeks(reco.category, currentMonth),
          overallStatus: hbValue > 0 ? 'Berjalan' : 'Menunggu',
          updatedAt: new Date().toISOString(),
        });
      });

      if (allPatients.length > 0) break;
    }
  }

  return allPatients;
}

export async function pushViaAppsScript(
  webAppUrl: string,
  patients: PatientRecord[],
  yearMonth: string = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  targetSchedule?: HDDaySchedule
) {
  const cleanUrl = sanitizeAppsScriptUrl(webAppUrl);
  if (!cleanUrl) {
    throw new Error('Web App URL Google Apps Script belum diisi.');
  }

  const scheduleData: Record<string, string[][]> = {};

  const sheetsToPush = targetSchedule 
    ? SCHEDULE_SHEETS.filter((s) => s.title === targetSchedule)
    : SCHEDULE_SHEETS;

  sheetsToPush.forEach(({ title, tabName }) => {
    scheduleData[tabName] = buildScheduleMatrixTable(patients, title, yearMonth);
  });

  // Bangun tabel terintegrasi tahunan (12 bulan + acuan Hb sebelumnya)
  const yearlyData = buildYearlySummaryTable(patients, yearMonth);

  // Bangun tabel penjadwalan Cek Hb bulan selanjutnya & matriks 6 hari sesi HD pertama
  const labScheduleData = buildNextMonthLabScheduleTable(patients, yearMonth);
  const labMatrixData = buildNextMonthCalendarMatrix(patients, yearMonth);

  try {
    await fetch(cleanUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'push',
        yearMonth,
        scheduleData,
        yearlyData,
        labScheduleData,
        labMatrixData,
      }),
    });
  } catch (err: any) {
    throw new Error(
      `Gagal mengirim data ke Apps Script (${err.message || 'Network Error'}). Pastikan koneksi aktif dan Web App URL valid.`
    );
  }

  return { success: true };
}

/**
 * Ekspor Data ke Format CSV per Jadwal atau Seluruh Jadwal
 */
export function exportToCSV(patients: PatientRecord[], period: string, selectedSchedule?: HDDaySchedule) {
  const schedulesToExport: HDDaySchedule[] = selectedSchedule 
    ? [selectedSchedule] 
    : ['Senin - Kamis', 'Selasa - Jumat', 'Rabu - Sabtu'];

  schedulesToExport.forEach((sched) => {
    const tableData = buildScheduleMatrixTable(patients, sched, period);
    const csvContent = '\uFEFF' + tableData.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Jadwal_HD_${sched.replace(/\s+/g, '_')}_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}

/**
 * Impor data dari File CSV
 */
export function importFromCSV(csvText: string, currentMonth: string): PatientRecord[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length <= 1) return [];

  const splitCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const dataLines = lines.slice(1);
  const patients: PatientRecord[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const parts = splitCsvLine(dataLines[i]);
    const name = parts[1] || '';
    const noRm = parts[2] || '';
    if (!name || isSummaryOrHeaderRow(name, noRm, dataLines[i])) {
      continue;
    }

    const col3 = (parts[3] || '').trim();
    const col3Lower = col3.toLowerCase();
    let hdFrequency: HDFrequency = '2 kali dalam satu minggu';
    let singleDay: SingleHDDay | undefined = undefined;
    let scheduleDay: HDDaySchedule = 'Senin - Kamis';
    let scheduleShift: HDShift = 'Shift 1 (Pagi)';
    let rawHb = 0;

    if (col3Lower.includes('pagi') || col3Lower.includes('siang')) {
      // Format CSV lama tanpa kolom Frekuensi HD
      scheduleShift = col3Lower.includes('siang') ? 'Shift 2 (Siang)' : 'Shift 1 (Pagi)';
      rawHb = parseFloat(parts[4]?.replace(',', '.') || '0');
    } else {
      // Format CSV baru dengan kolom Frekuensi HD
      hdFrequency = col3Lower.includes('1') ? '1 kali dalam satu minggu' : '2 kali dalam satu minggu';
      if (col3Lower.includes('senin')) singleDay = 'Senin';
      else if (col3Lower.includes('selasa')) singleDay = 'Selasa';
      else if (col3Lower.includes('rabu')) singleDay = 'Rabu';
      else if (col3Lower.includes('kamis')) singleDay = 'Kamis';
      else if (col3Lower.includes('jumat')) singleDay = 'Jumat';
      else if (col3Lower.includes('sabtu')) singleDay = 'Sabtu';

      if (hdFrequency === '1 kali dalam satu minggu' && singleDay) {
        scheduleDay = getScheduleDayFromSingleDay(singleDay);
      }

      const shiftStr = (parts[4] || '').toLowerCase();
      scheduleShift = shiftStr.includes('siang') ? 'Shift 2 (Siang)' : 'Shift 1 (Pagi)';
      rawHb = parseFloat(parts[5]?.replace(',', '.') || '0');
    }

    const hbValue = isNaN(rawHb) || rawHb < 0 ? 0 : rawHb;
    const reco = calculateClinicalRecommendation(hbValue);

    const cleanNoRm = noRm ? noRm.replace(/[^a-zA-Z0-9_-]/g, '') : `RM${1000 + i}`;
    const uniqueSuffix = `${Date.now()}-${i}-${Math.random().toString(36).substring(2, 7)}`;

    patients.push({
      id: `csv-${cleanNoRm}-${uniqueSuffix}`,
      noRm: noRm || `RM-${1000 + i}`,
      name,
      hdFrequency,
      singleDay,
      scheduleDay,
      scheduleShift,
      hbDate: `${currentMonth}-02`,
      hbValue,
      monthPeriod: currentMonth,
      recommendation: reco,
      weeks: generateDefaultWeeks(reco.category, currentMonth),
      overallStatus: reco.category === 'TRANSFUSI_2_RAWAT_INAP' ? 'Perlu Perhatian' : 'Berjalan',
      clinicalNotes: parts[parts.length - 1] || '',
      updatedAt: new Date().toISOString(),
    });
  }

  return patients;
}

/**
 * Update data range pada spreadsheet
 */
async function updateSheetValues(
  spreadsheetId: string,
  range: string,
  values: string[][],
  accessToken: string
) {
  // Lindungi karakter formula pada teks agar Google Sheets tidak menghasilkan #ERROR!
  const sanitized = values.map((r) =>
    r.map((c) => {
      if (typeof c === 'string' && (c.startsWith('=') || c.startsWith('+'))) {
        return `'${c}`;
      }
      return c;
    })
  );
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      range,
      majorDimension: 'ROWS',
      values: sanitized,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gagal menulis ke Google Sheet: ${errorText}`);
  }

  return await res.json();
}

/**
 * Menambahkan tab sheet baru jika belum ada
 */
async function addSheetTab(spreadsheetId: string, tabTitle: string, accessToken: string) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`;
  await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        {
          addSheet: {
            properties: {
              title: tabTitle,
              gridProperties: {
                frozenRowCount: 1,
                frozenColumnCount: 5,
              },
            },
          },
        },
      ],
    }),
  });
}

/**
 * Menerapkan warna latar header biru tua #1c4587 dan UKURAN KOLOM MINIMALIS
 */
async function applyHeaderAndColumnStyling(spreadsheetId: string, accessToken: string) {
  const metadata = await getSpreadsheetDetails(spreadsheetId, accessToken);
  const sheets: any[] = metadata.sheets || [];

  const requests: any[] = [];

  sheets.forEach((s) => {
    const sheetId = s.properties.sheetId;

    // 1. Format Header Row 1 (Biru Tua #1c4587)
    requests.push({
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.11, green: 0.27, blue: 0.53 }, // #1c4587
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
            horizontalAlignment: 'CENTER',
          },
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
      },
    });

    // 2. ATUR UKURAN KOLOM MENYESUAIKAN PANJANG KALIMAT/KATA PADA CELL (AUTO-FIT):
    requests.push({
      autoResizeDimensions: {
        dimensions: {
          sheetId,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: 44,
        },
      },
    });
  });

  if (requests.length > 0) {
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ requests }),
    });
  }
}

function getColLetter(colIdx: number): string {
  let letter = '';
  while (colIdx > 0) {
    const mod = (colIdx - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    colIdx = Math.floor((colIdx - mod) / 26);
  }
  return letter || 'A';
}
