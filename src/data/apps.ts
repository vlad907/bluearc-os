import { App } from "@/types";

export const MOCK_APPS: App[] = [
  { id: "files", name: "Files", icon: "📁", description: "Browse and manage files", route: "/app/files" },
  { id: "terminal", name: "Terminal", icon: "💻", description: "Command-line interface", route: "/app/terminal" },
  { id: "settings", name: "Settings", icon: "⚙️", description: "System preferences", route: "/app/settings" },
  { id: "notepad", name: "Notepad", icon: "📝", description: "Simple text editor", route: "/app/notepad" },
  { id: "camera", name: "Camera", icon: "📷", description: "Take photos", route: "/app/camera" },
  { id: "music", name: "Music", icon: "🎵", description: "Play music", route: "/app/music" },
];
