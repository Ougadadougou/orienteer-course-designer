
import React, { useRef, useEffect, useCallback } from 'react';
import {
  Point,
  MapTransform,
  CourseElement,
  ElementType,
  StartElement,
  ControlElement,
  FinishElement,
  LegElement,
  AreaElement,
  AreaKind,
  Tool
} from '../types';
import {
  IOF_PURPLE,
  IOF_RED_FORBIDDEN,
  SELECTED_ELEMENT_COLOR,
  TEMP_AREA_POINT_RADIUS,
  TEMP_AREA_LINE_COLOR,
  AREA_CORRIDOR_FILL,
  AREA_STROKE_COLOR,
  LEG_CONNECTION_GAP,
  BASE_START_SIZE_MAP_UNITS,
  BASE_CONTROL_RADIUS_MAP_UNITS,
  BASE_FINISH_OUTER_RADIUS_MAP_UNITS,
  FINISH_INNER_RADIUS_PROPORTION,
  SYMBOL_BASE_LINE_WIDTH_MAP_UNITS,
  LEG_BASE_LINE_WIDTH_MAP_UNITS,
  CONTROL_NUMBER_BASE_FONT_SIZE_MAP_UNITS,
  TEXT_GAP_ABOVE_CONTROL_MAP_UNITS, 
} from '../constants';
import { getAdjustedPointAlongVector } from '../utils/geometry';

// Helper to get visual properties of connectable elements based on current UI scales
const getConnectableElementVisuals = (
    elementId: string, 
    allElements: CourseElement[],
    startSymbolScaleUI: number,
    controlSymbolScaleUI: number,
    finishSymbolScaleUI: number
): { center: Point; effectiveRadius: number; type: ElementType } | null => {
    const element = allElements.find(el => el.id === elementId);
    if (!element) return null;

    let currentSizeOrRadiusMapUnits: number;
    if (element.type === ElementType.START) {
        currentSizeOrRadiusMapUnits = BASE_START_SIZE_MAP_UNITS * (startSymbolScaleUI / 5.0);
        const effectiveRadius = (currentSizeOrRadiusMapUnits * Math.sqrt(3)) / 6; 
        return { center: element.center, effectiveRadius, type: element.type }; 
    } else if (element.type === ElementType.CONTROL) {
        currentSizeOrRadiusMapUnits = BASE_CONTROL_RADIUS_MAP_UNITS * (controlSymbolScaleUI / 5.0);
        return { center: element.center, effectiveRadius: currentSizeOrRadiusMapUnits, type: element.type };
    } else if (element.type === ElementType.FINISH) {
        currentSizeOrRadiusMapUnits = BASE_FINISH_OUTER_RADIUS_MAP_UNITS * (finishSymbolScaleUI / 5.0);
        return { center: element.center, effectiveRadius: currentSizeOrRadiusMapUnits, type: element.type };
    }
    return null;
};

