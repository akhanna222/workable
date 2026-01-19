'use client';

import * as ResizablePrimitive from 'react-resizable-panels';
import { cn } from '@/lib/utils';

export function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) {
  return (
    <ResizablePrimitive.PanelGroup
      className={cn('flex h-full w-full', className)}
      {...props}
    />
  );
}

export const ResizablePanel = ResizablePrimitive.Panel;

export function ResizableHandle({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
  withHandle?: boolean;
}) {
  return (
    <ResizablePrimitive.PanelResizeHandle
      className={cn(
        'relative flex w-px items-center justify-center bg-gray-800 after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 hover:bg-blue-500 transition-colors',
        className
      )}
      {...props}
    >
      {withHandle && (
        <div className="z-10 flex h-4 w-3 items-center justify-center rounded-sm border border-gray-700 bg-gray-800">
          <svg
            width="6"
            height="10"
            viewBox="0 0 6 10"
            fill="currentColor"
            className="text-gray-500"
          >
            <circle cx="1" cy="2" r="1" />
            <circle cx="1" cy="5" r="1" />
            <circle cx="1" cy="8" r="1" />
            <circle cx="5" cy="2" r="1" />
            <circle cx="5" cy="5" r="1" />
            <circle cx="5" cy="8" r="1" />
          </svg>
        </div>
      )}
    </ResizablePrimitive.PanelResizeHandle>
  );
}
