export interface App {
  id: string;
  name: string;
  icon: string;
  description: string;
  route: string;
}

export interface DesktopIconData {
  id: string;
  appId: string;
  label: string;
  icon: string;
  position: { x: number; y: number };
}

export interface WindowInstance {
  id: string;
  appId: string;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  zIndex: number;
  isMinimized: boolean;
}

export interface WindowContextType {
  windows: WindowInstance[];
  focusedWindowId: string | null;
  openWindow: (appId: string) => void;
  closeWindow: (windowId: string) => void;
  focusWindow: (windowId: string) => void;
  moveWindow: (windowId: string, pos: { x: number; y: number }) => void;
}
