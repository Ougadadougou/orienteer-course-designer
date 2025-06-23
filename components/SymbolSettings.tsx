
import React, { useState } from 'react';

interface SymbolSettingsProps {
  startSymbolScaleUI: number;
  onSetStartSymbolScaleUI: (scale: number) => void;
  controlSymbolScaleUI: number;
  onSetControlSymbolScaleUI: (scale: number) => void;
  finishSymbolScaleUI: number;
  onSetFinishSymbolScaleUI: (scale: number) => void;
}

export const SymbolSettings: React.FC<SymbolSettingsProps> = ({
  startSymbolScaleUI,
  onSetStartSymbolScaleUI,
  controlSymbolScaleUI,
  onSetControlSymbolScaleUI,
  finishSymbolScaleUI,
  onSetFinishSymbolScaleUI,
}) => {
  const [isOpen, setIsOpen] = useState(true); 

  const handleScaleChange = (setter: (value: number) => void, value: string) => {
    const numValue = parseInt(value, 10);
    // Allow valid numbers or temporarily empty string during typing for number inputs
    if (!isNaN(numValue) && numValue >= 1 && numValue <= 10) {
      setter(numValue);
    } else if (value === "") {
      // For number inputs, allow it to be temporarily empty. 
      // The onBlur handler will ensure a valid value is set.
      // For range inputs, this case shouldn't occur as they always provide a number string.
    }
  };
  
  const handleNumberInputBlur = (
    setter: (value: number) => void, 
    currentValue: number, // The current valid state value
    event: React.FocusEvent<HTMLInputElement>
  ) => {
    const valueStr = event.target.value;
    if (valueStr === "") { 
        setter(currentValue); // If empty, revert to the last valid value (or default if it was never set)
        return;
    }
    const numValue = parseInt(valueStr, 10);
    if (isNaN(numValue) || numValue < 1) {
        setter(1);
    } else if (numValue > 10) {
        setter(10);
    } else {
        setter(numValue); // This might be redundant if onChange already set it, but good for direct invalid entries.
    }
  };

  const sliderClasses = "w-24 md:w-28 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-teal-500";
  const valueTextClasses = "text-sm text-gray-200 w-6 text-center";
  const numberInputClasses = "w-14 px-1 py-0.5 text-sm bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-teal-500 focus:border-teal-500 text-gray-200 text-center";
  const itemContainerClasses = "flex items-center gap-2";
  const labelClasses = "text-sm text-gray-300 w-12 text-right pr-1";


  return (
    <div className="bg-gray-800 p-3 shadow-md print:hidden border-b border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-gray-300">Symbol Scales (1-10)</h3>
        <button 
          onClick={() => setIsOpen(!isOpen)} 
          className="text-teal-400 hover:text-teal-300 text-sm p-1"
          aria-expanded={isOpen}
          aria-controls="symbol-settings-content"
        >
          {isOpen ? "[-] Hide" : "[+] Show"}
        </button>
      </div>

      {isOpen && (
        <div id="symbol-settings-content" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-3">
          {/* Start Scale */}
          <div className={itemContainerClasses}>
            <label htmlFor="startSymbolScaleUI_slider" className={labelClasses}>Start:</label>
            <input
              type="range"
              id="startSymbolScaleUI_slider"
              min="1"
              max="10"
              step="1"
              value={startSymbolScaleUI}
              onChange={(e) => handleScaleChange(onSetStartSymbolScaleUI, e.target.value)}
              className={sliderClasses}
            />
            <span className={valueTextClasses}>{startSymbolScaleUI}</span>
            <input
              type="number"
              id="startSymbolScaleUI_number"
              min="1"
              max="10"
              step="1"
              value={startSymbolScaleUI}
              onChange={(e) => handleScaleChange(onSetStartSymbolScaleUI, e.target.value)}
              onBlur={(e) => handleNumberInputBlur(onSetStartSymbolScaleUI, startSymbolScaleUI, e)}
              className={numberInputClasses}
            />
          </div>

          {/* Control Scale */}
          <div className={itemContainerClasses}>
            <label htmlFor="controlSymbolScaleUI_slider" className={labelClasses}>Control:</label>
            <input
              type="range"
              id="controlSymbolScaleUI_slider"
              min="1"
              max="10"
              step="1"
              value={controlSymbolScaleUI}
              onChange={(e) => handleScaleChange(onSetControlSymbolScaleUI, e.target.value)}
              className={sliderClasses}
            />
            <span className={valueTextClasses}>{controlSymbolScaleUI}</span>
             <input
              type="number"
              id="controlSymbolScaleUI_number"
              min="1"
              max="10"
              step="1"
              value={controlSymbolScaleUI}
              onChange={(e) => handleScaleChange(onSetControlSymbolScaleUI, e.target.value)}
              onBlur={(e) => handleNumberInputBlur(onSetControlSymbolScaleUI, controlSymbolScaleUI, e)}
              className={numberInputClasses}
            />
          </div>

          {/* Finish Scale */}
          <div className={itemContainerClasses}>
            <label htmlFor="finishSymbolScaleUI_slider" className={labelClasses}>Finish:</label>
            <input
              type="range"
              id="finishSymbolScaleUI_slider"
              min="1"
              max="10"
              step="1"
              value={finishSymbolScaleUI}
              onChange={(e) => handleScaleChange(onSetFinishSymbolScaleUI, e.target.value)}
              className={sliderClasses}
            />
            <span className={valueTextClasses}>{finishSymbolScaleUI}</span>
             <input
              type="number"
              id="finishSymbolScaleUI_number"
              min="1"
              max="10"
              step="1"
              value={finishSymbolScaleUI}
              onChange={(e) => handleScaleChange(onSetFinishSymbolScaleUI, e.target.value)}
              onBlur={(e) => handleNumberInputBlur(onSetFinishSymbolScaleUI, finishSymbolScaleUI, e)}
              className={numberInputClasses}
            />
          </div>
          <div className="text-xs text-gray-400 col-span-full mt-1">
            (Scales from 1 to 10. Affects symbol size, outline, leg thickness, and control numbers.)
          </div>
        </div>
      )}
    </div>
  );
};