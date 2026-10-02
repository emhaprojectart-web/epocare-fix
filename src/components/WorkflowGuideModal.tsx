import React from 'react';
import { 
  X, 
  CheckCircle2, 
  CalendarDays, 
  Droplet, 
  Sparkles, 
  Syringe, 
  ArrowRight,
  Clock,
  Layers,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';

interface WorkflowGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenMonthlyHbModal?: () => void;
  onOpenLabScheduleModal?: () => void;
}

export const WorkflowGuideModal: React.FC<WorkflowGuideModalProps> = ({
  isOpen,
  onClose,
  onOpenMonthlyHbModal,
  onOpenLabScheduleModal,
}) => {
  if (!isOpen) return null;

  const steps = [
    {
      step: 1,
      title: 'Pelaksanaan Cek HB Awal Bulan',
      category: 'Pemeriksaan Klinis',
      color: 'border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-900 dark:text-blue-200',
      badgeColor: 'bg-blue-600 text-white',
      icon: Droplet,
      desc: 'Terdapat dua opsi pemeriksaan Cek Hb di awal bulan:',
      points: [
        'Cek HB Seluruh Pasien: Evaluasi rutin awal bulan bagi seluruh pasien hemodialisa pada sesi HD pertama mereka.',
        'Cek HB Pasien Pilihan: Evaluasi khusus bagi pasien yang pada bulan sebelumnya memiliki nilai Hb < 9.0 g/dL (mg/dL).',
        'Tanggal tindakan langsung menyesuaikan jadwal rutin masing-masing pasien (Senin-Kamis, Selasa-Jumat, Rabu-Sabtu, atau 1x/minggu).'
      ]
    },
    {
      step: 2,
      title: 'Buka Menu "Input Nilai HB"',
      category: 'Tindakan di Aplikasi',
      color: 'border-rose-500 bg-rose-50/70 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200',
      badgeColor: 'bg-rose-600 text-white',
      icon: Clock,
      desc: 'Setelah darah diambil dan hasil tes laboratorium keluar, buka menu Input Nilai HB:',
      points: [
        'Tanggal tindakan CEK HB langsung otomatis menyesuaikan jadwal rutin pasien di awal bulan aktif.',
        'Jika ada jadwal pasien yang berubah atau berhalangan, tanggal dapat diinputkan secara manual.',
        'Tersedia tombol "Sesuaikan Jadwal Rutin Pasien" di toolbar untuk menyelaraskan tanggal seluruh pasien seketika.',
        'Bulan Aktif evaluasi ditampilkan secara jelas di header dengan kontrol navigasi antar-bulan.'
      ]
    },
    {
      step: 3,
      title: 'Sesi Input: CEK HB SELURUH PASIEN',
      category: 'Update Massal Seluruh Pasien',
      color: 'border-indigo-500 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200',
      badgeColor: 'bg-indigo-600 text-white',
      icon: Layers,
      desc: 'Digunakan saat seluruh pasien hemodialisa dilakukan cek darah Hb awal bulan:',
      points: [
        'Mengupdate seluruh nilai Hb baru pasien untuk bulan berjalan.',
        'Nilai Hb bulan sebelumnya otomatis dicatat ke riwayat (prevHbValue) sebagai acuan klinis.'
      ]
    },
    {
      step: 4,
      title: 'Sesi Input: CEK HB PASIEN PILIHAN',
      category: 'Update Selektif (Hb < 9.0)',
      color: 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200',
      badgeColor: 'bg-amber-600 text-white',
      icon: Sparkles,
      desc: 'Khusus menginput hasil lab pasien yang pada bulan sebelumnya Hb-nya < 9.0 g/dL:',
      points: [
        'Hanya menampilkan dan mengupdate pasien-pasien dalam kategori Cek Hb Pilihan.',
        'PENTING: Nilai Hb pasien lain yang tidak dicek TETAP UTUH dan tidak mengalami perubahan apa pun.'
      ]
    },
    {
      step: 5,
      title: 'Otomatis Alokasi Kebutuhan EPO & Transfusi',
      category: 'Kalkulasi Protokol Klinis',
      color: 'border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200',
      badgeColor: 'bg-emerald-600 text-white',
      icon: Syringe,
      desc: 'Sistem langsung menghitung dan mengalokasikan terapi berdasarkan nilai Hb baru:',
      points: [
        '< 5.9 g/dL: Transfusi 2 Bag PRC + Rawat Inap (Tanpa EPO)',
        '6.0 – 6.9 g/dL: Transfusi 1 Bag PRC Rawat Jalan',
        '7.0 – 8.9 g/dL: Terapi EPO 4x sebulan (2000 IU/minggu)',
        '9.0 – 12.0 g/dL: Terapi EPO 1x sebulan (2000 IU/bulan)',
        '> 12.0 g/dL: Evaluasi Klinis / Tanpa EPO'
      ]
    },
    {
      step: 6,
      title: 'Penjadwalan Cek HB Bulan Depan',
      category: 'Langkah Terakhir Siklus',
      color: 'border-purple-500 bg-purple-50/70 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200',
      badgeColor: 'bg-purple-600 text-white',
      icon: CalendarDays,
      desc: 'Setelah seluruh data Hb terupdate, langkah terakhir adalah menyusun jadwal bulan selanjutnya:',
      points: [
        'Pasien dengan Hb evaluasi < 9.0 g/dL otomatis masuk Kategori Cek Hb Pilihan bulan depan.',
        'Pasien dengan Hb ≥ 9.0 g/dL dijadwalkan dalam Kategori Rutin Hb.',
        'Sinkronkan lembar JADWAL_CEK_HB dan MATRIKS_CEK_HB (6 hari sesi pertama) ke Google Sheets.'
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header Modal */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-rose-950 to-indigo-950 text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Layers className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white leading-tight">
                6 Runtutan Alur Penggunaan Aplikasi Hemodialisa
              </h3>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Standar Operasional Siklus Cek Hb, Input Nilai, Alokasi EPO/PRC, dan Penjadwalan Bulan Depan
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white transition cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body - List of 6 Steps */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3.5 text-xs">
          
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[11.5px] leading-relaxed">
            💡 <strong>Prinsip Kerja Siklus Bulanan:</strong> Setiap awal bulan dilakukan pemeriksaan darah (seluruh pasien atau pasien pilihan dengan riwayat Hb &lt; 9.0). Nilai diinputkan ke aplikasi, kebutuhan terapi EPO/PRC otomatis terhitung, dan diakhiri dengan membuat penjadwalan bulan depan.
          </div>

          <div className="space-y-3">
            {steps.map((st) => {
              const IconComp = st.icon;
              return (
                <div 
                  key={st.step}
                  className={`p-3.5 rounded-xl border-l-4 ${st.color} border shadow-2xs space-y-1.5`}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full ${st.badgeColor} flex items-center justify-center font-bold text-[11px] shrink-0`}>
                        {st.step}
                      </span>
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs sm:text-sm">
                        {st.title}
                      </h4>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                      {st.category}
                    </span>
                  </div>

                  <p className="text-[11.5px] font-medium text-slate-800 dark:text-slate-200 pl-7">
                    {st.desc}
                  </p>

                  <ul className="pl-11 list-disc space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                    {st.points.map((pt, pIdx) => (
                      <li key={pIdx}>
                        {pt}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="text-[11px] text-slate-500">
            Aplikasi siap memandu setiap tahapan secara otomatis & aman.
          </div>

          <div className="flex items-center gap-2">
            {onOpenMonthlyHbModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenMonthlyHbModal();
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <Droplet className="w-3.5 h-3.5 fill-white" />
                <span>Buka Input Nilai HB</span>
              </button>
            )}

            {onOpenLabScheduleModal && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenLabScheduleModal();
                }}
                className="px-3 py-1.5 rounded-lg bg-indigo-700 hover:bg-indigo-800 text-white font-semibold text-xs flex items-center gap-1.5 shadow-2xs cursor-pointer"
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Buka Jadwal Cek HB</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 font-medium text-xs cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
