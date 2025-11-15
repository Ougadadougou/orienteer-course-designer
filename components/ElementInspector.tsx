import React, { useEffect, useMemo, useState } from 'react';
import {
  AreaElement,
  AreaKind,
  CourseElement,
  ElementType,
  LegElement,
  StartElement,
} from '../types';

interface ElementInspectorProps {
  selectedElement: CourseElement | null;
  onUpdateStartRotation: (elementId: string, rotationDegrees: number) => void;
  onUpdateLegStyle: (elementId: string, style: LegElement['style']) => void;
  onUpdateCorridorWidth: (elementId: string, width: number | null) => void;
}

const degFromRadians = (radians?: number): number => {
  if (typeof radians !== 'number') return 0;
  const normalized = (radians * 180) / Math.PI;
  return ((normalized % 360) + 360) % 360;
};

const rotationOptions = { min: 0, max: 359, step: 1 } as const;

const legStyleOptions: Array<{ value: LegElement['style']; label: string; description: string }> = [
  { value: 'solid', label: 'Solid', description: 'Standard solid line.' },
  { value: 'dashed', label: 'Dashed', description: 'Use for suggested or optional legs.' },
  { value: 'uncrossable', label: 'Uncrossable', description: 'Indicate an impassable connection.' },
];

export const ElementInspector: React.FC<ElementInspectorProps> = ({
  selectedElement,
  onUpdateStartRotation,
  onUpdateLegStyle,
  onUpdateCorridorWidth,
}) => {
  const [corridorWidthDraft, setCorridorWidthDraft] = useState('');

  const startElement = useMemo<StartElement | null>(() => {
    if (selectedElement?.type === ElementType.START) {
      return selectedElement as StartElement;
    }
    return null;
  }, [selectedElement]);

  const legElement = useMemo<LegElement | null>(() => {
    if (selectedElement?.type === ElementType.LEG) {
      return selectedElement as LegElement;
    }
    return null;
  }, [selectedElement]);

  const corridorArea = useMemo<AreaElement | null>(() => {
    if (selectedElement?.type === ElementType.AREA) {
      const area = selectedElement as AreaElement;
      if (area.kind === AreaKind.CORRIDOR) {
        return area;
      }
    }
    return null;
  }, [selectedElement]);

  useEffect(() => {
    if (corridorArea) {
      setCorridorWidthDraft(
        typeof corridorArea.corridorWidth === 'number' && !Number.isNaN(corridorArea.corridorWidth)
          ? corridorArea.corridorWidth.toString()
          : ''
      );
    } else {
      setCorridorWidthDraft('');
    }
  }, [corridorArea]);

  const rotationDegrees = useMemo(() => degFromRadians(startElement?.rotationAngle), [startElement]);

  const commitCorridorWidth = () => {
    if (!corridorArea) return;
    const trimmed = corridorWidthDraft.trim();
    if (trimmed === '') {
      onUpdateCorridorWidth(corridorArea.id, null);
      return;
    }

    const parsed = Number.parseFloat(trimmed);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed) && parsed >= 0) {
      onUpdateCorridorWidth(corridorArea.id, parsed);
    }
  };

  return (
    <div className="w-80 bg-gray-800 p-4 border-l border-gray-700 shadow-lg overflow-y-auto flex flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold text-teal-400">Element Inspector</h2>
        {selectedElement ? (
          <p className="text-sm text-gray-300 mt-1 break-words">
            Inspecting <span className="text-teal-300 font-medium">{selectedElement.type}</span> element
            <br />
            <span className="text-gray-400">ID:</span> {selectedElement.id}
          </p>
        ) : (
          <p className="text-sm text-gray-400 mt-1">Select an element on the map to edit its properties.</p>
        )}
      </div>

      {startElement && (
        <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-3">
          <h3 className="text-lg font-medium text-teal-300 mb-2">Start Settings</h3>
          <label htmlFor="start-rotation" className="block text-sm font-medium text-gray-300">
            Rotation
          </label>
          <input
            id="start-rotation"
            type="range"
            min={rotationOptions.min}
            max={rotationOptions.max}
            step={rotationOptions.step}
            value={rotationDegrees}
            onChange={(event) => {
              const newDegrees = Number.parseInt(event.target.value, 10);
              if (!Number.isNaN(newDegrees)) {
                onUpdateStartRotation(startElement.id, newDegrees);
              }
            }}
            className="w-full mt-2"
          />
          <div className="text-sm text-gray-300 mt-1">{rotationDegrees.toFixed(0)}°</div>
        </div>
      )}

      {legElement && (
        <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-3">
          <h3 className="text-lg font-medium text-teal-300 mb-2">Leg Style</h3>
          <div className="space-y-2">
            {legStyleOptions.map((option) => (
              <label key={option.value} className="flex items-start gap-2 text-sm text-gray-200">
                <input
                  type="radio"
                  name="leg-style"
                  value={option.value}
                  checked={legElement.style === option.value}
                  onChange={() => onUpdateLegStyle(legElement.id, option.value)}
                  className="mt-0.5 text-teal-500 focus:ring-teal-500"
                />
                <span>
                  <span className="font-medium text-gray-100">{option.label}</span>
                  <br />
                  <span className="text-gray-400">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {corridorArea && (
        <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-3">
          <h3 className="text-lg font-medium text-teal-300 mb-2">Corridor Settings</h3>
          <label htmlFor="corridor-width" className="block text-sm font-medium text-gray-300">
            Corridor Width (placeholder)
          </label>
          <input
            id="corridor-width"
            type="number"
            min={0}
            step={0.1}
            value={corridorWidthDraft}
            onChange={(event) => setCorridorWidthDraft(event.target.value)}
            onBlur={commitCorridorWidth}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                commitCorridorWidth();
              }
            }}
            placeholder="e.g., 4.0"
            className="mt-2 block w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <p className="text-xs text-gray-400 mt-2">
            Width value is stored for future corridor rendering logic.
          </p>
        </div>
      )}

      {!selectedElement && (
        <div className="text-sm text-gray-400">
          Tip: Use the Select tool to choose a start, leg, or corridor area and adjust its properties here.
        </div>
      )}
    </div>
  );
};

