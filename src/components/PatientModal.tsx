import React, { useState, useEffect } from 'react';
import { 
  X, 
  User, 
  Activity, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle,
  Droplets,
  Syringe,
  Info,
  Repeat,
  FlaskConical,
  Sparkles
} from 'lucide-react';
import { PatientRecord, HDDaySchedule, HDShift, HDFrequency, SingleHDDay, LabSchedule, LabTestType, LabScheduleStatus } from '../types/dialysis';
import { calculateClinicalRecommendation, generateDefaultWeeks } from '../services/clinicalRules';
import { getScheduleDayFromSingleDay, getFirstHDDateOfMonth, getSingleDayFromDate } from '../services/googleSheets';

interface PatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (patientData: Partial<PatientRecord>) => void;
  initialPatient?: PatientRecord | null;
  currentMonth: string;
}

export const PatientModal: React.FC<PatientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPatient,
  currentMonth,
}) => {
  const [noRm, setNoRm] = useState('');
  const [name, setName] = useState('');
  const [age, setAge] = useState<string>('');
  const [gender, setGender] = useState<'L' | 'P'>('L');
  const [hdFrequency, setHdFrequency] = useState<HDFrequency>('2 kali dalam satu minggu');
  const [singleDay, setSingleDay] = useState<SingleHDDay>('Senin');
  const [lastHdDate, setLastHdDate] = useState<string>('');
  const [scheduleDay, setScheduleDay] = useState<HDDaySchedule>('Senin - Kamis');
  const [scheduleShift, setScheduleShift] = useState<HDShift>('Shift 1 (Pagi)');
  const [hbValue, setHbValue] = useState<string>('0');
  const [hbDate, setHbDate] = useState<string>('');
  const [prevHbValue, setPrevHbValue] = useState<string>('');
  const [isSelectiveHb, setIsSelectiveHb] = useState<boolean>(false);
  
  // State Jadwal Cek Lab Manual
  const [labScheduledDate, setLabScheduledDate] = useState<string>('');
  const [labTestType, setLabTestType] = useState<LabTestType>('Rutin Hb (Evaluasi EPO)');
  const [labStatus, setLabStatus] = useState<LabScheduleStatus>('Terjadwal');
  const [labNotes, setLabNotes] = useState<string>('');

  const [clinicalNotes, setClinicalNotes] = useState<string>('');
  const [doctorInCharge, setDoctorInCharge] = useState<string>('dr. Sp.PD-KGH');

  useEffect(() => {
    if (initialPatient) {
      setNoRm(initialPatient.noRm);
      setName(initialPatient.name);
      setAge(initialPatient.age ? String(initialPatient.age) : '');
      setGender(initialPatient.gender || 'L');
      setHdFrequency(initialPatient.hdFrequency || '2 kali dalam satu minggu');
      const detectedSingleDay = initialPatient.singleDay || (
        initialPatient.scheduleDay === 'Selasa - Jumat' ? 'Selasa' :
        initialPatient.scheduleDay === 'Rabu - Sabtu' ? 'Rabu' : 'Senin'
      );
      setSingleDay(detectedSingleDay);
      setLastHdDate(initialPatient.lastHdDate || '');
      setScheduleDay(initialPatient.scheduleDay);
      setScheduleShift(initialPatient.scheduleShift);
      setHbValue(String(initialPatient.hbValue));
      setHbDate(initialPatient.hbDate);
      setPrevHbValue(initialPatient.prevHbValue !== undefined ? String(initialPatient.prevHbValue) : '');
      setIsSelectiveHb(Boolean(initialPatient.isSelectiveHb));

      // Load Jadwal Cek Lab Manual
      if (initialPatient.labSchedule) {
        setLabScheduledDate(initialPatient.labSchedule.scheduledDate);
        setLabTestType(initialPatient.labSchedule.testType);
        setLabStatus(initialPatient.labSchedule.status);
        setLabNotes(initialPatient.labSchedule.notes || '');
      } else {
        const isCandidate = (initialPatient.prevHbValue !== undefined && initialPatient.prevHbValue < 9.0) || 
                            (initialPatient.hbValue > 0 && initialPatient.hbValue < 9.0);
        setLabScheduledDate(initialPatient.hbDate || '');
        setLabTestType(isCandidate ? 'Cek Hb Pilihan (Hb < 9.0)' : 'Rutin Hb (Evaluasi EPO)');
        setLabStatus(initialPatient.hbValue > 0 ? 'Selesai' : 'Terjadwal');
        setLabNotes(isCandidate ? '⭐ Cek Hb Pilihan: Riwayat Hb < 9.0 g/dL' : '');
      }

      setClinicalNotes(initialPatient.clinicalNotes || '');
      setDoctorInCharge(initialPatient.doctorInCharge || 'dr. Sp.PD-KGH');
    } else {
      // Form baru
      setNoRm(`RM-${Math.floor(10000 + Math.random() * 90000)}`);
      setName('');
      setAge('');
      setGender('L');
      setHdFrequency('2 kali dalam satu minggu');
      setSingleDay('Senin');
      setLastHdDate('');
      setScheduleDay('Senin - Kamis');
      setScheduleShift('Shift 1 (Pagi)');
      setHbValue('0');
      setPrevHbValue('');
      setIsSelectiveHb(false);
      const defaultInitialDate = getFirstHDDateOfMonth(currentMonth, 'Senin - Kamis').dateString;
      setHbDate(defaultInitialDate);
      setLabScheduledDate(defaultInitialDate);
      setLabTestType('Rutin Hb (Evaluasi EPO)');
      setLabStatus('Terjadwal');
      setLabNotes('');
      setClinicalNotes('');
      setDoctorInCharge('dr. Sp.PD-KGH');
    }
  }, [initialPatient, currentMonth, isOpen]);

  if (!isOpen) return null;

  const parsedHb = parseFloat(hbValue.replace(',', '.'));
  const validHb = isNaN(parsedHb) || parsedHb <= 0 ? 0 : parsedHb;
  const recommendation = calculateClinicalRecommendation(validHb, hdFrequency);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !noRm.trim()) {
      alert('Mohon isi No. RM dan Nama Pasien.');
      return;
    }

    const reco = calculateClinicalRecommendation(validHb, hdFrequency);
    const isCategoryChanged = initialPatient ? initialPatient.recommendation?.category !== reco.category : false;
    const weeks = (initialPatient && !isCategoryChanged)
      ? initialPatient.weeks 
      : generateDefaultWeeks(reco.category, currentMonth, hdFrequency);

    const isSingleOrBiweekly = hdFrequency === '1 kali dalam satu minggu' || hdFrequency === '1 kali / 2 minggu';
    const finalScheduleDay = isSingleOrBiweekly 
      ? getScheduleDayFromSingleDay(singleDay) 
      : scheduleDay;

    const defaultHbDate = getFirstHDDateOfMonth(
      currentMonth, 
      finalScheduleDay, 
      isSingleOrBiweekly ? singleDay : undefined, 
      hdFrequency,
      lastHdDate
    ).dateString;

    const parsedPrev = prevHbValue ? parseFloat(prevHbValue.replace(',', '.')) : undefined;
    const validPrev = parsedPrev !== undefined && !isNaN(parsedPrev) && parsedPrev > 0 ? parsedPrev : undefined;
    const isSelective = (validPrev !== undefined && Number(validPrev.toFixed(1)) <= 8.9) ||
      (validPrev === undefined && validHb > 0 && Number(validHb.toFixed(1)) <= 8.9) ||
      (isSelectiveHb && (validPrev === undefined || Number(validPrev.toFixed(1)) <= 8.9));

    const finalLabScheduledDate = labScheduledDate || hbDate || defaultHbDate;
    const finalLabSchedule: LabSchedule = {
      scheduledDate: finalLabScheduledDate,
      testType: isSelective ? 'Cek Hb Pilihan (Hb ≤ 8.9)' : (labTestType.includes('Pilihan') ? 'Rutin Hb (Evaluasi EPO)' : labTestType),
      status: labStatus,
      notes: labNotes.trim(),
      resultHb: validHb > 0 ? validHb : undefined,
      isSelectiveHb: isSelective,
      selectiveReason: isSelective ? `Nilai Hb acuan ${validPrev ? validPrev.toFixed(1) : '≤ 8.9'} mg/dL (≤ 8.9 mg/dL)` : undefined,
    };

    onSave({
      noRm: noRm.trim(),
      name: name.trim(),
      age: age ? parseInt(age, 10) : undefined,
      gender,
      hdFrequency,
      singleDay: isSingleOrBiweekly ? singleDay : undefined,
      lastHdDate: hdFrequency === '1 kali / 2 minggu' ? (lastHdDate || defaultHbDate) : undefined,
      scheduleDay: finalScheduleDay,
      scheduleShift,
      hbValue: validHb,
      hbDate: finalLabScheduledDate,
      prevHbValue: validPrev,
      isSelectiveHb: isSelective,
      labSchedule: finalLabSchedule,
      monthPeriod: currentMonth,
      recommendation: reco,
      weeks,
      clinicalNotes: clinicalNotes.trim(),
      doctorInCharge: doctorInCharge.trim(),
      overallStatus: validHb === 0 ? 'Menunggu' : reco.category === 'TRANSFUSI_2_RAWAT_INAP' ? 'Perlu Perhatian' : 'Berjalan',
      updatedAt: new Date().toISOString(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Modal Header (Pinned) */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-rose-700 text-white flex items-center justify-center font-bold shrink-0">
              <User className="w-4 h-4 text-rose-100" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                {initialPatient ? 'Ubah Data Pasien HD' : 'Tambah Pasien Hemodialisa'}
              </h3>
              <p className="text-[11px] text-slate-500">
                Alokasi otomatis dosis terapi berbasis hasil Hb awal bulan
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          
          {/* Scrollable Body (Compact & Minimalist) */}
          <div className="p-3 space-y-2 text-xs overflow-y-auto flex-1">
            
            {/* Identitas Pasien: No. RM & Nama */}
            <div className="grid grid-cols-3 gap-1.5">
              <div>
                <label className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                  No. RM *
                </label>
                <input
                  type="text"
                  required
                  value={noRm}
                  onChange={(e) => setNoRm(e.target.value)}
                  placeholder="RM-04821"
                  className="w-full px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-mono font-semibold focus:ring-1 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-[10px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                  Nama Pasien *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nama pasien..."
                  className="w-full px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:ring-1 focus:ring-rose-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* Usia, JK, Shift & DPJP */}
            <div className="grid grid-cols-4 gap-1.5">
              <div>
                <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                  Usia
                </label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="54"
                  className="w-full px-1.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                  Gender
                </label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value as 'L' | 'P')}
                  className="w-full px-1 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:outline-hidden"
                >
                  <option value="L">L</option>
                  <option value="P">P</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                  Shift
                </label>
                <select
                  value={scheduleShift}
                  onChange={(e) => setScheduleShift(e.target.value as HDShift)}
                  className="w-full px-1 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-[11px] focus:outline-hidden"
                >
                  <option value="Shift 1 (Pagi)">Pagi</option>
                  <option value="Shift 2 (Siang)">Siang</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-0.5 truncate">
                  DPJP
                </label>
                <input
                  type="text"
                  value={doctorInCharge}
                  onChange={(e) => setDoctorInCharge(e.target.value)}
                  placeholder="dr. Sp.PD"
                  className="w-full px-1.5 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-[11px] focus:outline-hidden"
                />
              </div>
            </div>

            {/* Frekuensi & Hari Rutin HD */}
            <div className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  <Repeat className="w-3 h-3 text-rose-600" />
                  <span>Frekuensi HD:</span>
                </span>
                
                {/* Segmented control for frequency: 2x/minggu, 1x/minggu, 1x/2 minggu */}
                <div className="flex bg-slate-200 dark:bg-slate-700 p-0.5 rounded-md text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => {
                      setHdFrequency('2 kali dalam satu minggu');
                      if (!initialPatient) {
                        setHbDate(getFirstHDDateOfMonth(currentMonth, scheduleDay, undefined, '2 kali dalam satu minggu').dateString);
                      }
                    }}
                    className={`px-2 py-0.5 rounded transition cursor-pointer ${
                      hdFrequency === '2 kali dalam satu minggu'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    2x / Minggu
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHdFrequency('1 kali dalam satu minggu');
                      if (!initialPatient) {
                        const sDay = getScheduleDayFromSingleDay(singleDay);
                        setHbDate(getFirstHDDateOfMonth(currentMonth, sDay, singleDay, '1 kali dalam satu minggu').dateString);
                      }
                    }}
                    className={`px-2 py-0.5 rounded transition cursor-pointer ${
                      hdFrequency === '1 kali dalam satu minggu'
                        ? 'bg-amber-500 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    1x / Minggu
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setHdFrequency('1 kali / 2 minggu');
                      const sDay = lastHdDate ? getSingleDayFromDate(lastHdDate) : singleDay;
                      const sDaySched = getScheduleDayFromSingleDay(sDay);
                      setScheduleDay(sDaySched);
                      if (!initialPatient) {
                        setHbDate(getFirstHDDateOfMonth(currentMonth, sDaySched, sDay, '1 kali / 2 minggu', lastHdDate).dateString);
                      }
                    }}
                    className={`px-2 py-0.5 rounded transition cursor-pointer ${
                      hdFrequency === '1 kali / 2 minggu'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    1x / 2 Minggu
                  </button>
                </div>
              </div>

              {/* Pilihan Hari & Tanggal Acuan HD */}
              {hdFrequency === '1 kali / 2 minggu' ? (
                <div className="space-y-1.5 p-2 rounded-md bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-800/60">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-purple-900 dark:text-purple-300">
                      Jadwal HD Terakhir (Acuan Siklus 14 Hari):
                    </span>
                    <span className="font-extrabold text-purple-700 dark:text-purple-300">
                      Hari {singleDay}
                    </span>
                  </div>
                  <div>
                    <input
                      type="date"
                      value={lastHdDate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setLastHdDate(val);
                        if (val) {
                          const sDay = getSingleDayFromDate(val);
                          setSingleDay(sDay);
                          const newSched = getScheduleDayFromSingleDay(sDay);
                          setScheduleDay(newSched);
                          setHbDate(val);
                          setLabScheduledDate(val);
                        }
                      }}
                      className="w-full px-2 py-1 rounded-md border border-purple-300 dark:border-purple-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-semibold focus:outline-hidden focus:ring-1 focus:ring-purple-500"
                    />
                  </div>
                  <div className="text-[10px] text-purple-800 dark:text-purple-300 leading-tight space-y-0.5">
                    <p>• Sesi HD dihitung otomatis kelipatan 14 hari (2 minggu sekali) pada hari <strong>{singleDay}</strong>.</p>
                    <p>• Alokasi EPO otomatis <strong>2x 2000 IU</strong> (total 4.000 IU / 2 vial) saat sesi HD.</p>
                  </div>
                </div>
              ) : hdFrequency === '1 kali dalam satu minggu' ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9px] text-slate-500">
                    <span>Pilih 1 Hari HD (EPO tunda +7 hari):</span>
                    <span className="font-bold text-amber-700 dark:text-amber-400">Hari {singleDay}</span>
                  </div>
                  <div className="grid grid-cols-6 gap-1">
                    {(['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as SingleHDDay[]).map((day) => {
                      const isSel = singleDay === day;
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            setSingleDay(day);
                            const newSchedule = getScheduleDayFromSingleDay(day);
                            setScheduleDay(newSchedule);
                            if (!initialPatient) {
                              setHbDate(getFirstHDDateOfMonth(currentMonth, newSchedule, day, '1 kali dalam satu minggu').dateString);
                            }
                          }}
                          className={`py-0.5 text-center rounded font-bold text-[10px] transition cursor-pointer border ${
                            isSel
                              ? 'bg-amber-500 text-white border-amber-600 ring-1 ring-amber-400 shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-amber-50/50'
                          }`}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[9px] text-slate-500">
                    <span>Pilih Pasangan 2 Hari HD:</span>
                    <span className="font-bold text-blue-700 dark:text-blue-400">{scheduleDay}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {(['Senin - Kamis', 'Selasa - Jumat', 'Rabu - Sabtu'] as HDDaySchedule[]).map((sched) => {
                      const isSel = scheduleDay === sched;
                      return (
                        <button
                          key={sched}
                          type="button"
                          onClick={() => setScheduleDay(sched)}
                          className={`py-0.5 text-center rounded font-bold text-[10px] transition cursor-pointer border ${
                            isSel
                              ? 'bg-blue-600 text-white border-blue-700 ring-1 ring-blue-400 shadow-xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-blue-50/50'
                          }`}
                        >
                          {sched}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Hasil Cek Hemoglobin & Rekomendasi Klinis */}
            <div className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 space-y-1.5">
              <div className="grid grid-cols-3 gap-1.5">
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                      Hb Berjalan *
                    </label>
                    <button
                      type="button"
                      onClick={() => setHbValue('0')}
                      className="text-[9px] text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      Set 0
                    </button>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="22"
                    value={hbValue}
                    onChange={(e) => setHbValue(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-2 py-1 text-xs font-bold font-mono rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-rose-500 focus:outline-hidden"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300" title="Nilai Hb bulan sebelumnya untuk kriteria Cek Hb Pilihan (< 9.0 g/dL)">
                      Hb Bulan Lalu
                    </label>
                    {parseFloat(prevHbValue) <= 8.9 && parseFloat(prevHbValue) > 0 && (
                      <span className="text-[8.5px] font-bold text-amber-600 dark:text-amber-400">
                        ≤ 8.9 (Pilihan)
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="22"
                    value={prevHbValue}
                    onChange={(e) => {
                      setPrevHbValue(e.target.value);
                      const parsed = parseFloat(e.target.value.replace(',', '.'));
                      if (!isNaN(parsed) && parsed > 0) {
                        const rounded = Number(parsed.toFixed(1));
                        if (rounded <= 8.9) {
                          setIsSelectiveHb(true);
                          setLabTestType('Cek Hb Pilihan (Hb ≤ 8.9)');
                        } else {
                          setIsSelectiveHb(false);
                          setLabTestType('Rutin Hb (Evaluasi EPO)');
                        }
                      }
                    }}
                    placeholder="Contoh: 8.5"
                    className={`w-full px-2 py-1 text-xs font-bold font-mono rounded-md border ${
                      parseFloat(prevHbValue) <= 8.9 && parseFloat(prevHbValue) > 0
                        ? 'border-amber-400 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'
                        : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white'
                    } focus:outline-hidden`}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <label className="text-[10px] font-semibold text-slate-700 dark:text-slate-300">
                      Tanggal Tindakan
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const finalSched = hdFrequency === '1 kali dalam satu minggu' 
                          ? getScheduleDayFromSingleDay(singleDay) 
                          : scheduleDay;
                        const routineDate = getFirstHDDateOfMonth(
                          currentMonth, 
                          finalSched, 
                          hdFrequency === '1 kali dalam satu minggu' ? singleDay : undefined, 
                          hdFrequency
                        ).dateString;
                        setHbDate(routineDate);
                        setLabScheduledDate(routineDate);
                      }}
                      className="text-[9px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
                      title="Sesuaikan tanggal tindakan dengan jadwal rutin HD pasien di awal bulan"
                    >
                      Jadwal Rutin
                    </button>
                  </div>
                  <input
                    type="date"
                    value={hbDate}
                    onChange={(e) => {
                      setHbDate(e.target.value);
                      setLabScheduledDate(e.target.value);
                    }}
                    className="w-full px-2 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Notifikasi Kategori Cek Hb Pilihan */}
              {((parseFloat(prevHbValue) < 9.0 && parseFloat(prevHbValue) > 0) || isSelectiveHb) && (
                <div className="p-1 px-2 rounded-md bg-amber-100/90 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 flex items-center justify-between text-[10px] text-amber-900 dark:text-amber-200">
                  <span className="font-bold flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>Kategori: CEK HB PILIHAN (Hb Bulan Lalu &lt; 9.0 g/dL)</span>
                  </span>
                  <label className="flex items-center gap-1 cursor-pointer font-semibold">
                    <input
                      type="checkbox"
                      checked={isSelectiveHb}
                      onChange={(e) => {
                        setIsSelectiveHb(e.target.checked);
                        if (e.target.checked) setLabTestType('Cek Hb Pilihan (Hb < 9.0)');
                      }}
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>Aktif</span>
                  </label>
                </div>
              )}

              {/* Compact Live Recommendation Preview */}
              <div className={`p-1.5 rounded-md border flex items-center justify-between gap-1.5 ${recommendation.badgeBg} ${recommendation.borderColor}`}>
                <div className="flex items-center gap-1.5 min-w-0">
                  {recommendation.transfusionBags > 0 ? (
                    <Droplets className="w-3 h-3 text-rose-600 fill-rose-600 shrink-0" />
                  ) : recommendation.totalEpoVials > 0 ? (
                    <Syringe className="w-3 h-3 text-blue-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-3 h-3 text-purple-600 shrink-0" />
                  )}
                  <div className="truncate">
                    <span className={`text-[10px] font-bold ${recommendation.badgeColor}`}>
                      {recommendation.title}
                    </span>
                    <span className="text-[9px] text-slate-600 dark:text-slate-300 ml-1">
                      • {recommendation.doseDescription}
                    </span>
                  </div>
                </div>
                <span className="text-[9px] font-bold px-1 py-0.2 rounded bg-white/80 dark:bg-slate-900/80 shrink-0">
                  {recommendation.protocolBadge}
                </span>
              </div>
            </div>

            {/* Jadwal Cek Lab Manual */}
            <div className="p-2 rounded-lg border border-purple-200 dark:border-purple-800/60 bg-purple-50/50 dark:bg-purple-950/30 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold text-purple-900 dark:text-purple-300 flex items-center gap-1">
                  <FlaskConical className="w-3.5 h-3.5 text-purple-600" />
                  <span>Jadwal Pemeriksaan Lab (Manual)</span>
                </span>
                <span className="text-[9px] text-purple-700 dark:text-purple-400 font-medium">
                  Rencana cek lab pasien
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9.5px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                    Tanggal Rencana Cek Lab:
                  </label>
                  <input
                    type="date"
                    value={labScheduledDate}
                    onChange={(e) => {
                      setLabScheduledDate(e.target.value);
                      setHbDate(e.target.value);
                    }}
                    className="w-full px-2 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-[9.5px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                    Status Jadwal:
                  </label>
                  <select
                    value={labStatus}
                    onChange={(e) => setLabStatus(e.target.value as LabScheduleStatus)}
                    className="w-full px-2 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden font-semibold"
                  >
                    <option value="Terjadwal">🕒 Terjadwal</option>
                    <option value="Selesai">✅ Selesai</option>
                    <option value="Ditunda">⚠️ Ditunda</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9.5px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                    Jenis Pemeriksaan Lab:
                  </label>
                  <select
                    value={labTestType}
                    onChange={(e) => setLabTestType(e.target.value as LabTestType)}
                    className="w-full px-2 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden font-semibold"
                  >
                    <option value="Cek Hb Pilihan (Hb < 9.0)">⭐ Cek Hb Pilihan (Hb &lt; 9.0)</option>
                    <option value="Rutin Hb (Evaluasi EPO)">Rutin Hb (Evaluasi EPO)</option>
                    <option value="Darah Lengkap & Hb">Darah Lengkap & Hb</option>
                    <option value="Ureum & Kreatinin">Ureum & Kreatinin</option>
                    <option value="Profil Besi (Ferritin / TIBC)">Profil Besi (Ferritin / TIBC)</option>
                    <option value="Elektrolit Lengkap">Elektrolit Lengkap</option>
                    <option value="Lengkap Rutin Bulanan">Lengkap Rutin Bulanan</option>
                    <option value="Lainnya">Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9.5px] font-semibold text-slate-700 dark:text-slate-300 mb-0.5">
                    Catatan Lab (Opsional):
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Puasa 8 jam..."
                    value={labNotes}
                    onChange={(e) => setLabNotes(e.target.value)}
                    className="w-full px-2 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Catatan Tambahan (Kompak) */}
            <div>
              <label className="block text-[10px] font-medium text-slate-600 dark:text-slate-400 mb-0.5">
                Catatan Khusus (Opsional)
              </label>
              <input
                type="text"
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Contoh: lemas, riwayat alergi obat..."
                className="w-full px-2 py-1 text-xs rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>

          </div>

          {/* Action Buttons (Pinned Footer) */}
          <div className="px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-end gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="h-8.5 px-3.5 rounded-lg font-medium text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="h-8.5 px-4 rounded-lg font-semibold text-xs text-white bg-rose-700 hover:bg-rose-800 active:bg-rose-900 shadow-xs transition cursor-pointer"
            >
              {initialPatient ? 'Simpan Perubahan' : 'Tambah Pasien'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

