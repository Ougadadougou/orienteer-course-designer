
import React from 'react';
import { IconBase } from './IconBase';

export const LegIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <IconBase {...props}>
    <line x1="4" y1="12" x2="20" y2="12" />
    <circle cx="4" cy="12" r="2" fill="currentColor"/>
    <circle cx="20" cy="12" r="2" fill="currentColor"/>
  </IconBase>
);