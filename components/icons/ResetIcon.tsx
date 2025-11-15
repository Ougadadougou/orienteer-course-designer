import React from 'react';

export const ResetIcon: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    className={`w-5 h-5 ${className}`}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 12a9 9 0 1 1-3-6.708" />
    <polyline points="21 3 21 9 15 9" />
  </svg>
);
