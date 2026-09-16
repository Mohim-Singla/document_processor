import React from 'react';

export default function Tooltip({
  children,
  content,
  position = 'top',
  className = '',
}) {
  if (!content) return children;

  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
    'top-start': 'bottom-full left-0 mb-2',
    'top-end': 'bottom-full right-0 mb-2',
    'bottom-start': 'top-full left-0 mt-2',
    'bottom-end': 'top-full right-0 mt-2',
  };

  return (
    <div className={`group/tooltip relative inline-flex items-center justify-center ${className}`}>
      {children}
      <div
        role="tooltip"
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-lg bg-slate-900/95 backdrop-blur-md border border-slate-700/80 px-2.5 py-1 text-[11px] font-medium text-slate-100 shadow-xl opacity-0 invisible group-hover/tooltip:opacity-100 group-hover/tooltip:visible transition-all duration-200 delay-0 group-hover/tooltip:delay-[400ms] ${
          positionClasses[position] || positionClasses.top
        }`}
      >
        {content}
      </div>
    </div>
  );
}
