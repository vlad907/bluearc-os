export interface NavItem {
  id: string;
  label: string;
  icon: string;
  href: string;
}

export interface KPIData {
  id: string;
  label: string;
  value: string | number;
  change: number;
  trend: "up" | "down";
  icon: string;
}

export interface Activity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  user: string;
  avatar: string;
}

export interface FollowUp {
  id: string;
  contact: string;
  company: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
}

export interface PipelineStage {
  id: string;
  name: string;
  value: number;
  count: number;
  color: string;
}

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
  completed: boolean;
  assignee: string;
}
