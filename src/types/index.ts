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
  priority: "urgent" | "high" | "medium" | "low";
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
  priority: "urgent" | "high" | "medium" | "low";
  completed: boolean;
  assignee: string;
}

export interface Company {
  id: string;
  name: string;
  industry: string;
  location: string;
  status: "active" | "inactive" | "lead";
  contacts: number;
  revenue: string;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  role: string;
  status: "active" | "inactive";
}

export interface Lead {
  id: string;
  name: string;
  company: string;
  value: number;
  stage: string;
  probability: number;
  assignedTo: string;
}

export interface Vendor {
  id: string;
  name: string;
  category: string;
  contact: string;
  email: string;
  status: "active" | "inactive" | "pending";
  rating: number;
}

export interface JobItem {
  id: string;
  title: string;
  company: string;
  location: string;
  type: "full-time" | "part-time" | "contract" | "remote";
  status: "open" | "closed" | "draft";
  applicants: number;
}
