
import React from 'react';
import { IconBase } from './IconBase';

export const PanIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <IconBase {...props} viewBox="0 0 24 24" strokeWidth="1.5">
    {/* Grabbing hand icon */}
    <path d="M8 10a2 2 0 1 0-4 0v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-1a2 2 0 1 0-4 0v1"></path>
    <path d="M12.5 9.5A2.5 2.5 0 0 0 10 12v5a2.5 2.5 0 0 0 2.5 2.5h1A2.5 2.5 0 0 0 16 17v-1a2.5 2.5 0 1 0-5 0v1"></path>
    <path d="M10 12h1.5a2.5 2.5 0 0 0 0-5H10Z"></path>
  </IconBase>
);