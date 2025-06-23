
import { Point, StartElement, ControlElement, FinishElement, AreaElement, CourseElement, ElementType, LegElement } from '../types';
import { BASE_START_SIZE_MAP_UNITS, BASE_CONTROL_RADIUS_MAP_UNITS, BASE_FINISH_OUTER_RADIUS_MAP_UNITS } from '../constants';


export const distance = (p1: Point, p2: Point): number => {
  return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

export const isPointInCircle = (point: Point, center: Point, radius: number): boolean => {
  return distance(point, center) <= radius;
};

export const isPointInStartTriangle = (point: Point, elementCenter: Point, currentElementSize: number, clickTolerance: number): boolean => {
  const effectiveClickRadius = currentElementSize * 0.4 + clickTolerance;
  return isPointInCircle(point, elementCenter, effectiveClickRadius);
};

export const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
  let wn = 0; 
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];
    if (p1.y <= point.y) {
      if (p2.y > point.y && isLeft(p1, p2, point) > 0) {
        wn++;
      }
    } else {
      if (p2.y <= point.y && isLeft(p1, p2, point) < 0) {
        wn--;
      }
    }
  }
  return wn !== 0;
};

const isLeft = (P0: Point, P1: Point, P2: Point): number => {
  return (P1.x - P0.x) * (P2.y - P0.y) - (P2.x - P0.x) * (P1.y - P0.y);
};

export const distToSegmentSquared = (p: Point, v: Point, w: Point): number => {
  const l2 = distance(v, w) ** 2;
  if (l2 === 0) return distance(p, v) ** 2;
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return distance(p, { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) }) ** 2;
};

export const isPointOnLeg = (point: Point, from: Point, to: Point, threshold: number = 5): boolean => {
  return Math.sqrt(distToSegmentSquared(point, from, to)) <= threshold;
};


export const getElementAtPoint = (
  mapPoint: Point,
  elements: CourseElement[],
  mapScale: number, 
  allCourseElementsForLegResolution: CourseElement[],
  startSymbolScaleUI: number,    // New param
  controlSymbolScaleUI: number,  // New param
  finishSymbolScaleUI: number    // New param
): CourseElement | null => {
  const clickTolerance = 5 / mapScale; 

  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.type === ElementType.CONTROL) {
      const currentControlRadius = BASE_CONTROL_RADIUS_MAP_UNITS * (controlSymbolScaleUI / 5.0);
      if (isPointInCircle(mapPoint, el.center, currentControlRadius + clickTolerance)) return el;
    } else if (el.type === ElementType.START) {
      const currentStartSize = BASE_START_SIZE_MAP_UNITS * (startSymbolScaleUI / 5.0);
      if (isPointInStartTriangle(mapPoint, el.center, currentStartSize, clickTolerance)) return el;
    } else if (el.type === ElementType.FINISH) {
      const currentFinishOuterRadius = BASE_FINISH_OUTER_RADIUS_MAP_UNITS * (finishSymbolScaleUI / 5.0);
      if (isPointInCircle(mapPoint, el.center, currentFinishOuterRadius + clickTolerance)) return el;
    }
  }
  
   for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.type === ElementType.AREA) {
      if (isPointInPolygon(mapPoint, el.points)) return el;
    }
  }

  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.type === ElementType.LEG) {
      const leg = el as LegElement;
      const fromElement = allCourseElementsForLegResolution.find(e => e.id === leg.fromElementId);
      const toElement = allCourseElementsForLegResolution.find(e => e.id === leg.toElementId);
      
      if (fromElement && 'center' in fromElement && toElement && 'center' in toElement) {
        const fromCenter = (fromElement as StartElement | ControlElement | FinishElement).center;
        const toCenter = (toElement as StartElement | ControlElement | FinishElement).center;
        if (isPointOnLeg(mapPoint, fromCenter, toCenter, clickTolerance)) return el;
      }
    }
  }
  return null;
};

export const getAdjustedPointAlongVector = (startPoint: Point, endPoint: Point, adjustmentDistance: number): Point => {
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const currentDist = Math.sqrt(dx * dx + dy * dy);

  if (currentDist === 0) return startPoint; 

  const moveX = (dx / currentDist) * adjustmentDistance;
  const moveY = (dy / currentDist) * adjustmentDistance;

  return {
    x: startPoint.x + moveX,
    y: startPoint.y + moveY,
  };
};