
export interface Point {
  x: number;
  y: number;
}

export enum Tool {
  SELECT = 'SELECT',
  PAN = 'PAN',
  START = 'START',
  CONTROL = 'CONTROL',
  FINISH = 'FINISH',
  LEG = 'LEG',
  AREA_FORBIDDEN = 'AREA_FORBIDDEN',
  AREA_CORRIDOR = 'AREA_CORRIDOR',
}

export interface CourseElementBase {
  id: string;
  type: ElementType;
}

export enum ElementType {
  START = 'START',
  CONTROL = 'CONTROL',
  FINISH = 'FINISH',
  LEG = 'LEG',
  AREA = 'AREA',
}

export interface StartElement extends CourseElementBase {
  type: ElementType.START;
  center: Point;
  // size property removed
  rotationAngle?: number; // Optional: in radians, for orientation
}

export interface ControlDescriptionData {
  A_number: string; // Control number (auto)
  B_code: string;
  C_whichFeature: string;
  D_featureDetail: string;
  E_dimensions: string;
  F_location: string;
  G_betweenObjects: string;
  H_specialInstructions: string;
}

export const getDefaultControlDescription = (num: number): ControlDescriptionData => ({
  A_number: num.toString(),
  B_code: '',
  C_whichFeature: '',
  D_featureDetail: '',
  E_dimensions: '',
  F_location: '',
  G_betweenObjects: '',
  H_specialInstructions: '',
});

export interface ControlElement extends CourseElementBase {
  type: ElementType.CONTROL;
  center: Point;
  // radius property removed
  number: number;
  description: ControlDescriptionData;
}

export interface FinishElement extends CourseElementBase {
  type: ElementType.FINISH;
  center: Point;
  // outerRadius and innerRadius properties removed
}

export interface LegElement extends CourseElementBase {
  type: ElementType.LEG;
  fromElementId: string; // ID of the StartElement, ControlElement or FinishElement
  toElementId: string;   // ID of the StartElement, ControlElement or FinishElement
  style: 'solid' | 'dashed' | 'uncrossable';
}

export enum AreaKind {
  FORBIDDEN = 'FORBIDDEN',
  CORRIDOR = 'CORRIDOR',
}

export interface AreaElement extends CourseElementBase {
  type: ElementType.AREA;
  points: Point[];
  kind: AreaKind;
}

export type CourseElement = StartElement | ControlElement | FinishElement | LegElement | AreaElement;

export interface MapTransform {
  scale: number;
  offset: Point; // Top-left corner of the viewport in page coordinates
}

export interface CourseData {
  elements: CourseElement[];
  mapFileName?: string; // Optional: to remind user which map was used
  // Potentially store UI scale settings in the future if desired
  // startSymbolScaleUI?: number;
  // controlSymbolScaleUI?: number;
  // finishSymbolScaleUI?: number;
}

// PDF.js types (simplified, actual types are more complex)
export interface PDFDocumentProxy {
  numPages: number;
  getPage(pageNumber: number): Promise<PDFPageProxy>;
}

export interface PDFPageProxy {
  getViewport(params: { scale: number; rotation?: number }): PDFPageViewPort;
  render(params: RenderParameters): RenderTask;
  cleanup(): void;
}

export interface PDFPageViewPort {
  width: number;
  height: number;
  scale: number;
  rotation: number;
  offsetX: number;
  offsetY: number;
  transform: number[]; // [scaleX, skewY, skewX, scaleY, Px, Py]
  clone(options: { scale?: number; rotation?: number; dontFlip?: boolean }): PDFPageViewPort;
}

export interface RenderParameters {
  canvasContext: CanvasRenderingContext2D;
  viewport: PDFPageViewPort;
  transform?: number[];
  background?: string;
  enableWebGL?: boolean;
}

export interface RenderTask {
  promise: Promise<void>;
  cancel(): void;
}

export type MapScaleMode = 'none' | 'ratio' | 'referenceLength';

export interface MapScaleSettings {
  mode: MapScaleMode;
  ratioValue?: number;         // For 'ratio' mode, e.g., 10000 for 1:10000
  mapUnitsOnScreen?: number;   // For 'referenceLength' mode, e.g., distance measured on map in pixels/points
  realWorldMeters?: number;    // For 'referenceLength' mode, e.g., corresponding real distance in meters
}


// Ensure pdfjsLib is available globally (from CDN)
declare global {
  const pdfjsLib: {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument(src: string | Uint8Array | { data: ArrayBuffer }): { promise: Promise<PDFDocumentProxy> };
    version: string; 
  };
  
  // For jsPDF loaded from CDN (jspdf.umd.min.js exposes it as window.jspdf.jsPDF)
  // eslint-disable-next-line no-unused-vars
  namespace jspdf {
    class jsPDF {
      constructor(options?: any);
      addImage(
        imageData: string | HTMLImageElement | HTMLCanvasElement | Uint8Array,
        format: string,
        x: number,
        y: number,
        width: number,
        height: number,
        alias?: string,
        compression?: string,
        rotation?: number
      ): this;
      save(filename?: string, options?: { returnPromise?: boolean }): Promise<void> | void;
      // Add other methods as needed
    }
  }
  interface Window {
    jspdf: {
        jsPDF: typeof jspdf.jsPDF;
    };
  }

  // For heic2any loaded from CDN
  function heic2any(options: {
    blob: Blob;
    toType?: string; // e.g., "image/jpeg"
    quality?: number; // 0 to 1
  }): Promise<Blob>;
}