export const drawCourseElementOnContext = (
  ctx: CanvasRenderingContext2D,
  element: CourseElement,
  isSelected: boolean,
  allCourseElements: CourseElement[], 
  featureDisplayScale: number, // This is mapTransform.scale (current map zoom)
  startSymbolScaleUI: number,
  controlSymbolScaleUI: number,
  finishSymbolScaleUI: number
) => {
  ctx.strokeStyle = isSelected ? SELECTED_ELEMENT_COLOR : IOF_PURPLE; 
  ctx.fillStyle = IOF_PURPLE; 
  
  const baseSymbolOutlineWidthMapUnits = SYMBOL_BASE_LINE_WIDTH_MAP_UNITS;
  let scaledSymbolOutlineWidthMapUnits: number;

  switch (element.type) {
    case ElementType.START:
      const start = element as StartElement;
      const currentStartSizeMapUnits = BASE_START_SIZE_MAP_UNITS * (startSymbolScaleUI / 5.0);
      scaledSymbolOutlineWidthMapUnits = baseSymbolOutlineWidthMapUnits * (startSymbolScaleUI / 5.0);
      ctx.lineWidth = Math.max(0.5, scaledSymbolOutlineWidthMapUnits / featureDisplayScale);
      
      const h = (Math.sqrt(3) / 2) * currentStartSizeMapUnits; 
      const rotation = start.rotationAngle || 0;
      const p1_local = { x: 0, y: -(2 / 3) * h }, p2_local = { x: -currentStartSizeMapUnits / 2, y: (1 / 3) * h }, p3_local = { x: currentStartSizeMapUnits / 2, y: (1 / 3) * h };
      const cosR = Math.cos(rotation), sinR = Math.sin(rotation);
      const p1 = { x: start.center.x + (p1_local.x * cosR - p1_local.y * sinR), y: start.center.y + (p1_local.x * sinR + p1_local.y * cosR) };
      const p2 = { x: start.center.x + (p2_local.x * cosR - p2_local.y * sinR), y: start.center.y + (p2_local.x * sinR + p2_local.y * cosR) };
      const p3 = { x: start.center.x + (p3_local.x * cosR - p3_local.y * sinR), y: start.center.y + (p3_local.x * sinR + p3_local.y * cosR) };
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.closePath(); ctx.stroke(); 
      break;

    case ElementType.CONTROL:
      const control = element as ControlElement;
      const currentControlRadiusMapUnits = BASE_CONTROL_RADIUS_MAP_UNITS * (controlSymbolScaleUI / 5.0);
      scaledSymbolOutlineWidthMapUnits = baseSymbolOutlineWidthMapUnits * (controlSymbolScaleUI / 5.0);
      ctx.lineWidth = Math.max(0.5, scaledSymbolOutlineWidthMapUnits / featureDisplayScale);

      ctx.beginPath(); ctx.arc(control.center.x, control.center.y, currentControlRadiusMapUnits, 0, 2 * Math.PI); ctx.stroke(); 
      
      const currentControlNumberFontSizeMapUnits = CONTROL_NUMBER_BASE_FONT_SIZE_MAP_UNITS * (controlSymbolScaleUI / 5.0);
      const fontSizeForControlNumberOnScreen = Math.max(6, currentControlNumberFontSizeMapUnits / featureDisplayScale);
      ctx.font = `${fontSizeForControlNumberOnScreen}px Arial`; 
      ctx.fillStyle = IOF_PURPLE; 
      ctx.textAlign = 'center'; 
      ctx.textBaseline = 'bottom'; 

      const currentTextGapMapUnits = TEXT_GAP_ABOVE_CONTROL_MAP_UNITS * (controlSymbolScaleUI / 5.0);
      const textY = control.center.y - currentControlRadiusMapUnits - currentTextGapMapUnits;
      
      ctx.fillText('' + control.number, control.center.x, textY);
      break;

    case ElementType.FINISH:
      const finish = element as FinishElement;
      const currentFinishOuterRadiusMapUnits = BASE_FINISH_OUTER_RADIUS_MAP_UNITS * (finishSymbolScaleUI / 5.0);
      const currentFinishInnerRadiusMapUnits = currentFinishOuterRadiusMapUnits * FINISH_INNER_RADIUS_PROPORTION;
      scaledSymbolOutlineWidthMapUnits = baseSymbolOutlineWidthMapUnits * (finishSymbolScaleUI / 5.0);
      ctx.lineWidth = Math.max(0.5, scaledSymbolOutlineWidthMapUnits / featureDisplayScale);
      
      ctx.beginPath(); ctx.arc(finish.center.x, finish.center.y, currentFinishOuterRadiusMapUnits, 0, 2 * Math.PI); ctx.stroke(); 
      ctx.beginPath(); ctx.arc(finish.center.x, finish.center.y, currentFinishInnerRadiusMapUnits, 0, 2 * Math.PI); ctx.stroke(); 
      break;

    case ElementType.LEG:
      const leg = element as LegElement;
      const fromVisuals = getConnectableElementVisuals(leg.fromElementId, allCourseElements, startSymbolScaleUI, controlSymbolScaleUI, finishSymbolScaleUI);
      const toVisuals = getConnectableElementVisuals(leg.toElementId, allCourseElements, startSymbolScaleUI, controlSymbolScaleUI, finishSymbolScaleUI);

      if (fromVisuals && toVisuals) {
        const scaledLegConnectionGap = LEG_CONNECTION_GAP * (controlSymbolScaleUI / 5.0); 
        const startDrawPoint = getAdjustedPointAlongVector(fromVisuals.center, toVisuals.center, fromVisuals.effectiveRadius + scaledLegConnectionGap);
        const endDrawPoint = getAdjustedPointAlongVector(toVisuals.center, fromVisuals.center, toVisuals.effectiveRadius + scaledLegConnectionGap);
        
        const currentLegBaseLineWidthMapUnits = LEG_BASE_LINE_WIDTH_MAP_UNITS * (controlSymbolScaleUI / 5.0); 
        const legLineWidthOnScreen = Math.max(0.5, (isSelected ? currentLegBaseLineWidthMapUnits + 0.5 : currentLegBaseLineWidthMapUnits) / featureDisplayScale);
        
        ctx.lineWidth = legLineWidthOnScreen; 
        ctx.beginPath();
        ctx.moveTo(startDrawPoint.x, startDrawPoint.y); ctx.lineTo(endDrawPoint.x, endDrawPoint.y);
        
        const baseDashSegmentMapUnits = 5 * (controlSymbolScaleUI / 5.0); 
        const dashSegmentOnScreen = Math.max(1, baseDashSegmentMapUnits / featureDisplayScale);

        if (leg.style === 'dashed') ctx.setLineDash([dashSegmentOnScreen, dashSegmentOnScreen]);
        else if (leg.style === 'uncrossable') { 
            const uncrossableLineWidthMapUnits = (LEG_BASE_LINE_WIDTH_MAP_UNITS + 1) * (controlSymbolScaleUI / 5.0); // Assuming +1 map unit for uncrossable base
            ctx.lineWidth = Math.max(0.7, uncrossableLineWidthMapUnits / featureDisplayScale); 
        }
        
        ctx.stroke(); ctx.setLineDash([]);
      }
      break;

    case ElementType.AREA:
      const area = element as AreaElement;
      if (area.points.length < 2) break;
      ctx.beginPath(); ctx.moveTo(area.points[0].x, area.points[0].y);
      for (let i = 1; i < area.points.length; i++) ctx.lineTo(area.points[i].x, area.points[i].y);
      ctx.closePath();
      ctx.fillStyle = area.kind === AreaKind.FORBIDDEN ? IOF_RED_FORBIDDEN : AREA_CORRIDOR_FILL;
      ctx.fill(); 
      ctx.strokeStyle = isSelected ? SELECTED_ELEMENT_COLOR : AREA_STROKE_COLOR;
      ctx.lineWidth = Math.max(0.3, 0.5 / featureDisplayScale); 
      ctx.stroke();
      break;
  }
};

