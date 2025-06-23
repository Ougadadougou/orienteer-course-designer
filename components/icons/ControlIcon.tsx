
import React from 'react';
import { IconBase } from './IconBase';

export const ControlIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <IconBase {...props}>
    <circle cx="12" cy="12" r="10" />
  </IconBase>
);