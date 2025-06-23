
import { Point } from './types';

export const DEFAULT_MAP_SCALE = 1;
export const DEFAULT_MAP_OFFSET: Point = { x: 0, y: 0 };

// Base sizes for elements in map units (when their UI scale is 5)
export const BASE_START_SIZE_MAP_UNITS = 30; // Increased from 20
export const BASE_CONTROL_RADIUS_MAP_UNITS = 15; // Increased from 10
export const BASE_FINISH_OUTER_RADIUS_MAP_UNITS = 18; // Increased from 12
export const FINISH_INNER_RADIUS_PROPORTION = 2/3; 

// Colors with increased transparency (alpha 0.7 for most, 0.25 for forbidden)
export const IOF_PURPLE = 'rgba(90, 0, 123, 0.7)'; 
export const IOF_RED_FORBIDDEN = 'rgba(255, 0, 0, 0.25)'; 
export const SELECTED_ELEMENT_COLOR = 'rgba(0, 123, 255, 0.7)'; 

// Base feature sizes in map units (will be scaled by symbol UI scale and then by map zoom for screen display)
export const SYMBOL_BASE_LINE_WIDTH_MAP_UNITS = 1; 
export const LEG_BASE_LINE_WIDTH_MAP_UNITS = 0.75; // Reduced from 1.5
export const CONTROL_NUMBER_BASE_FONT_SIZE_MAP_UNITS = 12; // Increased from 10
export const TEXT_GAP_ABOVE_CONTROL_MAP_UNITS = 3; 

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 10;
export const ZOOM_SENSITIVITY = 0.001;

export const TEMP_AREA_POINT_RADIUS = 3; 
export const TEMP_AREA_LINE_COLOR = 'rgba(0, 123, 255, 0.7)';
export const AREA_CORRIDOR_FILL = 'rgba(255, 255, 255, 0.7)'; 
export const AREA_STROKE_COLOR = 'rgba(51, 51, 51, 0.7)';

export const LEG_CONNECTION_GAP = 4; // Gap in map units.

// For PDF scale calculation: (72 points/inch * 39.3701 inches/meter)
export const POINTS_PER_METER_AT_1_TO_1_SCALE = 2834.64567;