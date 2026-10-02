import React, { useState } from 'react';
import { 
  X, 
  Calculator, 
  Activity, 
  Droplet, 
  Syringe, 
  AlertTriangle, 
  CheckCircle,
  HelpCircle,
  Stethoscope
} from 'lucide-react';
import { calculateClinicalRecommendation } from '../services/clinicalRules';

interface ClinicalCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyToNewPatient?: (hbValue: number) => void;
}

export const ClinicalCalculatorModal: React.FC<ClinicalCalculatorModalProps> = ({
  isOpen,
  onClose,
  onApplyToNewPatient,
}) => {
  const [hbInput, setHbInput] = useState<string>('7.8');

  if (!isOpen) return null;

  const numericHb = parseFloat(hbInput.replace(',', '.')) || 0;
  const reco = calculateClinicalRecommendation(numericHb);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-3 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-slate-900 rounded-xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-1 flex flex-col max-h-[85vh]">
        
        {/* Header (Pinned) */}
        <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-850 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-rose-700 text-white flex items-center justify-center shadow-xs shrink-0">
              <Calculator className="w-4 h-4 text-rose-100" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                Kalkulator Dosis Hb Hemodialisa
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Simulasi alokasi terapi EPO & indikasi transfusi darah
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

        {/* Content (Compact Scrollable Body) */}
        <div className="p-3 space-y-2 text-xs overflow-y-auto flex-1">
          
          {/* Input Hb */}
          <div className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/60 space-y-1">
            <div className="flex items-center justify-between">
              <label className="font-semibold text-slate-700 dark:text-slate-200 text-[11px]">
                Kadar Hemoglobin (Hb):
              </label>
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                {numericHb.toFixed(1)} g/dL
              </span>
            </div>

            <div className="relative">
              <input
                type="number"
                step="0.1"
                min="0.0"
                max="22.0"
                value={hbInput}
                onChange={(e) => setHbInput(e.target.value)}
                className="w-full pl-3 pr-12 py-1.5 text-base font-bold font-mono rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-1 focus:ring-indigo-500 focus:outline-hidden"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-semibold text-[11px] text-slate-400">
                g/dL
              </span>
            </div>

            {/* Quick Slider for Fast Exploration */}
            <input
              type="range"
              min="3"
              max="14"
              step="0.1"
              value={numericHb || 7.5}
              onChange={(e) => setHbInput(e.target.value)}
              className="w-full accent-indigo-600 cursor-pointer h-1.5"
            />
            <div className="flex justify-between text-[9px] text-slate-400 font-mono">
              <span>3.0</span>
              <span>5.9 (Ranap)</span>
              <span>6.9 (1 Bag)</span>
              <span>8.9 (EPO 4x)</span>
              <span>12.0 (EPO 1x)</span>
              <span>&gt;12 (Tanpa EPO)</span>
            </div>
          </div>

          {/* Quick Buttons for Common Levels */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-slate-500 mr-0.5">Contoh:</span>
            {[
              { label: '0 (Belum)', val: '0' },
              { label: '5.2 (Ranap)', val: '5.2' },
              { label: '6.4 (1 Bag)', val: '6.4' },
              { label: '7.8 (4x EPO)', val: '7.8' },
              { label: '10.5 (1x EPO)', val: '10.5' },
              { label: '12.8 (Hold)', val: '12.8' },
            ].map((btn) => (
              <button
                key={btn.val}
                type="button"
                onClick={() => setHbInput(btn.val)}
                className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium text-[10px] transition cursor-pointer"
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Result Card */}
          <div className={`p-2.5 rounded-xl border ${reco.badgeBg} ${reco.borderColor} space-y-1.5`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {reco.transfusionBags > 0 ? (
                  <Droplet className="w-4 h-4 text-rose-600 fill-rose-600 shrink-0" />
                ) : reco.totalEpoVials > 0 ? (
                  <Syringe className="w-4 h-4 text-blue-600 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-purple-600 shrink-0" />
                )}
                <span className={`font-bold text-xs sm:text-sm ${reco.badgeColor}`}>
                  {reco.title}
                </span>
              </div>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-white/80 dark:bg-slate-900/80">
                {reco.protocolBadge}
              </span>
            </div>

            <div className="p-2 bg-white/60 dark:bg-slate-900/60 rounded-md text-slate-800 dark:text-slate-200">
              <div className="font-semibold text-[11px] text-slate-900 dark:text-white leading-tight">
                Rencana: {reco.doseDescription}
              </div>
              <p className="mt-0.5 text-[10px] text-slate-600 dark:text-slate-300 leading-snug">
                {reco.notes}
              </p>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 gap-1.5 text-[10px] pt-0.5">
              <div className="bg-white/50 dark:bg-slate-900/50 p-1.5 rounded">
                <span className="text-slate-500">Transfusi:</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  {reco.transfusionBags > 0 ? `${reco.transfusionBags} Kantong PRC` : 'Tidak Ada'}
                </p>
              </div>
              <div className="bg-white/50 dark:bg-slate-900/50 p-1.5 rounded">
                <span className="text-slate-500">Kebutuhan EPO:</span>
                <p className="font-bold text-slate-800 dark:text-slate-200">
                  {reco.totalEpoVials > 0 ? `${reco.totalEpoVials} Ampul (${reco.totalEpoIu} IU)` : 'Tidak Ada'}
                </p>
              </div>
            </div>
          </div>

          {/* Clinical Reference Box (Minimalist) */}
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-[10px] space-y-0.5">
            <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
              <Stethoscope className="w-3 h-3 text-indigo-500" />
              <span>Pedoman Klinis Hemodialisa:</span>
            </div>
            <p className="text-slate-500 dark:text-slate-400 pl-1 text-[9px] leading-tight">
              • Evaluasi Hb awal bulan. EPO diberikan pasca HD jalur venous. Pastikan saturasi transferin &gt; 20%. Hb &gt; 12.0 mg/dl hold terapi EPO.
            </p>
          </div>

        </div>

        {/* Footer (Pinned) */}
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <button
            onClick={onClose}
            className="h-8.5 px-3.5 rounded-lg font-medium text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            Tutup
          </button>
          {onApplyToNewPatient && (
            <button
              onClick={() => {
                onApplyToNewPatient(numericHb);
                onClose();
              }}
              className="h-8.5 px-4 rounded-lg font-semibold text-xs text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 shadow-xs transition cursor-pointer"
            >
              Gunakan untuk Pasien Baru
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
