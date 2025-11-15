import React, { useCallback, useMemo, useState } from 'react';
import {
  CourseElement,
  ElementType,
  LegElement,
  ControlElement,
  StartElement,
  FinishElement,
  AreaElement,
  AreaKind,
} from '../types';
import { distance as geomDistance } from '../utils/geometry';
import { computeFastestPath, SpeedZone } from '../utils/pathfinding';
import { DEFAULT_CORRIDOR_SPEED_MULTIPLIER } from '../constants';

interface RouteAnalysisPanelProps {
  courseElements: CourseElement[];
  mapUnitsPerMeter: number | null;
  mapBounds: { width: number; height: number } | null;
  onUpdateAreaSpeedMultiplier: (areaId: string, multiplier: number) => void;
}

interface LegAnalysisRow {
  id: string;
  label: string;
  straightDistanceMeters: number | null;
  straightTimeSeconds: number | null;
  pathDistanceMeters: number | null;
  pathTimeSeconds: number | null;
  pathStatus: 'ok' | 'blocked' | 'unavailable';
}

const describeCourseElement = (element: CourseElement): string => {
  switch (element.type) {
    case ElementType.START:
      return 'Start';
    case ElementType.FINISH:
      return 'Finish';
    case ElementType.CONTROL:
      return `Control ${(element as ControlElement).number}`;
    default:
      return element.id.slice(0, 6);
  }
};

