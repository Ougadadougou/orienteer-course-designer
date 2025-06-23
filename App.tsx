
import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Tool, Point, MapTransform, CourseElement, ElementType, StartElement, ControlElement, FinishElement, LegElement, AreaElement,
  PDFDocumentProxy, PDFPageProxy, CourseData, ControlDescriptionData, getDefaultControlDescription, AreaKind,
  MapScaleSettings, MapScaleMode
} from './types';
import { useHistory } from './hooks/useHistory';
import { Toolbar } from './components/Toolbar';
import { MapDisplay, drawCourseElementOnContext } from './components/MapDisplay'; 
import { ControlDescriptionPanel } from './components/ControlDescriptionPanel';
import { ScaleSettings } from './components/ScaleSettings';
import { SymbolSettings } from './components/SymbolSettings';
import {
  DEFAULT_MAP_SCALE, DEFAULT_MAP_OFFSET, 
  MIN_ZOOM, MAX_ZOOM, ZOOM_SENSITIVITY,
  POINTS_PER_METER_AT_1_TO_1_SCALE,
  BASE_CONTROL_RADIUS_MAP_UNITS, // Used for click detection calculation
  BASE_START_SIZE_MAP_UNITS,    // Used for click detection calculation
  BASE_FINISH_OUTER_RADIUS_MAP_UNITS, // Used for click detection calculation
} from './constants';
import { getElementAtPoint, isPointInCircle, isPointInStartTriangle, distance as geomDistance } from './utils/geometry';

