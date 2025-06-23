
import React, { useState, useEffect } from 'react';
import { ControlElement, ControlDescriptionData, CourseElement, ElementType } from '../types';

interface ControlDescriptionPanelProps {
  selectedControl: ControlElement | null;
  allCourseElements: CourseElement[];
  onUpdateDescription: (controlId: string, newDescription: ControlDescriptionData) => void;
  onExportDescriptions: () => void;
  // onUpdateControlRadius prop removed
}

const descriptionFields: Array<{ key: keyof ControlDescriptionData, label: string, column: string }> = [
  { key: 'A_number', label: 'Number', column: 'A' },
  { key: 'B_code', label: 'Code', column: 'B' },
  { key: 'C_whichFeature', label: 'Which Feature', column: 'C' },
  { key: 'D_featureDetail', label: 'Feature Detail', column: 'D' },
  { key: 'E_dimensions', label: 'Dimensions/Size', column: 'E' },
  { key: 'F_location', label: 'Location on Feature', column: 'F' },
  { key: 'G_betweenObjects', label: 'Between/Combination', column: 'G' },
  { key: 'H_specialInstructions', label: 'Special Instructions', column: 'H' },
];

export const ControlDescriptionPanel: React.FC<ControlDescriptionPanelProps> = ({
  selectedControl,
  allCourseElements,
  onUpdateDescription,
  onExportDescriptions,
  // onUpdateControlRadius prop removed
}) => {
  const [editingDescription, setEditingDescription] = useState<ControlDescriptionData | null>(null);

  useEffect(() => {
    if (selectedControl) {
      setEditingDescription(selectedControl.description);
    } else {
      setEditingDescription(null);
    }
  }, [selectedControl]);

  const handleInputChange = (key: keyof ControlDescriptionData, value: string) => {
    if (editingDescription && selectedControl) {
      const newDesc = { ...editingDescription, [key]: value };
      setEditingDescription(newDesc);
      onUpdateDescription(selectedControl.id, newDesc);
    }
  };
  
  const allControls = allCourseElements
    .filter(el => el.type === ElementType.CONTROL)
    .sort((a,b) => (a as ControlElement).number - (b as ControlElement).number) as ControlElement[];


  return (
    <div className="w-96 bg-gray-800 p-4 shadow-lg overflow-y-auto flex flex-col border-l border-gray-700">
      <h2 className="text-xl font-semibold mb-4 text-teal-400">Control Descriptions</h2>
      
      {selectedControl && editingDescription && (
        <div className="mb-6 p-3 border border-gray-700 rounded-md bg-gray-800">
          <h3 className="text-lg font-medium mb-3 text-teal-500">Edit Control {selectedControl.number} (Code: {selectedControl.description.B_code || 'N/A'})</h3>
          
          {/* Control Radius input removed */}

          {descriptionFields.map(({ key, label, column }) => (
            <div key={key} className="mb-2">
              <label htmlFor={key} className="block text-sm font-medium text-gray-300">
                Col {column}: {label}
              </label>
              <input
                type="text"
                id={key}
                name={key}
                readOnly={key === 'A_number'} 
                value={editingDescription[key]}
                onChange={(e) => handleInputChange(key, e.target.value)}
                className={`mt-1 block w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none sm:text-sm text-gray-200 placeholder-gray-500 ${key === 'A_number' ? 'bg-gray-600 cursor-not-allowed border-gray-600' : 'bg-gray-700 border-gray-600 focus:ring-teal-500 focus:border-teal-500'}`}
              />
            </div>
          ))}
        </div>
      )}
      {!selectedControl && (
         <p className="text-gray-400 mb-4">Select a control on the map to edit its description.</p>
      )}

      <div className="flex-grow overflow-x-auto">
        <h3 className="text-lg font-medium mb-2 text-teal-500">All Descriptions</h3>
        {allControls.length === 0 ? (
          <p className="text-gray-400">No controls placed yet.</p>
        ) : (
        <table className="min-w-full divide-y divide-gray-700 border border-gray-700">
          <thead className="bg-gray-700">
            <tr>
              {descriptionFields.map(f => (
                <th key={f.column} scope="col" className="px-3 py-2 text-left text-xs font-medium text-teal-400 uppercase tracking-wider">
                  {f.column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {allControls.map((control) => (
              <tr key={control.id} className={`${selectedControl?.id === control.id ? 'bg-gray-700' : ''}`}>
                {descriptionFields.map(f => (
                  <td key={f.key} className="px-3 py-2 whitespace-nowrap text-xs text-gray-300">
                    {control.description[f.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>
      <button
        onClick={onExportDescriptions}
        disabled={allControls.length === 0}
        className="mt-4 w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-opacity-50 disabled:bg-gray-600 disabled:cursor-not-allowed"
      >
        Export Descriptions (CSV)
      </button>
    </div>
  );
};