interface MapDisplayProps {
  mapMediaToRender: HTMLCanvasElement | HTMLImageElement | null;
  mapTransform: MapTransform;
  courseElements: CourseElement[]; 
  selectedElementId: string | null;
  onCanvasMouseDown: (mapPoint: Point, event: React.MouseEvent<HTMLCanvasElement>) => void;
  onCanvasMouseMove: (mapPoint: Point, event: React.MouseEvent<HTMLCanvasElement>) => void;
  onCanvasMouseUp: (mapPoint: Point, event: React.MouseEvent<HTMLCanvasElement>) => void;
  onCanvasWheel: (event: WheelEvent) => void;
  drawingPoints: Point[];
  currentTool: Tool;
  currentMouseMapPos: Point | null;
  isDragging: boolean;
  isMeasuringRefLine: boolean; 
  refLinePoints: Point[]; 
  startSymbolScaleUI: number;
  controlSymbolScaleUI: number;
  finishSymbolScaleUI: number;
}

export const MapDisplay: React.FC<MapDisplayProps> = ({
  mapMediaToRender, mapTransform, courseElements, selectedElementId,
  onCanvasMouseDown, onCanvasMouseMove, onCanvasMouseUp, onCanvasWheel,
  drawingPoints, currentTool, currentMouseMapPos, isDragging,
  isMeasuringRefLine, refLinePoints,
  startSymbolScaleUI, controlSymbolScaleUI, finishSymbolScaleUI 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getMapCoords = useCallback((event: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current; if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect(); 
    return {
      x: (event.clientX - rect.left - mapTransform.offset.x) / mapTransform.scale,
      y: (event.clientY - rect.top - mapTransform.offset.y) / mapTransform.scale,
    };
  }, [mapTransform]);

  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => onCanvasMouseDown(getMapCoords(event), event);
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => onCanvasMouseMove(getMapCoords(event), event);
  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => onCanvasMouseUp(getMapCoords(event), event);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const handleWheel = (e: WheelEvent) => onCanvasWheel(e);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [onCanvasWheel]);

  const drawTemporaryArea = (ctx: CanvasRenderingContext2D, points: Point[], previewPoint: Point | null) => {
    if (points.length === 0) return;
    ctx.fillStyle = TEMP_AREA_LINE_COLOR; ctx.strokeStyle = TEMP_AREA_LINE_COLOR; 
    const tempPointRadiusOnScreen = Math.max(1, TEMP_AREA_POINT_RADIUS);
    const tempLineWidthOnScreen = Math.max(0.5, 1); 
    ctx.lineWidth = tempLineWidthOnScreen;
    points.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, tempPointRadiusOnScreen / mapTransform.scale, 0, 2 * Math.PI); ctx.fill();
    });
    if (points.length > 0) {
        ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y);
        for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
        if (previewPoint) ctx.lineTo(previewPoint.x, previewPoint.y);
        ctx.stroke();
    }
  };

  const drawReferenceLine = (ctx: CanvasRenderingContext2D, points: Point[], previewPoint: Point | null) => {
    if (points.length === 0 && !previewPoint) return;
    
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 255, 0, 0.9)'; 
    const refLineWidthOnScreen = Math.max(1, 2 / mapTransform.scale); // Kept screen-relative for distinctness
    ctx.lineWidth = refLineWidthOnScreen;
    ctx.setLineDash([5 / mapTransform.scale, 3 / mapTransform.scale]); 

    if (points.length === 1 && previewPoint) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(previewPoint.x, previewPoint.y);
        ctx.stroke();
    } else if (points.length === 2) {
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        ctx.stroke();
    }
    
    points.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, (TEMP_AREA_POINT_RADIUS +1) / mapTransform.scale, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0, 255, 0, 0.7)';
        ctx.fill();
    });
    ctx.restore();
  };

  useEffect(() => {
    const canvas = canvasRef.current; const container = containerRef.current;
    if (!canvas || !container) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect(); 
    if (rect.width === 0 || rect.height === 0) return;
    canvas.style.width = `${rect.width}px`; canvas.style.height = `${rect.height}px`;
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.scale(dpr, dpr); 
    ctx.clearRect(0, 0, rect.width, rect.height); 
    ctx.save();
    ctx.translate(mapTransform.offset.x, mapTransform.offset.y);
    ctx.scale(mapTransform.scale, mapTransform.scale);

    if (mapMediaToRender) ctx.drawImage(mapMediaToRender, 0, 0);

    courseElements.forEach(el => drawCourseElementOnContext(
        ctx, el, el.id === selectedElementId, courseElements, 
        mapTransform.scale, // featureDisplayScale
        startSymbolScaleUI, controlSymbolScaleUI, finishSymbolScaleUI 
    ));
    
    if ((currentTool === Tool.AREA_CORRIDOR || currentTool === Tool.AREA_FORBIDDEN) && drawingPoints.length > 0) {
        drawTemporaryArea(ctx, drawingPoints, currentMouseMapPos);
    }

    if (isMeasuringRefLine) {
        drawReferenceLine(ctx, refLinePoints, currentMouseMapPos);
    }

    ctx.restore();
  }, [
      mapMediaToRender, mapTransform, courseElements, selectedElementId, 
      drawingPoints, currentTool, currentMouseMapPos, 
      isMeasuringRefLine, refLinePoints,
      startSymbolScaleUI, controlSymbolScaleUI, finishSymbolScaleUI 
    ]);

  return (
    <div ref={containerRef} className="canvas-container flex-grow bg-gray-700 relative">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp} 
        className="absolute top-0 left-0" 
        style={{ cursor: isMeasuringRefLine ? 'crosshair' : (currentTool === Tool.PAN ? (isDragging ? 'grabbing' : 'grab') : (currentTool === Tool.SELECT ? 'default' : 'crosshair')) }}
      />
      {!mapMediaToRender && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xl pointer-events-none">
          Upload a map to begin.
        </div>
      )}
    </div>
  );
};