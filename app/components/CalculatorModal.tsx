"use client";

import { useState, useEffect } from "react";
import { Calculator, X, AlertCircle } from "lucide-react";
import { calculateRedeemTime, isValidRedeemPoints, QUICK_AMOUNTS } from "@/lib/utils/pointsCalculator";

export default function CalculatorModal({
  open,
  onClose,
  currentPoints,
}: {
  open: boolean;
  onClose: () => void;
  currentPoints: number;
}) {
  const [input, setInput] = useState(String(currentPoints));
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (open) {
      setInput(String(currentPoints));
      setTouched(false);
    }
  }, [open, currentPoints]);

  const value = Number(input);
  const valid = isValidRedeemPoints(value);

  let warning = "";
  if (touched && input.length > 0) {
    if (!Number.isInteger(value) || isNaN(value)) {
      warning = "Please enter a whole number.";
    } else if (value < 20) {
      warning = "Points must be at least 20.";
    } else if (value % 20 !== 0) {
      warning = "Points can only be redeemed in multiples of 20.";
    }
  }

  const calc = calculateRedeemTime(valid || (touched && value > 0) ? value : 0);
  const showResult = (valid || (touched && value > 0)) && value >= 20;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-pink-500" />
            <h2 className="text-base font-semibold text-white">Points Calculator</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Current Points */}
          <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
            <div className="text-[10px] text-zinc-500 uppercase tracking-wider">Current Points</div>
            <div className="text-xl font-bold text-pink-400">{currentPoints.toLocaleString()}</div>
          </div>

          {/* Input */}
          <div>
            <label className="block text-xs text-zinc-500 font-medium mb-1.5">
              Points to Calculate
            </label>
            <input
              type="number"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setTouched(true);
              }}
              min="0"
              step="1"
              placeholder="Enter points..."
              className="w-full bg-zinc-800 text-white placeholder-zinc-600 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-500/50 border border-zinc-700"
            />
          </div>

          {/* Warning */}
          {warning && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400">{warning}</p>
            </div>
          )}

          {/* Quick Buttons */}
          <div>
            <label className="block text-xs text-zinc-500 font-medium mb-2">
              Quick Select
            </label>
            <div className="flex gap-2 flex-wrap">
              {QUICK_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  onClick={() => {
                    setInput(String(amount));
                    setTouched(true);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    Number(input) === amount
                      ? "bg-pink-500/10 text-pink-400 border border-pink-500/30"
                      : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:text-white"
                  }`}
                >
                  {amount}
                </button>
              ))}
            </div>
          </div>

          {/* Result */}
          {showResult && valid && (
            <div className="space-y-3">
              <div className="h-px bg-zinc-800" />

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    Redeemable
                  </div>
                  <div className="text-lg font-bold text-emerald-400">
                    {calc.redeemablePoints.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-zinc-500">Points</div>
                </div>
                <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    Redeemable
                  </div>
                  <div className="text-lg font-bold text-emerald-400">
                    {calc.totalMinutes}
                  </div>
                  <div className="text-[10px] text-zinc-500">Minutes</div>
                </div>
              </div>

              <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                  Equivalent Time
                </div>
                <div className="text-lg font-bold text-white">
                  {calc.hours} Hour{calc.hours !== 1 ? "s" : ""}{" "}
                  {calc.minutes} Minute{calc.minutes !== 1 ? "s" : ""}
                </div>
              </div>

              {calc.remainingPoints > 0 && (
                <div className="bg-zinc-800/50 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    Unused Points
                  </div>
                  <div className="text-lg font-bold text-amber-400">
                    {calc.remainingPoints.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    Cannot be redeemed (not a multiple of 20)
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
