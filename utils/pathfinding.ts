import { Point } from '../types';
import { distance, isPointInPolygon } from './geometry';

export interface SpeedZone {
  polygon: Point[];
  multiplier: number;
  impassable?: boolean;
}

export interface PathfindingOptions {
  start: Point;
  goal: Point;
  mapUnitsPerMeter: number;
  baseTimePerMeter: number;
  defaultMultiplier: number;
  speedZones: SpeedZone[];
  padding?: number;
  mapBounds?: { width: number; height: number } | null;
}

export interface PathfindingResult {
  success: boolean;
  path: Point[];
  distanceMeters: number;
  timeSeconds: number;
}

const GRID_LONG_SIDE_STEPS = 70;
const GRID_MIN_STEPS = 18;
const GRID_MAX_STEPS = 110;

interface GridCell {
  multiplier: number;
  walkable: boolean;
}

const coordKey = (col: number, row: number) => `${col},${row}`;

export const computeFastestPath = (options: PathfindingOptions): PathfindingResult => {
  const {
    start,
    goal,
    mapUnitsPerMeter,
    baseTimePerMeter,
    defaultMultiplier,
    speedZones,
    padding = 120,
    mapBounds,
  } = options;

  if (mapUnitsPerMeter <= 0) {
    return { success: false, path: [], distanceMeters: 0, timeSeconds: 0 };
  }

  const directDistanceMapUnits = distance(start, goal);
  const dynamicPadding = Math.max(padding, directDistanceMapUnits * 0.35);

  let minX = Math.min(start.x, goal.x) - dynamicPadding;
  let minY = Math.min(start.y, goal.y) - dynamicPadding;
  let maxX = Math.max(start.x, goal.x) + dynamicPadding;
  let maxY = Math.max(start.y, goal.y) + dynamicPadding;

  if (mapBounds) {
    minX = Math.max(0, minX);
    minY = Math.max(0, minY);
    maxX = Math.min(mapBounds.width, maxX);
    maxY = Math.min(mapBounds.height, maxY);
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  const longestSide = Math.max(width, height);
  const approximateCellSize = longestSide / GRID_LONG_SIDE_STEPS;
  const cols = Math.max(GRID_MIN_STEPS, Math.min(GRID_MAX_STEPS, Math.ceil(width / approximateCellSize)));
  const rows = Math.max(GRID_MIN_STEPS, Math.min(GRID_MAX_STEPS, Math.ceil(height / approximateCellSize)));

  const cellWidth = width / cols;
  const cellHeight = height / rows;

  const cellMultiplierCache: GridCell[] = new Array(cols * rows);

  const getMultiplierForPoint = (point: Point): GridCell => {
    let multiplier = defaultMultiplier;
    let walkable = true;

    for (const zone of speedZones) {
      if (zone.polygon.length < 3) continue;
      if (isPointInPolygon(point, zone.polygon)) {
        if (zone.impassable) {
          walkable = false;
          multiplier = defaultMultiplier;
          break;
        }
        multiplier = zone.multiplier;
        break;
      }
    }

    return { multiplier, walkable };
  };

  const getCell = (col: number, row: number): GridCell => {
    const index = row * cols + col;
    let cell = cellMultiplierCache[index];
    if (!cell) {
      const center: Point = {
        x: minX + (col + 0.5) * cellWidth,
        y: minY + (row + 0.5) * cellHeight,
      };
      cell = getMultiplierForPoint(center);
      cellMultiplierCache[index] = cell;
    }
    return cell;
  };

  const toCol = (x: number) => Math.max(0, Math.min(cols - 1, Math.floor((x - minX) / cellWidth)));
  const toRow = (y: number) => Math.max(0, Math.min(rows - 1, Math.floor((y - minY) / cellHeight)));

  const startCol = toCol(start.x);
  const startRow = toRow(start.y);
  const goalCol = toCol(goal.x);
  const goalRow = toRow(goal.y);

  const startCell = getCell(startCol, startRow);
  const goalCell = getCell(goalCol, goalRow);

  if (!startCell.walkable || !goalCell.walkable) {
    return { success: false, path: [], distanceMeters: 0, timeSeconds: 0 };
  }

  const lowestMultiplier = Math.min(
    defaultMultiplier,
    ...speedZones.filter(z => !z.impassable).map(z => z.multiplier),
  );

  const openSet: Array<{ key: string; fScore: number }> = [];
  const startKey = coordKey(startCol, startRow);
  openSet.push({ key: startKey, fScore: 0 });

  const cameFrom = new Map<string, string | null>();
  const gScore = new Map<string, number>();
  const distanceScore = new Map<string, number>();

  gScore.set(startKey, 0);
  distanceScore.set(startKey, 0);
  cameFrom.set(startKey, null);

  const neighborOffsets = [
    [-1, -1],
    [0, -1],
    [1, -1],
    [-1, 0],
    [1, 0],
    [-1, 1],
    [0, 1],
    [1, 1],
  ];

  const heuristic = (col: number, row: number) => {
    const dx = Math.abs(col - goalCol) * cellWidth;
    const dy = Math.abs(row - goalRow) * cellHeight;
    const linearDistance = Math.sqrt(dx * dx + dy * dy) / mapUnitsPerMeter;
    return linearDistance * baseTimePerMeter * lowestMultiplier;
  };

  const pushOpenSet = (key: string, fScore: number) => {
    const existing = openSet.find(entry => entry.key === key);
    if (existing) {
      existing.fScore = fScore;
    } else {
      openSet.push({ key, fScore });
    }
    openSet.sort((a, b) => a.fScore - b.fScore);
  };

  const goalKey = coordKey(goalCol, goalRow);

  while (openSet.length > 0) {
    const current = openSet.shift();
    if (!current) break;
    const currentKey = current.key;
    if (currentKey === goalKey) {
      break;
    }

    const [currentColStr, currentRowStr] = currentKey.split(',');
    const currentCol = Number(currentColStr);
    const currentRow = Number(currentRowStr);

    for (const [dx, dy] of neighborOffsets) {
      const neighborCol = currentCol + dx;
      const neighborRow = currentRow + dy;
      if (neighborCol < 0 || neighborCol >= cols || neighborRow < 0 || neighborRow >= rows) {
        continue;
      }

      const neighborCell = getCell(neighborCol, neighborRow);
      if (!neighborCell.walkable) continue;

      const neighborKey = coordKey(neighborCol, neighborRow);
      const stepDistanceMapUnits = Math.sqrt(
        (dx * cellWidth) ** 2 +
        (dy * cellHeight) ** 2,
      );
      const stepDistanceMeters = stepDistanceMapUnits / mapUnitsPerMeter;
      const stepTime = stepDistanceMeters * baseTimePerMeter * neighborCell.multiplier;

      const tentativeGScore = (gScore.get(currentKey) ?? Infinity) + stepTime;
      if (tentativeGScore >= (gScore.get(neighborKey) ?? Infinity)) {
        continue;
      }

      cameFrom.set(neighborKey, currentKey);
      gScore.set(neighborKey, tentativeGScore);
      const currentDistance = distanceScore.get(currentKey) ?? 0;
      distanceScore.set(neighborKey, currentDistance + stepDistanceMeters);

      const estimatedFScore = tentativeGScore + heuristic(neighborCol, neighborRow);
      pushOpenSet(neighborKey, estimatedFScore);
    }
  }

  if (!cameFrom.has(goalKey)) {
    return { success: false, path: [], distanceMeters: 0, timeSeconds: 0 };
  }

  const path: Point[] = [];
  let traversalKey: string | undefined = goalKey;
  while (traversalKey) {
    const [colStr, rowStr] = traversalKey.split(',');
    const col = Number(colStr);
    const row = Number(rowStr);
    path.push({
      x: minX + (col + 0.5) * cellWidth,
      y: minY + (row + 0.5) * cellHeight,
    });
    traversalKey = cameFrom.get(traversalKey) ?? undefined;
  }

  path.reverse();
  if (path.length > 0) {
    path[0] = start;
    path[path.length - 1] = goal;
  }

  const totalDistanceMeters =
    distanceScore.get(goalKey) ?? distance(start, goal) / mapUnitsPerMeter;

  const startCellCenter: Point = {
    x: minX + (startCol + 0.5) * cellWidth,
    y: minY + (startRow + 0.5) * cellHeight,
  };
  const goalCellCenter: Point = {
    x: minX + (goalCol + 0.5) * cellWidth,
    y: minY + (goalRow + 0.5) * cellHeight,
  };

  const startAdjustmentMeters = distance(start, startCellCenter) / mapUnitsPerMeter;
  const goalAdjustmentMeters = distance(goal, goalCellCenter) / mapUnitsPerMeter;
  const startMultiplier = getCell(startCol, startRow).multiplier;
  const goalMultiplier = getCell(goalCol, goalRow).multiplier;

  const adjustmentTime =
    (startAdjustmentMeters * baseTimePerMeter * startMultiplier) +
    (goalAdjustmentMeters * baseTimePerMeter * goalMultiplier);

  const goalTime = (gScore.get(goalKey) ?? 0) + adjustmentTime;
  const goalDistance =
    totalDistanceMeters + startAdjustmentMeters + goalAdjustmentMeters;

  return {
    success: true,
    path,
    distanceMeters: goalDistance,
    timeSeconds: goalTime,
  };
};