const formatDistance = (meters: number | null) => {
  if (meters == null) return '—';
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${meters.toFixed(0)} m`;
};

const formatDuration = (seconds: number | null) => {
  if (seconds == null) return '—';
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const formatDelta = (seconds: number | null) => {
  if (seconds == null) return '—';
  const rounded = Math.round(seconds);
  const sign = rounded > 0 ? '+' : '';
  const minutes = Math.floor(Math.abs(rounded) / 60);
  const remainder = Math.abs(rounded) % 60;
  return `${sign}${minutes}:${remainder.toString().padStart(2, '0')}`;
};

export const RouteAnalysisPanel: React.FC<RouteAnalysisPanelProps> = ({
  courseElements,
  mapUnitsPerMeter,
  mapBounds,
  onUpdateAreaSpeedMultiplier,
}) => {
  const [basePaceMinPerKm, setBasePaceMinPerKm] = useState<number>(6);
  const [offTrailMultiplier, setOffTrailMultiplier] = useState<number>(1.2);

  const areaElements = useMemo(
    () => courseElements.filter(el => el.type === ElementType.AREA) as AreaElement[],
    [courseElements],
  );
  const corridorAreas = useMemo(
    () => areaElements.filter(area => area.kind === AreaKind.CORRIDOR),
    [areaElements],
  );

  const elementById = useMemo(
    () => new Map(courseElements.map(el => [el.id, el])),
    [courseElements],
  );

  const baseTimePerMeter = useMemo(() => (basePaceMinPerKm * 60) / 1000, [basePaceMinPerKm]);

  const computeLegAnalysis = useCallback(
    (leg: LegElement): LegAnalysisRow => {
      const fromElement = elementById.get(leg.fromElementId);
      const toElement = elementById.get(leg.toElementId);

      let straightDistanceMeters: number | null = null;
      let straightTimeSeconds: number | null = null;
      let pathDistanceMeters: number | null = null;
      let pathTimeSeconds: number | null = null;
      let pathStatus: LegAnalysisRow['pathStatus'] = 'unavailable';

      if (
        mapUnitsPerMeter &&
        mapUnitsPerMeter > 0 &&
        fromElement &&
        toElement &&
        'center' in fromElement &&
        'center' in toElement
      ) {
        const fromCenter = (fromElement as StartElement | ControlElement | FinishElement).center;
        const toCenter = (toElement as StartElement | ControlElement | FinishElement).center;

        const straightDistanceMapUnits = geomDistance(fromCenter, toCenter);
        straightDistanceMeters = straightDistanceMapUnits / mapUnitsPerMeter;
        straightTimeSeconds = straightDistanceMeters * baseTimePerMeter * offTrailMultiplier;

        const speedZones: SpeedZone[] = areaElements
          .filter(area => area.points.length >= 3)
          .map(area => {
            if (area.kind === AreaKind.FORBIDDEN) {
              return { polygon: area.points, multiplier: offTrailMultiplier, impassable: true };
            }
            return {
              polygon: area.points,
              multiplier:
                typeof area.speedMultiplier === 'number'
                  ? area.speedMultiplier
                  : DEFAULT_CORRIDOR_SPEED_MULTIPLIER,
            };
          });

        const result = computeFastestPath({
          start: fromCenter,
          goal: toCenter,
          mapUnitsPerMeter,
          baseTimePerMeter,
          defaultMultiplier: offTrailMultiplier,
          speedZones,
          mapBounds,
        });

        if (result.success) {
          pathStatus = 'ok';
          pathDistanceMeters = result.distanceMeters;
          pathTimeSeconds = result.timeSeconds;
        } else {
          pathStatus = 'blocked';
        }
      }

      const label = `${fromElement ? describeCourseElement(fromElement) : 'Unknown'} → ${
        toElement ? describeCourseElement(toElement) : 'Unknown'
      }`;

      return {
        id: leg.id,
        label,
        straightDistanceMeters,
        straightTimeSeconds,
        pathDistanceMeters,
        pathTimeSeconds,
        pathStatus,
      };
    },
    [areaElements, baseTimePerMeter, elementById, mapBounds, mapUnitsPerMeter, offTrailMultiplier],
  );

  const legRows = useMemo(() => {
    if (!mapUnitsPerMeter || mapUnitsPerMeter <= 0) {
      return [];
    }

    return courseElements
      .filter(el => el.type === ElementType.LEG)
      .map(el => computeLegAnalysis(el as LegElement));
  }, [computeLegAnalysis, courseElements, mapUnitsPerMeter]);

  const totals = useMemo(() => {
    if (legRows.length === 0) {
      return {
        straightDistanceMeters: null,
        pathDistanceMeters: null,
        straightTimeSeconds: null,
        pathTimeSeconds: null,
      };
    }

    let straightDistance = 0;
    let pathDistance = 0;
    let straightTime = 0;
    let pathTime = 0;
    let hasStraightDistance = false;
    let hasPathDistance = false;
    let hasStraightTime = false;
    let hasPathTime = false;

    legRows.forEach(row => {
      if (row.straightDistanceMeters != null) {
        straightDistance += row.straightDistanceMeters;
        hasStraightDistance = true;
      }
      if (row.pathDistanceMeters != null) {
        pathDistance += row.pathDistanceMeters;
        hasPathDistance = true;
      }
      if (row.straightTimeSeconds != null) {
        straightTime += row.straightTimeSeconds;
        hasStraightTime = true;
      }
      if (row.pathTimeSeconds != null) {
        pathTime += row.pathTimeSeconds;
        hasPathTime = true;
      }
    });

    return {
      straightDistanceMeters: hasStraightDistance ? straightDistance : null,
      pathDistanceMeters: hasPathDistance ? pathDistance : null,
      straightTimeSeconds: hasStraightTime ? straightTime : null,
      pathTimeSeconds: hasPathTime ? pathTime : null,
    };
  }, [legRows]);

  const handleAreaSpeedChange = useCallback(
    (area: AreaElement, multiplier: number) => {
      const sanitized = Number.isFinite(multiplier) ? Math.max(0.3, Math.min(3, multiplier)) : DEFAULT_CORRIDOR_SPEED_MULTIPLIER;
      onUpdateAreaSpeedMultiplier(area.id, sanitized);
    },
    [onUpdateAreaSpeedMultiplier],
  );

  const scaleMissing = !mapUnitsPerMeter || mapUnitsPerMeter <= 0;

  return (
    <div className="border-t border-gray-800 bg-gray-900 p-4 text-sm text-gray-200">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-teal-400">Route Insights</h2>
        <span className="text-xs uppercase tracking-wide text-gray-500">Pathfinding + speed layers</span>
      </div>

      <p className="text-xs text-gray-400 mb-4">
        Draw corridors to mark runnable lines, sketch forbidden areas to block travel, then calibrate the sliders below. We run a
        weighted A* search on each leg to estimate realistic travel time from your scanned or photographed map.
      </p>

      <div className="space-y-3 mb-6">
        <label className="block">
          <span className="text-xs uppercase text-gray-400">Base pace (min/km)</span>
          <input
            type="number"
            min={3}
            max={15}
            step={0.1}
            value={basePaceMinPerKm}
            onChange={(event) => setBasePaceMinPerKm(Math.max(0.1, Number(event.target.value) || 0))}
            className="mt-1 w-full rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </label>

        <label className="block">
          <span className="text-xs uppercase text-gray-400">Off-trail slowdown (×)</span>
          <input
            type="range"
            min={0.8}
            max={2}
            step={0.05}
            value={offTrailMultiplier}
            onChange={(event) => setOffTrailMultiplier(Number(event.target.value))}
            className="mt-1 w-full"
          />
          <div className="text-xs text-gray-400 mt-1">{offTrailMultiplier.toFixed(2)}× baseline</div>
        </label>
      </div>

      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">Speed layers</h3>
          <span className="text-[10px] uppercase text-gray-500">Corridors = fast lanes</span>
        </div>
        {corridorAreas.length === 0 ? (
          <div className="rounded border border-gray-800 bg-gray-900 p-3 text-xs text-gray-300">
            Draw a corridor area with the toolbar to add your first speed layer.
          </div>
        ) : (
          <div className="space-y-2">
            {corridorAreas.map((area, index) => (
              <div key={area.id} className="rounded border border-gray-800 bg-gray-900 px-3 py-2">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                  <span>Corridor {index + 1}</span>
                  <button
                    type="button"
                    className="text-[10px] uppercase tracking-wide text-teal-300 hover:text-teal-200"
                    onClick={() => handleAreaSpeedChange(area, DEFAULT_CORRIDOR_SPEED_MULTIPLIER)}
                  >
                    Reset
                  </button>
                </div>
                <input
                  type="range"
                  min={0.4}
                  max={1.4}
                  step={0.05}
                  value={typeof area.speedMultiplier === 'number' ? area.speedMultiplier : DEFAULT_CORRIDOR_SPEED_MULTIPLIER}
                  onChange={(event) => handleAreaSpeedChange(area, Number(event.target.value))}
                  className="w-full"
                />
                <div className="text-[11px] text-gray-300 mt-1">
                  {((typeof area.speedMultiplier === 'number' ? area.speedMultiplier : DEFAULT_CORRIDOR_SPEED_MULTIPLIER)).toFixed(2)}× of base pace
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {scaleMissing ? (
        <div className="rounded border border-yellow-600 bg-yellow-900 bg-opacity-30 p-3 text-yellow-200 text-xs">
          Set the map scale first to unlock leg-by-leg metrics from your uploaded photo.
        </div>
      ) : legRows.length === 0 ? (
        <div className="rounded border border-gray-800 bg-gray-900 p-3 text-gray-300 text-xs">
          Add legs to see pathfinding summaries.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="max-h-64 overflow-y-auto border border-gray-800 rounded">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-gray-800 text-gray-300 uppercase tracking-wide">
                <tr>
                  <th className="px-3 py-2 font-semibold">Leg</th>
                  <th className="px-3 py-2 font-semibold">Straight</th>
                  <th className="px-3 py-2 font-semibold">Fastest path</th>
                  <th className="px-3 py-2 font-semibold">Δ vs straight</th>
                </tr>
              </thead>
              <tbody>
                {legRows.map((row) => {
                  const deltaSeconds =
                    row.pathStatus === 'ok' && row.pathTimeSeconds != null && row.straightTimeSeconds != null
                      ? row.pathTimeSeconds - row.straightTimeSeconds
                      : null;

                  return (
                    <tr key={row.id} className="odd:bg-gray-900 even:bg-gray-800">
                      <td className="px-3 py-2 text-gray-200">{row.label}</td>
                      <td className="px-3 py-2 text-gray-300">
                        {formatDistance(row.straightDistanceMeters)}
                        <div className="text-[11px] text-gray-500">{formatDuration(row.straightTimeSeconds)}</div>
                      </td>
                      <td className="px-3 py-2 text-gray-300">
                        {row.pathStatus === 'blocked'
                          ? <span className="text-red-300">Blocked</span>
                          : row.pathStatus === 'unavailable'
                            ? '—'
                            : (
                              <>
                                {formatDistance(row.pathDistanceMeters)}
                                <div className="text-[11px] text-teal-300">{formatDuration(row.pathTimeSeconds)}</div>
                              </>
                            )}
                      </td>
                      <td className="px-3 py-2 text-gray-300">
                        {row.pathStatus === 'ok' ? formatDelta(deltaSeconds) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded border border-gray-800 bg-gray-900 px-3 py-2">
              <div className="text-gray-400 uppercase tracking-wide">Straight-line</div>
              <div className="text-gray-200">{formatDistance(totals.straightDistanceMeters)}</div>
              <div className="text-gray-500">{formatDuration(totals.straightTimeSeconds)}</div>
            </div>
            <div className="rounded border border-gray-800 bg-gray-900 px-3 py-2 text-right">
              <div className="text-gray-400 uppercase tracking-wide">Fastest path</div>
              <div className="text-teal-300">{formatDistance(totals.pathDistanceMeters)}</div>
              <div className="text-teal-200">{formatDuration(totals.pathTimeSeconds)}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RouteAnalysisPanel;
