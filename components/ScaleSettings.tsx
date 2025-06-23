
import React, { useState, useEffect } from 'react';
import { MapScaleSettings, MapScaleMode } from '../types';

interface ScaleSettingsProps {
  currentSettings: MapScaleSettings;
  onUpdateSettings: (settings: MapScaleSettings) => void;
  mapSourceType: 'pdf' | 'image' | null;
  onStartRefLineMeasurement: () => void; // New prop
}

export const ScaleSettings: React.FC<ScaleSettingsProps> = ({ 
    currentSettings, 
    onUpdateSettings, 
    mapSourceType,
    onStartRefLineMeasurement 
}) => {
  const [isOpen, setIsOpen] = useState(true); // Panel is open by default
  const [mode, setMode] = useState<MapScaleMode>(currentSettings.mode);
  const [ratioValue, setRatioValue] = useState<string>(currentSettings.ratioValue?.toString() || '15000');
  const [mapUnits, setMapUnits] = useState<string>(currentSettings.mapUnitsOnScreen?.toString() || '');
  const [realMeters, setRealMeters] = useState<string>(currentSettings.realWorldMeters?.toString() || '');

  useEffect(() => {
    setMode(currentSettings.mode);
    setRatioValue(currentSettings.ratioValue?.toString() || '15000');
    // Ensure mapUnits input updates when currentSettings.mapUnitsOnScreen changes (e.g., from map measurement)
    setMapUnits(currentSettings.mapUnitsOnScreen?.toString() || ''); 
    setRealMeters(currentSettings.realWorldMeters?.toString() || '');
  }, [currentSettings]);

  const handleApply = () => {
    const newSettings: MapScaleSettings = { mode };
    if (mode === 'ratio') {
      const val = parseInt(ratioValue, 10);
      if (!isNaN(val) && val > 0) {
        newSettings.ratioValue = val;
      } else {
        alert("Please enter a valid positive number for the ratio denominator.");
        return;
      }
    } else if (mode === 'referenceLength') {
      const mu = parseFloat(mapUnits); // This value might now be auto-filled
      const rm = parseFloat(realMeters);
      if (!isNaN(mu) && mu > 0 && !isNaN(rm) && rm > 0) {
        newSettings.mapUnitsOnScreen = mu;
        newSettings.realWorldMeters = rm;
      } else if (!isNaN(mu) && mu > 0 && (realMeters === '' || parseFloat(realMeters) <= 0) ) {
        // If mapUnits is filled (likely from measurement) but realMeters is not.
        alert("Please enter the corresponding real-world distance in meters for the measured map units.");
        return;
      }
       else {
        alert("Please enter valid positive numbers for map units and real-world meters, or measure map units first.");
        return;
      }
    }
    onUpdateSettings(newSettings);
  };

  return (
    <div className="bg-gray-800 p-3 shadow-md print:hidden border-b border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-gray-300">Map Scale Settings</h3>
        <button 
          onClick={() => setIsOpen(!isOpen)} 
          className="text-teal-400 hover:text-teal-300 text-sm p-1"
          aria-expanded={isOpen}
          aria-controls="scale-settings-content"
        >
          {isOpen ? "[-] Hide" : "[+] Show"}
        </button>
      </div>

      {isOpen && (
        <div id="scale-settings-content" className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <label className="flex items-center text-sm text-gray-300">
              <input
                type="radio"
                name="scaleMode"
                value="none"
                checked={mode === 'none'}
                onChange={() => setMode('none')}
                className="mr-1 h-4 w-4 text-teal-600 border-gray-600 focus:ring-teal-500 bg-gray-700"
              />
              No Scale
            </label>
            <label className="flex items-center text-sm text-gray-300">
              <input
                type="radio"
                name="scaleMode"
                value="ratio"
                checked={mode === 'ratio'}
                onChange={() => setMode('ratio')}
                className="mr-1 h-4 w-4 text-teal-600 border-gray-600 focus:ring-teal-500 bg-gray-700"
              />
              Ratio (e.g., 1:)
            </label>
            <label className="flex items-center text-sm text-gray-300">
              <input
                type="radio"
                name="scaleMode"
                value="referenceLength"
                checked={mode === 'referenceLength'}
                onChange={() => setMode('referenceLength')}
                className="mr-1 h-4 w-4 text-teal-600 border-gray-600 focus:ring-teal-500 bg-gray-700"
              />
              Reference Length
            </label>
          </div>

          {mode === 'ratio' && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-300">1 :</span>
              <input
                type="number"
                value={ratioValue}
                onChange={(e) => setRatioValue(e.target.value)}
                placeholder="15000"
                className="w-24 px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-gray-200"
              />
              {mapSourceType === 'image' && <span className="text-xs text-yellow-400">(Note: Ratio on images is less precise than on PDFs)</span>}
            </div>
          )}

          {mode === 'referenceLength' && (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={onStartRefLineMeasurement}
                className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md shadow-sm"
              >
                Measure on Map
              </button>
              <input
                type="number"
                value={mapUnits}
                onChange={(e) => setMapUnits(e.target.value)}
                placeholder="Map Units (px/pt)"
                readOnly // Make read-only if primarily filled by measurement, or allow manual override
                className="w-36 px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-gray-200"
              />
              <span className="text-sm text-gray-300">=</span>
              <input
                type="number"
                value={realMeters}
                onChange={(e) => setRealMeters(e.target.value)}
                placeholder="Real Meters"
                className="w-32 px-2 py-1 text-sm bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-gray-200"
              />
              <span className="text-sm text-gray-300">meters</span>
            </div>
          )}
          
          <button
            onClick={handleApply}
            className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-opacity-50 disabled:opacity-50"
            disabled={mode === 'none' && currentSettings.mode === 'none'}
          >
            {mode === 'none' ? 'Clear Scale' : 'Apply Scale'}
          </button>
        </div>
      )}
    </div>
  );
};