const generateId = () => `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

interface AppState {
  elements: CourseElement[];
  selectedElementId: string | null;
  mapFileName?: string; 
}

const initialAppState: AppState = {
  elements: [],
  selectedElementId: null,
};

// This function needs to calculate current size based on scale to determine target center
const getRotationAngleForStart = (startElement: StartElement, allElements: CourseElement[], startSymbolScaleUI: number): number => {
  const connectedLegs = allElements.filter(el => 
    el.type === ElementType.LEG && 
    ((el as LegElement).fromElementId === startElement.id || (el as LegElement).toElementId === startElement.id)
  ) as LegElement[];

  if (connectedLegs.length === 0) return 0;

  const connectedControls: ControlElement[] = [];
  const connectedFinishes: FinishElement[] = [];

  connectedLegs.forEach(leg => {
    const otherEndId = leg.fromElementId === startElement.id ? leg.toElementId : leg.fromElementId;
    const otherElement = allElements.find(el => el.id === otherEndId);
    if (otherElement) {
      if (otherElement.type === ElementType.CONTROL) {
        connectedControls.push(otherElement as ControlElement);
      } else if (otherElement.type === ElementType.FINISH) {
        connectedFinishes.push(otherElement as FinishElement);
      }
    }
  });

  let targetElement: ControlElement | FinishElement | undefined;

  if (connectedControls.length > 0) {
    connectedControls.sort((a, b) => a.number - b.number);
    targetElement = connectedControls[0];
  } else if (connectedFinishes.length > 0) {
    connectedFinishes.sort((a,b) => a.id.localeCompare(b.id)); 
    targetElement = connectedFinishes[0];
  }

  if (targetElement) {
    const dx = targetElement.center.x - startElement.center.x;
    const dy = targetElement.center.y - startElement.center.y;
    return Math.atan2(dy, dx) + Math.PI / 2; 
  }
  return 0; 
};

const App: React.FC = () => {
  const [mapSourceType, setMapSourceType] = useState<'pdf' | 'image' | null>(null);
  const [mapSourceData, setMapSourceData] = useState<PDFPageProxy | string | null>(null); 
  const [mapNaturalDimensions, setMapNaturalDimensions] = useState<{width: number, height: number} | null>(null);
  
  const [isMapProcessing, setIsMapProcessing] = useState(false);
  const [processedMapForDisplay, setProcessedMapForDisplay] = useState<HTMLCanvasElement | HTMLImageElement | null>(null);

  const [mapTransform, setMapTransform] = useState<MapTransform>({ scale: DEFAULT_MAP_SCALE, offset: DEFAULT_MAP_OFFSET });
  const [currentTool, setCurrentTool] = useState<Tool>(Tool.SELECT);
  
  const courseStateHistory = useHistory<AppState>(initialAppState);
  const { current: courseState, set: setCourseState, undo, redo, canUndo, canRedo, reset: resetHistory } = courseStateHistory;

  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPoint, setDragStartPoint] = useState<Point | null>(null); 
  const [originalElementPos, setOriginalElementPos] = useState<Point | Point[] | null>(null);

  const [drawingAreaPoints, setDrawingAreaPoints] = useState<Point[]>([]);
  const [legStartElementId, setLegStartElementId] = useState<string | null>(null); 
  const mouseMapPosRef = useRef<Point>({x:0, y:0});
  const [currentMapMouseForPreview, setCurrentMapMouseForPreview] = useState<Point | null>(null);
  
  const [mapScaleSettings, setMapScaleSettings] = useState<MapScaleSettings>({ mode: 'none' });
  const [courseLengthMeters, setCourseLengthMeters] = useState<number | null>(null);

  const [isMeasuringRefLine, setIsMeasuringRefLine] = useState(false);
  const [refLinePoints, setRefLinePoints] = useState<Point[]>([]);

  const mapDisplayWrapperRef = useRef<HTMLDivElement>(null);

  // Global Symbol Scale UI states (1-10, default 5)
  const [startSymbolScaleUI, setStartSymbolScaleUI] = useState<number>(5);
  const [controlSymbolScaleUI, setControlSymbolScaleUI] = useState<number>(5);
  const [finishSymbolScaleUI, setFinishSymbolScaleUI] = useState<number>(5);

  const handleSetStartSymbolScaleUI = (scale: number) => {
    if (scale >= 1 && scale <= 10) setStartSymbolScaleUI(scale);
  };
  const handleSetControlSymbolScaleUI = (scale: number) => {
    if (scale >= 1 && scale <= 10) setControlSymbolScaleUI(scale);
  };
  const handleSetFinishSymbolScaleUI = (scale: number) => {
    if (scale >= 1 && scale <= 10) setFinishSymbolScaleUI(scale);
  };

  const resetCourse = useCallback(() => {
    resetHistory(initialAppState);
    setDrawingAreaPoints([]);
    setLegStartElementId(null); 
    setMapScaleSettings({ mode: 'none' }); 
    setCourseLengthMeters(null);
    setIsMeasuringRefLine(false);
    setRefLinePoints([]);
    // Reset symbol UI scales
    setStartSymbolScaleUI(5);
    setControlSymbolScaleUI(5);
    setFinishSymbolScaleUI(5);
  }, [resetHistory]);

  const fitMapToView = useCallback(() => {
    if (!processedMapForDisplay || !mapNaturalDimensions || !mapDisplayWrapperRef.current) {
        setMapTransform({ scale: DEFAULT_MAP_SCALE, offset: DEFAULT_MAP_OFFSET }); // Fallback if no map
        return;
    }

    const container = mapDisplayWrapperRef.current;
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    if (containerWidth <= 0 || containerHeight <= 0) {
      setMapTransform({ scale: DEFAULT_MAP_SCALE, offset: DEFAULT_MAP_OFFSET }); // Fallback for invalid container size
      return;
    }

    const padding = 20; // 20px padding on all sides
    const availableWidth = containerWidth - 2 * padding;
    const availableHeight = containerHeight - 2 * padding;

    if (availableWidth <= 0 || availableHeight <= 0) {
      // If padding makes effective area too small, fit to container without padding
      const scaleXNoPad = containerWidth / mapNaturalDimensions.width;
      const scaleYNoPad = containerHeight / mapNaturalDimensions.height;
      const newScaleNoPad = Math.min(scaleXNoPad, scaleYNoPad);
      const clampedScaleNoPad = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScaleNoPad));
      const offsetXNoPad = (containerWidth - mapNaturalDimensions.width * clampedScaleNoPad) / 2;
      const offsetYNoPad = (containerHeight - mapNaturalDimensions.height * clampedScaleNoPad) / 2;
      setMapTransform({ scale: clampedScaleNoPad, offset: { x: offsetXNoPad, y: offsetYNoPad } });
      return;
    }

    const scaleX = availableWidth / mapNaturalDimensions.width;
    const scaleY = availableHeight / mapNaturalDimensions.height;
    const newScale = Math.min(scaleX, scaleY);
    const clampedScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newScale));

    const offsetX = (containerWidth - mapNaturalDimensions.width * clampedScale) / 2;
    const offsetY = (containerHeight - mapNaturalDimensions.height * clampedScale) / 2;

    setMapTransform({ scale: clampedScale, offset: { x: offsetX, y: offsetY } });
  }, [processedMapForDisplay, mapNaturalDimensions]);

  useEffect(() => {
    if (processedMapForDisplay && mapNaturalDimensions) {
      fitMapToView();
    } else {
      setMapTransform({ scale: DEFAULT_MAP_SCALE, offset: DEFAULT_MAP_OFFSET });
    }
  }, [processedMapForDisplay, mapNaturalDimensions, fitMapToView]);


  const handleMapUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const fileName = file.name;
    const fileType = file.type;
    const allowedTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/heic', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff'];
    const lowerCaseFileName = fileName.toLowerCase();
    const knownExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.heic', '.gif', '.webp', '.bmp', '.tif', '.tiff'];
    let isAllowed = allowedTypes.includes(fileType) || knownExtensions.some(ext => lowerCaseFileName.endsWith(ext));
    
    if (!isAllowed) { 
        alert("Unsupported file type. Please upload a PDF, PNG, JPG/JPEG, HEIC, GIF, WebP, BMP or TIFF file.");
        event.target.value = ''; 
        return;
    }
    if (mapSourceData && typeof mapSourceData !== 'string' && 'cleanup' in mapSourceData) {
        (mapSourceData as PDFPageProxy).cleanup();
    }
    setMapSourceType(null); setMapSourceData(null); setMapNaturalDimensions(null);
    setProcessedMapForDisplay(null); setCourseLengthMeters(null); setIsMapProcessing(true);
    document.body.style.cursor = 'wait';
    // Set an initial default transform while processing. fitMapToView will override it.
    setMapTransform({ scale: DEFAULT_MAP_SCALE, offset: DEFAULT_MAP_OFFSET });

    try {
        if (fileType === 'application/pdf' || lowerCaseFileName.endsWith('.pdf')) {
            const arrayBuffer = await file.arrayBuffer();
            if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
              // Ensure pdfjsLib.version is available
              const version = pdfjsLib.version || '3.11.174'; // Fallback version if needed
              pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
            }
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const page = await pdf.getPage(1); 
            const viewport = page.getViewport({scale:1});
            setMapSourceType('pdf'); setMapSourceData(page);
            setMapNaturalDimensions({width: viewport.width, height: viewport.height});
            const tempRenderCanvas = document.createElement('canvas');
            tempRenderCanvas.width = viewport.width; tempRenderCanvas.height = viewport.height;
            const tempCtx = tempRenderCanvas.getContext('2d');
            if (tempCtx) {
                await page.render({ canvasContext: tempCtx, viewport }).promise;
                setProcessedMapForDisplay(tempRenderCanvas);
            } else throw new Error("Could not create rendering context for PDF.");
        } else { 
            let imageBlob: Blob = file; 
            if (lowerCaseFileName.endsWith('.heic')) {
                try {
                    const convertedBlob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
                    imageBlob = convertedBlob instanceof Blob ? convertedBlob : file; 
                } catch (heicError) {
                    console.error("HEIC conversion error:", heicError);
                    alert(`Error converting HEIC file: ${heicError instanceof Error ? heicError.message : String(heicError)}`);
                    setIsMapProcessing(false); document.body.style.cursor = 'default'; event.target.value = ''; return;
                }
            }
            const imageUrl = URL.createObjectURL(imageBlob);
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
                img.onload = () => {
                    setMapSourceType('image'); setMapSourceData(imageUrl); 
                    setMapNaturalDimensions({width: img.naturalWidth, height: img.naturalHeight});
                    setProcessedMapForDisplay(img); resolve();
                };
                img.onerror = () => { URL.revokeObjectURL(imageUrl); reject(new Error("Error loading image file.")); };
                img.src = imageUrl;
            });
        }
        // setMapTransform({ scale: DEFAULT_MAP_SCALE, offset: DEFAULT_MAP_OFFSET }); // Moved up
        const newMapFileName = fileName;
        setCourseState(prev => ({
            ...initialAppState, 
            elements: prev.mapFileName === newMapFileName ? prev.elements : [], 
            mapFileName: newMapFileName 
        }), false); 
        resetCourse(); 
    } catch (error) {
        console.error("Error loading map:", error);
        alert(`Error loading map: ${error instanceof Error ? error.message : String(error)}`);
        setProcessedMapForDisplay(null); 
    } finally {
        setIsMapProcessing(false); document.body.style.cursor = 'default'; event.target.value = ''; 
    }
  };

  const updateElementPosition = (elementId: string, newPos: Point | Point[]) => {
    setCourseState(prev => ({
      ...prev,
      elements: prev.elements.map(el => {
        if (el.id === elementId) {
          if (el.type === ElementType.AREA && Array.isArray(newPos)) {
            return { ...el, points: newPos as Point[] };
          } else if ('center' in el && !Array.isArray(newPos)) { 
            let updatedEl = { ...el, center: newPos as Point };
            if (updatedEl.type === ElementType.START) {
              const currentElements = prev.elements.map(e => e.id === elementId ? updatedEl : e);
              const newAngle = getRotationAngleForStart(updatedEl as StartElement, currentElements, startSymbolScaleUI);
              updatedEl = { ...updatedEl, rotationAngle: newAngle };
            }
            return updatedEl;
          }
        }
        return el;
      }),
    }), true); 
  };
  const commitElementMove = () => { setCourseState(prev => ({...prev}), false); }; 

  const handleStartReferenceLineMeasurement = () => {
    setIsMeasuringRefLine(true);
    setRefLinePoints([]);
    setCurrentTool(Tool.SELECT); 
    setCourseState(prev => ({...prev, selectedElementId: null}));
  };

  const handleCanvasMouseDown = useCallback((mapPoint: Point, event: React.MouseEvent<HTMLCanvasElement>) => {
    mouseMapPosRef.current = mapPoint;
    if (event.button !== 0) return; 

    if (isMeasuringRefLine) {
        setRefLinePoints(prev => {
            const newPoints = [...prev, mapPoint];
            if (newPoints.length === 2) {
                const dist = geomDistance(newPoints[0], newPoints[1]);
                setMapScaleSettings(s => ({
                    ...s,
                    mode: 'referenceLength',
                    mapUnitsOnScreen: parseFloat(dist.toFixed(2)), 
                }));
                setIsMeasuringRefLine(false); 
                setTimeout(() => setRefLinePoints([]),0); 
                return []; 
            }
            return newPoints;
        });
        return; 
    }

    setIsDragging(true);

    if (currentTool === Tool.PAN) {
      setDragStartPoint({ x: event.clientX, y: event.clientY }); return;
    }
    if (currentTool === Tool.SELECT) {
      const clickedElement = getElementAtPoint(
        mapPoint, courseState.elements, mapTransform.scale, courseState.elements,
        startSymbolScaleUI, controlSymbolScaleUI, finishSymbolScaleUI // Pass UI scales
      );
      if (courseState.selectedElementId !== (clickedElement?.id || null)) {
        setCourseState(prev => ({ ...prev, selectedElementId: clickedElement?.id || null }));
      }
      if (clickedElement) {
        setDragStartPoint(mapPoint); 
        if ('center' in clickedElement && clickedElement.center) setOriginalElementPos(clickedElement.center);
        else if (clickedElement.type === ElementType.AREA && clickedElement.points) setOriginalElementPos(clickedElement.points);
        else setOriginalElementPos(null);
      } else setIsDragging(false); 
      return;
    }
    setIsDragging(false); 

    if (currentTool === Tool.START) {
      const newStart: StartElement = { id: generateId(), type: ElementType.START, center: mapPoint, rotationAngle: 0 };
      setCourseState(prev => ({ ...prev, elements: [...prev.elements, newStart], selectedElementId: newStart.id }));
    } else if (currentTool === Tool.CONTROL) {
      const nextNumber = (courseState.elements.filter(el => el.type === ElementType.CONTROL).length) + 1;
      const newControl: ControlElement = { id: generateId(), type: ElementType.CONTROL, center: mapPoint, number: nextNumber, description: getDefaultControlDescription(nextNumber) };
      setCourseState(prev => ({ ...prev, elements: [...prev.elements, newControl], selectedElementId: newControl.id }));
    } else if (currentTool === Tool.FINISH) {
      const newFinish: FinishElement = { id: generateId(), type: ElementType.FINISH, center: mapPoint };
      setCourseState(prev => ({ ...prev, elements: [...prev.elements, newFinish], selectedElementId: newFinish.id }));
    } else if (currentTool === Tool.LEG) {
        const connectableTypes = [ElementType.START, ElementType.CONTROL, ElementType.FINISH];
        const clickTolerance = 5 / mapTransform.scale; 
        let clickedConnectableElement: CourseElement | undefined;
        
        for (const el of courseState.elements) {
            if (!connectableTypes.includes(el.type)) continue;
            let hit = false;
            const currentStartSize = BASE_START_SIZE_MAP_UNITS * (startSymbolScaleUI / 5.0);
            const currentControlRadius = BASE_CONTROL_RADIUS_MAP_UNITS * (controlSymbolScaleUI / 5.0);
            const currentFinishOuterRadius = BASE_FINISH_OUTER_RADIUS_MAP_UNITS * (finishSymbolScaleUI / 5.0);

            if (el.type === ElementType.START) { if (isPointInStartTriangle(mapPoint, (el as StartElement).center, currentStartSize, clickTolerance)) hit = true; } 
            else if (el.type === ElementType.CONTROL) { if (isPointInCircle(mapPoint, (el as ControlElement).center, currentControlRadius + clickTolerance)) hit = true; } 
            else if (el.type === ElementType.FINISH) { if (isPointInCircle(mapPoint, (el as FinishElement).center, currentFinishOuterRadius + clickTolerance)) hit = true; }
            if (hit) { clickedConnectableElement = el; break; }
        }
        if (clickedConnectableElement) {
            if (!legStartElementId) setLegStartElementId(clickedConnectableElement.id);
            else if (legStartElementId !== clickedConnectableElement.id) { 
                const newLeg: LegElement = { id: generateId(), type: ElementType.LEG, fromElementId: legStartElementId, toElementId: clickedConnectableElement.id, style: 'solid' };
                setCourseState(prev => {
                    let updatedElements = [...prev.elements, newLeg];
                    [newLeg.fromElementId, newLeg.toElementId].forEach(endId => {
                        const elToUpdate = updatedElements.find(e => e.id === endId);
                        if (elToUpdate && elToUpdate.type === ElementType.START) {
                            const newAngle = getRotationAngleForStart(elToUpdate as StartElement, updatedElements, startSymbolScaleUI);
                            updatedElements = updatedElements.map(e => e.id === elToUpdate.id ? { ...elToUpdate, rotationAngle: newAngle } : e);
                        }
                    });
                    return {...prev, elements: updatedElements};
                });
                setLegStartElementId(null); 
            }
        } else setLegStartElementId(null); 
    } else if (currentTool === Tool.AREA_FORBIDDEN || currentTool === Tool.AREA_CORRIDOR) {
        setDrawingAreaPoints(prev => [...prev, mapPoint]);
    }
  }, [
    currentTool, courseState, mapTransform.scale, setCourseState, legStartElementId,
    startSymbolScaleUI, controlSymbolScaleUI, finishSymbolScaleUI, // Added UI scales
    isMeasuringRefLine
  ]);

  const handleCanvasMouseMove = useCallback((mapPoint: Point, event: React.MouseEvent<HTMLCanvasElement>) => {
    mouseMapPosRef.current = mapPoint;
    if (isMeasuringRefLine || currentTool === Tool.AREA_CORRIDOR || currentTool === Tool.AREA_FORBIDDEN || (currentTool === Tool.LEG && legStartElementId)) {
        setCurrentMapMouseForPreview(mapPoint);
    } else {
        setCurrentMapMouseForPreview(null);
    }

    if (!isDragging || !dragStartPoint) return;

    if (currentTool === Tool.PAN) {
      const dx = event.clientX - dragStartPoint.x;
      const dy = event.clientY - dragStartPoint.y;
      setMapTransform(prev => ({ ...prev, offset: { x: prev.offset.x + dx, y: prev.offset.y + dy } }));
      setDragStartPoint({ x: event.clientX, y: event.clientY }); 
    } else if (currentTool === Tool.SELECT && courseState.selectedElementId && originalElementPos) {
      const selectedElement = courseState.elements.find(el => el.id === courseState.selectedElementId);
      if (!selectedElement) return;
      const dx = mapPoint.x - dragStartPoint.x; 
      const dy = mapPoint.y - dragStartPoint.y;
      if (selectedElement.type === ElementType.AREA && Array.isArray(originalElementPos)) {
        updateElementPosition(courseState.selectedElementId, originalElementPos.map(p => ({ x: p.x + dx, y: p.y + dy })));
      } else if ('center' in selectedElement && !Array.isArray(originalElementPos) && originalElementPos) {
        updateElementPosition(courseState.selectedElementId, { x: (originalElementPos as Point).x + dx, y: (originalElementPos as Point).y + dy });
      }
    }
  }, [isDragging, currentTool, dragStartPoint, courseState, originalElementPos, updateElementPosition, legStartElementId, isMeasuringRefLine, startSymbolScaleUI]); // Added startSymbolScaleUI for rotation recalc

  const handleCanvasMouseUp = useCallback(() => {
    if (isMeasuringRefLine) { return; }
    if (isDragging) {
      if (currentTool === Tool.SELECT && courseState.selectedElementId && originalElementPos) {
        const movedElement = courseState.elements.find(el => el.id === courseState.selectedElementId);
        if (movedElement && movedElement.type === ElementType.START) {
            const newAngle = getRotationAngleForStart(movedElement as StartElement, courseState.elements, startSymbolScaleUI);
            if (newAngle !== (movedElement as StartElement).rotationAngle) {
                 setCourseState(prev => ({ ...prev, elements: prev.elements.map(e => e.id === movedElement.id ? { ...e, rotationAngle: newAngle } : e) }), false); 
                 setIsDragging(false); setDragStartPoint(null); setOriginalElementPos(null); return; 
            }
        }
        commitElementMove(); 
      }
      setIsDragging(false); setDragStartPoint(null); setOriginalElementPos(null);
    }
  }, [isDragging, currentTool, courseState, originalElementPos, commitElementMove, setCourseState, isMeasuringRefLine, startSymbolScaleUI]);

  const handleCanvasWheel = useCallback((event: WheelEvent) => {
    event.preventDefault(); 
    if (!processedMapForDisplay && courseState.elements.length === 0) return; 
    const target = event.currentTarget as HTMLElement; 
    const rect = target.getBoundingClientRect(); 
    const mouseX = event.clientX - rect.left; 
    const mouseY = event.clientY - rect.top;
    const oldScale = mapTransform.scale;
    const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldScale * Math.exp(-event.deltaY * ZOOM_SENSITIVITY)));
    if (newScale === oldScale) return; 
    const mapXBeforeZoom = (mouseX - mapTransform.offset.x) / oldScale;
    const mapYBeforeZoom = (mouseY - mapTransform.offset.y) / oldScale;
    setMapTransform({ scale: newScale, offset: { x: mouseX - mapXBeforeZoom * newScale, y: mouseY - mapYBeforeZoom * newScale } });
  }, [mapTransform, processedMapForDisplay, courseState.elements]);

  const zoomWithCenter = (zoomIn: boolean) => {
    if ((!processedMapForDisplay && courseState.elements.length === 0) || !mapDisplayWrapperRef.current) return;
    const rect = mapDisplayWrapperRef.current.getBoundingClientRect();
    const centerX = rect.width / 2, centerY = rect.height / 2; 
    const oldScale = mapTransform.scale;
    const newScale = zoomIn ? Math.min(MAX_ZOOM, oldScale * 1.2) : Math.max(MIN_ZOOM, oldScale / 1.2);
    if (newScale === oldScale) return;
    const mapX = (centerX - mapTransform.offset.x) / oldScale; 
    const mapY = (centerY - mapTransform.offset.y) / oldScale;
    setMapTransform({scale: newScale, offset: {x:centerX - mapX * newScale, y:centerY - mapY * newScale}});
  };
  const handleZoomIn = () => zoomWithCenter(true);
  const handleZoomOut = () => zoomWithCenter(false);

  const handleDeleteSelected = () => {
    if (!courseState.selectedElementId) return;
    const selectedId = courseState.selectedElementId;
    setCourseState(prev => {
        const deletedElement = prev.elements.find(el => el.id === selectedId);
        let newElements = prev.elements.filter(el => el.id !== selectedId);
        const startElementsToUpdateRotation = new Set<string>(); 

        if (deletedElement) {
            if (deletedElement.type === ElementType.LEG) {
                const leg = deletedElement as LegElement;
                [leg.fromElementId, leg.toElementId].forEach(endId => {
                    const el = prev.elements.find(e => e.id === endId); 
                    if (el && el.type === ElementType.START) startElementsToUpdateRotation.add(el.id);
                });
            } 
            else if ([ElementType.START, ElementType.CONTROL, ElementType.FINISH].includes(deletedElement.type)) {
                const legsToRemove: string[] = [];
                newElements.forEach(el => { 
                    if (el.type === ElementType.LEG) {
                        const leg = el as LegElement;
                        if (leg.fromElementId === selectedId || leg.toElementId === selectedId) {
                            legsToRemove.push(leg.id);
                            const otherEndId = leg.fromElementId === selectedId ? leg.toElementId : leg.fromElementId;
                            const otherEl = prev.elements.find(e => e.id === otherEndId); 
                            if (otherEl && otherEl.type === ElementType.START) startElementsToUpdateRotation.add(otherEl.id);
                        }
                    }
                });
                newElements = newElements.filter(el => !legsToRemove.includes(el.id));
            }
        }

        if (deletedElement?.type === ElementType.CONTROL) {
            const controlsToRenumber = newElements.filter(el => el.type === ElementType.CONTROL).sort((a,b) => (a as ControlElement).number - (b as ControlElement).number) as ControlElement[];
            newElements = newElements.map(el => {
                if (el.type === ElementType.CONTROL) {
                    const controlElement = el as ControlElement; const idx = controlsToRenumber.findIndex(c => c.id === controlElement.id);
                    if (idx !== -1) { 
                        const newNumber = idx + 1;
                        if (controlElement.number !== newNumber || controlElement.description.A_number !== newNumber.toString()) {
                            return { ...controlElement, number: newNumber, description: {...controlElement.description, A_number: newNumber.toString()}};
                        }
                    }
                } return el;
            });
        }
        if (startElementsToUpdateRotation.size > 0) {
            newElements = newElements.map(el => (el.type === ElementType.START && startElementsToUpdateRotation.has(el.id)) ? { ...el, rotationAngle: getRotationAngleForStart(el as StartElement, newElements, startSymbolScaleUI) } : el);
        }
        return { ...prev, elements: newElements, selectedElementId: null };
    });
  };

  const handleUpdateDescription = (controlId: string, newDescription: ControlDescriptionData) => setCourseState(prev => ({ ...prev, elements: prev.elements.map(el => (el.id === controlId && el.type === ElementType.CONTROL) ? { ...el, description: newDescription } : el) }));
  // handleUpdateControlRadius is removed

  const handleExportDescriptions = () => {
    const controls = courseState.elements.filter(el => el.type === ElementType.CONTROL) as ControlElement[];
    controls.sort((a,b) => a.number - b.number);
    if (controls.length === 0) { alert("No controls to export."); return; }
    const headers = ["A_Num", "B_Code", "C_Feature", "D_Detail", "E_Dims", "F_Location", "G_Combo", "H_Special"];
    const rows = controls.map(c => [ c.description.A_number, c.description.B_code, c.description.C_whichFeature, c.description.D_featureDetail, c.description.E_dimensions, c.description.F_location, c.description.G_betweenObjects, c.description.H_specialInstructions ].map(field => `"${String(field || '').replace(/"/g, '""')}"`)); 
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n");
    const link = document.createElement("a"); link.setAttribute("href", encodeURI(csvContent)); link.setAttribute("download", `control_descriptions_${courseState.mapFileName?.replace(/\.(pdf|png|jpe?g|heic|gif|webp)$/i, '') || 'course'}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };
  
  const handleSaveCourseData = () => {
    const courseDataToSave: CourseData = { 
      elements: courseState.elements, 
      mapFileName: courseState.mapFileName,
      // Consider saving UI scales if desired for future sessions:
      // startSymbolScaleUI, controlSymbolScaleUI, finishSymbolScaleUI,
    };
    const blob = new Blob([JSON.stringify(courseDataToSave, null, 2)], { type: "application/json" });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob);
    link.download = `course_${courseState.mapFileName?.replace(/\.(pdf|png|jpe?g|heic|gif|webp)$/i,'') || 'design'}.json`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); URL.revokeObjectURL(link.href);
  };

  const handleLoadCourse = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/json") {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const loadedData = JSON.parse(e.target?.result as string) as CourseData; // Assuming CourseData might store scales
          if (loadedData && Array.isArray(loadedData.elements)) {
            const sanitizedElements = loadedData.elements.map(el => {
              // Remove size/radius properties from loaded elements as they are no longer stored
              const { size, radius, outerRadius, innerRadius, ...restOfElement } = el as any;
              let sanitizedEl = restOfElement;

              if (sanitizedEl.type === ElementType.CONTROL) {
                if (!(sanitizedEl as ControlElement).description) {
                  (sanitizedEl as ControlElement).description = getDefaultControlDescription((sanitizedEl as ControlElement).number);
                }
              }
              if (sanitizedEl.type === ElementType.START) {
                if (typeof (sanitizedEl as StartElement).rotationAngle === 'undefined') {
                  (sanitizedEl as StartElement).rotationAngle = 0; 
                }
              }
              return sanitizedEl as CourseElement;
            });

            // After sanitizing individual elements, recalculate Start rotations based on all loaded elements and current startSymbolScaleUI
            let finalLoadedElements = sanitizedElements.map(el => (el.type === ElementType.START) ? { ...el, rotationAngle: getRotationAngleForStart(el as StartElement, sanitizedElements, startSymbolScaleUI) } : el);
            
            resetHistory({ elements: finalLoadedElements, selectedElementId: null, mapFileName: loadedData.mapFileName });
            
            // Restore UI scales if they were saved in the JSON, otherwise keep current or default
            // if (typeof (loadedData as any).startSymbolScaleUI === 'number') setStartSymbolScaleUI((loadedData as any).startSymbolScaleUI); else setStartSymbolScaleUI(5);
            // if (typeof (loadedData as any).controlSymbolScaleUI === 'number') setControlSymbolScaleUI((loadedData as any).controlSymbolScaleUI); else setControlSymbolScaleUI(5);
            // if (typeof (loadedData as any).finishSymbolScaleUI === 'number') setFinishSymbolScaleUI((loadedData as any).finishSymbolScaleUI); else setFinishSymbolScaleUI(5);


            if (loadedData.mapFileName && !processedMapForDisplay) alert(`Course loaded. Please re-upload the map file: ${loadedData.mapFileName}`);
            else if (loadedData.mapFileName && processedMapForDisplay && courseState.mapFileName && courseState.mapFileName.toLowerCase() !== loadedData.mapFileName.toLowerCase()) alert(`Course loaded for map "${loadedData.mapFileName}". Your current map is "${courseState.mapFileName}". Results may vary.`);
            else alert("Course loaded successfully.");
          } else alert("Invalid course file format.");
        } catch (error) { console.error("Error loading course:", error); alert(`Failed to load course file: ${error instanceof Error ? error.message : "Unknown error"}`); }
      }; reader.readAsText(file);
    } event.target.value = ''; 
  };

  const handleExportPdf = async () => {
    if (!processedMapForDisplay || !mapNaturalDimensions) { alert("Please load and process a map first to export."); return; }
    document.body.style.cursor = 'wait';
    try {
      const offscreenCanvas = document.createElement('canvas');
      offscreenCanvas.width = mapNaturalDimensions.width; offscreenCanvas.height = mapNaturalDimensions.height;
      const ctx = offscreenCanvas.getContext('2d');
      if (!ctx) { alert("Failed to create drawing context for PDF export."); document.body.style.cursor = 'default'; return; }
      ctx.drawImage(processedMapForDisplay, 0, 0, mapNaturalDimensions.width, mapNaturalDimensions.height);
      courseState.elements.forEach(el => drawCourseElementOnContext(
        ctx, el, false, courseState.elements, 
        1.0, // featureDisplayScale is 1.0 for PDF export (native map units)
        startSymbolScaleUI, controlSymbolScaleUI, finishSymbolScaleUI // pass UI scales
      )); 
      
      const imageDataUrl = offscreenCanvas.toDataURL('image/png'); 
      const pdf = new window.jspdf.jsPDF({ orientation: mapNaturalDimensions.width > mapNaturalDimensions.height ? 'l' : 'p', unit: 'px', format: [mapNaturalDimensions.width, mapNaturalDimensions.height] });
      pdf.addImage(imageDataUrl, 'PNG', 0, 0, mapNaturalDimensions.width, mapNaturalDimensions.height);
      pdf.save(`course_export_${courseState.mapFileName?.replace(/\.(pdf|png|jpe?g|heic|gif|webp)$/i, '') || 'design'}.pdf`);
    } catch (error) { console.error("Error exporting PDF:", error); alert(`Failed to export PDF: ${error instanceof Error ? error.message : String(error)}`); } 
    finally { document.body.style.cursor = 'default'; }
  };
  
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isMeasuringRefLine && event.key === 'Escape') {
          setIsMeasuringRefLine(false); setRefLinePoints([]); setCurrentMapMouseForPreview(null); event.preventDefault(); return;
      }
      if (event.ctrlKey || event.metaKey) { 
        if (event.key === 'z') { undo(); event.preventDefault(); } 
        else if (event.key === 'y') { redo(); event.preventDefault(); } return;
      }
      if (event.key === 'Enter') {
        if ((currentTool === Tool.AREA_FORBIDDEN || currentTool === Tool.AREA_CORRIDOR) && drawingAreaPoints.length >= 3) {
          const newArea: AreaElement = { id: generateId(), type: ElementType.AREA, points: [...drawingAreaPoints], kind: currentTool === Tool.AREA_FORBIDDEN ? AreaKind.FORBIDDEN : AreaKind.CORRIDOR };
          setCourseState(prev => ({...prev, elements: [...prev.elements, newArea], selectedElementId: newArea.id}));
          setDrawingAreaPoints([]); setCurrentMapMouseForPreview(null);
        }
      } else if (event.key === 'Escape') {
        setDrawingAreaPoints([]); setCurrentMapMouseForPreview(null); setLegStartElementId(null); 
        if (courseState.selectedElementId) setCourseState(prev => ({...prev, selectedElementId: null}));
      } else if ((event.key === 'Delete' || event.key === 'Backspace') && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || (event.target as HTMLElement).isContentEditable) ) {
          if (courseState.selectedElementId) handleDeleteSelected();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTool, drawingAreaPoints, setCourseState, courseState.selectedElementId, handleDeleteSelected, undo, redo, isMeasuringRefLine, startSymbolScaleUI]); // Added startSymbolScaleUI for rotation recalc dependency

  const handleScaleSettingsUpdate = (newSettings: MapScaleSettings) => setMapScaleSettings(newSettings);

  useEffect(() => {
    if (mapScaleSettings.mode === 'none' || !mapNaturalDimensions || courseState.elements.length === 0) { setCourseLengthMeters(null); return; }
    let mapUnitsPerMeter: number | null = null;
    if (mapScaleSettings.mode === 'ratio' && mapScaleSettings.ratioValue && mapScaleSettings.ratioValue > 0) {
      mapUnitsPerMeter = POINTS_PER_METER_AT_1_TO_1_SCALE / mapScaleSettings.ratioValue;
    } else if (mapScaleSettings.mode === 'referenceLength' && mapScaleSettings.mapUnitsOnScreen && mapScaleSettings.mapUnitsOnScreen > 0 && mapScaleSettings.realWorldMeters && mapScaleSettings.realWorldMeters > 0) {
      mapUnitsPerMeter = mapScaleSettings.mapUnitsOnScreen / mapScaleSettings.realWorldMeters;
    }
    if (!mapUnitsPerMeter || mapUnitsPerMeter <= 0) { setCourseLengthMeters(null); return; }
    let totalLengthMapUnits = 0;
    courseState.elements.forEach(el => {
      if (el.type === ElementType.LEG) {
        const leg = el as LegElement;
        const fromElement = courseState.elements.find(e => e.id === leg.fromElementId);
        const toElement = courseState.elements.find(e => e.id === leg.toElementId);
        if (fromElement && 'center' in fromElement && toElement && 'center' in toElement) {
          totalLengthMapUnits += geomDistance((fromElement as StartElement | ControlElement | FinishElement).center, (toElement as StartElement | ControlElement | FinishElement).center);
        }
      }
    });
    setCourseLengthMeters(totalLengthMapUnits / mapUnitsPerMeter);
  }, [mapScaleSettings, courseState.elements, mapNaturalDimensions, mapSourceType]); 

  let legStartStatusMessage = '';
  if (legStartElementId) {
    const startEl = courseState.elements.find(e => e.id === legStartElementId);
    if (startEl) {
        let elIdentifier = startEl.id.substring(0,6); 
        if (startEl.type === ElementType.START) elIdentifier = 'Start';
        else if (startEl.type === ElementType.CONTROL) elIdentifier = `Control ${(startEl as ControlElement).number}`;
        else if (startEl.type === ElementType.FINISH) elIdentifier = 'Finish';
        legStartStatusMessage = `Drawing leg from ${elIdentifier}`;
    }
  }
  
  const formatCourseLength = (lengthInMeters: number | null): string => {
    if (lengthInMeters === null && mapScaleSettings.mode !== 'none') return 'Calculating...';
    if (lengthInMeters === null && mapScaleSettings.mode === 'none') return 'Scale not set';
    if (lengthInMeters === null) return 'Scale not set'; 
    return lengthInMeters >= 1000 ? `${(lengthInMeters / 1000).toFixed(2)} km` : `${lengthInMeters.toFixed(0)} m`;
  };

  let statusBarMessage = "";
  if (isMeasuringRefLine) {
    statusBarMessage = refLinePoints.length === 0 ? "Measuring: Click start point of reference line." : "Measuring: Click end point of reference line.";
  } else if (legStartElementId) {
    statusBarMessage = legStartStatusMessage + (currentMapMouseForPreview ? " (Click to connect, Esc to cancel)" : "");
  } else if ((currentTool === Tool.AREA_CORRIDOR || currentTool === Tool.AREA_FORBIDDEN) && drawingAreaPoints.length > 0) {
    statusBarMessage = `Drawing Area: ${drawingAreaPoints.length} points (Enter to finish, Esc to cancel)`;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-900 text-gray-200">
      <div className="p-2 bg-gray-800 border-b border-gray-700 text-white flex justify-between items-center print:hidden">
        <h1 className="text-2xl font-bold text-teal-400">Orienteering Course Designer</h1>
        <div>
            <label htmlFor="map-upload" className={`cursor-pointer text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-opacity-50 ${isMapProcessing ? 'bg-gray-500 cursor-not-allowed' : 'bg-teal-600 hover:bg-teal-700'}`}>
                {isMapProcessing ? 'Processing...' : 'Upload Map'}
            </label>
            <input id="map-upload" type="file" accept=".pdf,.png,.jpg,.jpeg,.heic,.gif,.webp,.bmp,.tiff" onChange={handleMapUpload} className="hidden" disabled={isMapProcessing} />
            {isMapProcessing && <span className="ml-3 text-sm text-yellow-400 animate-pulse">Processing map...</span>}
            {!isMapProcessing && processedMapForDisplay && 
                <span className="ml-3 text-sm text-gray-400">
                    Map: {courseState.mapFileName || 'Unnamed Map'} ({processedMapForDisplay.width}x{processedMapForDisplay.height})
                </span>
            }
        </div>
      </div>
      
      <ScaleSettings 
        currentSettings={mapScaleSettings}
        onUpdateSettings={handleScaleSettingsUpdate}
        mapSourceType={mapSourceType}
        onStartRefLineMeasurement={handleStartReferenceLineMeasurement} 
      />
      <SymbolSettings
        startSymbolScaleUI={startSymbolScaleUI}
        onSetStartSymbolScaleUI={handleSetStartSymbolScaleUI}
        controlSymbolScaleUI={controlSymbolScaleUI}
        onSetControlSymbolScaleUI={handleSetControlSymbolScaleUI}
        finishSymbolScaleUI={finishSymbolScaleUI}
        onSetFinishSymbolScaleUI={handleSetFinishSymbolScaleUI}
      />
      
      <Toolbar
        currentTool={currentTool}
        onSetTool={tool => {
            setCurrentTool(tool); setDrawingAreaPoints([]); setCurrentMapMouseForPreview(null); setLegStartElementId(null); 
            if (isMeasuringRefLine) { setIsMeasuringRefLine(false); setRefLinePoints([]); }
        }}
        onUndo={undo} canUndo={canUndo} onRedo={redo} canRedo={canRedo}
        onSaveCourseData={handleSaveCourseData} onLoad={handleLoadCourse}
        onDeleteSelected={handleDeleteSelected} isElementSelected={!!courseState.selectedElementId}
        onZoomIn={handleZoomIn} onZoomOut={handleZoomOut}
        onExportPdf={handleExportPdf} isMapLoaded={!!processedMapForDisplay}
      />

      <div ref={mapDisplayWrapperRef} className="flex flex-1 overflow-hidden print:overflow-visible">
        <MapDisplay
          mapMediaToRender={processedMapForDisplay}
          mapTransform={mapTransform}
          courseElements={courseState.elements}
          selectedElementId={courseState.selectedElementId}
          onCanvasMouseDown={handleCanvasMouseDown}
          onCanvasMouseMove={handleCanvasMouseMove}
          onCanvasMouseUp={handleCanvasMouseUp}
          onCanvasWheel={handleCanvasWheel}
          drawingPoints={drawingAreaPoints}
          currentTool={currentTool}
          currentMouseMapPos={currentMapMouseForPreview} 
          isDragging={isDragging}
          isMeasuringRefLine={isMeasuringRefLine} 
          refLinePoints={refLinePoints} 
          startSymbolScaleUI={startSymbolScaleUI} // Pass UI scales
          controlSymbolScaleUI={controlSymbolScaleUI}
          finishSymbolScaleUI={finishSymbolScaleUI}
        />
        <ControlDescriptionPanel
          selectedControl={courseState.elements.find(el => el.id === courseState.selectedElementId && el.type === ElementType.CONTROL) as ControlElement | null}
          allCourseElements={courseState.elements}
          onUpdateDescription={handleUpdateDescription}
          onExportDescriptions={handleExportDescriptions}
          // onUpdateControlRadius removed
        />
      </div>
      <div className="p-1 bg-black text-xs text-center text-gray-400 print:hidden flex flex-wrap justify-center items-center gap-x-2">
        <span>Tool: <span className="text-teal-300">{currentTool}</span></span>
        <span>| Zoom: <span className="text-gray-200">{'' + (Math.round(mapTransform.scale * 100) / 100)}x</span></span>
        <span>| Offset: (<span className="text-gray-200">{'' + Math.round(mapTransform.offset.x)}, {'' + Math.round(mapTransform.offset.y)}</span>)</span>
        <span>| Elements: <span className="text-gray-200">{courseState.elements.length}</span></span>
        <span>| Selected: <span className="text-gray-200">{courseState.selectedElementId?.substring(0,8) || 'None'}</span></span>
        {processedMapForDisplay && <span>| Course Length: <span className="text-gray-200">{formatCourseLength(courseLengthMeters)}</span></span>}
        {statusBarMessage && <span className="text-yellow-400">{statusBarMessage}</span>}
      </div>
    </div>
  );
};

export default App;