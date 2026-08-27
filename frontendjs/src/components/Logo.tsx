import React from 'react';
import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("bg-black flex items-center justify-center relative shrink-0 overflow-hidden", className)}>
      <div className="absolute w-[2px] h-full bg-white left-1/2 -translate-x-1/2 z-0"></div>
      <div className="z-10 flex items-center gap-[1px] text-white font-bold uppercase tracking-[0.1em] text-[10px] bg-black px-0.5">
        <span>B</span>
        <span>N</span>
        <span>B</span>
      </div>
    </div>
  );
}
