"use client";

import React, { useCallback, useRef } from "react";
import { WindowInstance } from "@/types";
import { useWindowManager } from "@/context/WindowContext";
import { WindowTitleBar } from "./WindowTitleBar";

interface WindowProps {
  instance: WindowInstance;
}

export function Window({ instance }: WindowProps) {
  const { closeWindow, focusWindow, moveWindow, focusedWindowId } =
    useWindowManager();
  const dragRef = useRef<{
    isDragging: boolean;
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    startPosX: 0,
    startPosY: 0,
  });

  const handleTitleBarMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      focusWindow(instance.id);

      const drag = dragRef.current;
      drag.isDragging = true;
      drag.startX = e.clientX;
      drag.startY = e.clientY;
      drag.startPosX = instance.position.x;
      drag.startPosY = instance.position.y;

      function onMouseMove(e: MouseEvent) {
        if (!drag.isDragging) return;
        const dx = e.clientX - drag.startX;
        const dy = e.clientY - drag.startY;
        moveWindow(instance.id, {
          x: drag.startPosX + dx,
          y: drag.startPosY + dy,
        });
      }

      function onMouseUp() {
        drag.isDragging = false;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [instance.id, instance.position.x, instance.position.y, focusWindow, moveWindow]
  );

  const isFocused = focusedWindowId === instance.id;

  return (
    <div
      onClick={() => focusWindow(instance.id)}
      className={`absolute rounded-lg border shadow-2xl overflow-hidden ${
        isFocused
          ? "border-white/20 bg-gray-900/90 backdrop-blur-lg"
          : "border-white/5 bg-gray-900/80 backdrop-blur-sm"
      }`}
      style={{
        left: instance.position.x,
        top: instance.position.y,
        width: instance.size.width,
        height: instance.size.height,
        zIndex: instance.zIndex,
      }}
    >
      <WindowTitleBar
        title={instance.title}
        onClose={() => closeWindow(instance.id)}
        onMouseDown={handleTitleBarMouseDown}
      />
      <div className="p-4 text-sm text-gray-300">
        <p className="text-center text-gray-500 mt-16">
          {instance.title} — App content goes here
        </p>
      </div>
    </div>
  );
}
