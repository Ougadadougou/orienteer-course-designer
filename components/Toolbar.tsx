
import React from 'react';
import { Tool } from '../types';
import { SelectIcon } from './icons/SelectIcon';
import { PanIcon } from './icons/PanIcon';
import { StartIcon } from './icons/StartIcon';
import { ControlIcon } from './icons/ControlIcon';
import { FinishIcon } from './icons/FinishIcon';
import { LegIcon } from './icons/LegIcon';
import { AreaIcon } from './icons/AreaIcon';
import { UndoIcon } from './icons/UndoIcon';
import { RedoIcon } from './icons/RedoIcon';
import { SaveIcon } from './icons/SaveIcon';
import { LoadIcon } from './icons/LoadIcon';
import { DeleteIcon } from './icons/DeleteIcon';

interface ToolButtonProps {
  label: string;
  tool?: Tool;
  icon: React.ReactNode;
  isActive?: boolean;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

const ToolButton: React.FC<ToolButtonProps> = ({ label, icon, isActive, onClick, disabled, className = '' }) => (
  <button
    title={label}
    onClick={onClick}
    disabled={disabled}
    className={`p-2 rounded transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed ${
      isActive 
        ? 'bg-teal-600 text-white hover:bg-teal-700' 
        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
    } ${className}`}
  >
    {icon}
  </button>
);

interface ToolbarProps {
  currentTool: Tool;
  onSetTool: (tool: Tool) => void;
  onUndo: () => void;
  canUndo: boolean;
  onRedo: () => void;
  canRedo: boolean;
  onSaveCourseData: () => void;
  onLoad: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteSelected: () => void;
  isElementSelected: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onExportPdf: () => void; 
  isMapLoaded: boolean;
  // elementDisplayScaleFactor and onSetElementDisplayScaleFactor are removed
}

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool, onSetTool, onUndo, canUndo, onRedo, canRedo, 
  onSaveCourseData, onLoad, onDeleteSelected, isElementSelected, 
  onZoomIn, onZoomOut, onExportPdf, isMapLoaded
}) => {
  const loadInputRef = React.useRef<HTMLInputElement>(null);

  const toolButtons = [
    { label: 'Select', tool: Tool.SELECT, icon: <SelectIcon /> },
    { label: 'Pan', tool: Tool.PAN, icon: <PanIcon /> },
    { label: 'Start', tool: Tool.START, icon: <StartIcon /> },
    { label: 'Control', tool: Tool.CONTROL, icon: <ControlIcon /> },
    { label: 'Finish', tool: Tool.FINISH, icon: <FinishIcon /> },
    { label: 'Leg', tool: Tool.LEG, icon: <LegIcon /> },
    { label: 'Forbidden Area', tool: Tool.AREA_FORBIDDEN, icon: <AreaIcon className="text-red-400"/> },
    { label: 'Corridor Area', tool: Tool.AREA_CORRIDOR, icon: <AreaIcon className="text-yellow-400"/> },
  ];

  return (
    <div className="bg-gray-800 p-2 shadow-md flex flex-wrap items-center gap-2 print:hidden">
      {toolButtons.map(({ label, tool, icon }) => tool && (
        <ToolButton
          key={tool}
          label={label}
          tool={tool}
          icon={icon}
          isActive={currentTool === tool}
          onClick={() => onSetTool(tool)}
        />
      ))}
      <div className="mx-2 h-8 border-l border-gray-600"></div>
      <ToolButton label="Zoom In" icon={<span className="font-bold text-lg">+</span>} onClick={onZoomIn} />
      <ToolButton label="Zoom Out" icon={<span className="font-bold text-lg">-</span>} onClick={onZoomOut} />
      
      {/* Symbol Scale input removed */}
      {/* <div className="mx-1 h-8 border-l border-gray-600"></div> */}

      <div className="mx-1 h-8 border-l border-gray-600"></div>
      <ToolButton label="Undo" icon={<UndoIcon />} onClick={onUndo} disabled={!canUndo} />
      <ToolButton label="Redo" icon={<RedoIcon />} onClick={onRedo} disabled={!canRedo} />
      <div className="mx-2 h-8 border-l border-gray-600"></div>
      <ToolButton label="Save Data (JSON)" icon={<SaveIcon />} onClick={onSaveCourseData} />
      <ToolButton
        label="Load Course Data"
        icon={<LoadIcon />}
        onClick={() => loadInputRef.current?.click()}
      />
      <input type="file" ref={loadInputRef} accept=".json" onChange={onLoad} className="hidden" />
      <ToolButton label="Export Map as PDF" icon={<SaveIcon className="text-red-400" />} onClick={onExportPdf} disabled={!isMapLoaded} />
       <div className="mx-2 h-8 border-l border-gray-600"></div>
       <ToolButton label="Delete Selected" icon={<DeleteIcon />} onClick={onDeleteSelected} disabled={!isElementSelected} />
    </div>
  );
};