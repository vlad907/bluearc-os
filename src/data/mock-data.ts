import { NavItem, KPIData, Activity, FollowUp, PipelineStage, Task } from "@/types";

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard", href: "/" },
  { id: "companies", label: "Companies", icon: "Building2", href: "/companies" },
  { id: "contacts", label: "Contacts", icon: "Users", href: "/contacts" },
  { id: "leads", label: "Leads", icon: "TrendingUp", href: "/leads" },
  { id: "vendors", label: "Vendors", icon: "Truck", href: "/vendors" },
  { id: "jobs", label: "Jobs", icon: "Briefcase", href: "/jobs" },
  { id: "tasks", label: "Tasks", icon: "CheckSquare", href: "/tasks" },
  { id: "settings", label: "Settings", icon: "Settings", href: "/settings" },
];

export const KPI_DATA: KPIData[] = [
  { id: "kpi-1", label: "Total Revenue", value: "$284,500", change: 12.5, trend: "up", icon: "DollarSign" },
  { id: "kpi-2", label: "Active Leads", value: 1, change: -3.2, trend: "down", icon: "Users" },
  { id: "kpi-3", label: "Conversion Rate", value: "24.8%", change: 4.1, trend: "up", icon: "TrendingUp" },
  { id: "kpi-4", label: "Open Jobs", value: 18, change: 2, trend: "up", icon: "Briefcase" },
  { id: "kpi-5", label: "Avg Response Time", value: "2.4h", change: -8.7, trend: "down", icon: "Clock" },
  { id: "kpi-6", label: "Customer Satisfaction", value: "94%", change: 1.8, trend: "up", icon: "Smile" },
];

export const RECENT_ACTIVITIES: Activity[] = [
  { id: "act-1", type: "lead", description: "Sarah Chen was added as a new lead from Acme Corp", timestamp: "2 min ago", user: "You", avatar: "SC" },
  { id: "act-2", type: "deal", description: "Q4 Software deal moved to Negotiation stage", timestamp: "15 min ago", user: "Mike R.", avatar: "MR" },
  { id: "act-3", type: "task", description: "Follow-up call with GlobalTech completed", timestamp: "1 hour ago", user: "You", avatar: "YO" },
  { id: "act-4", type: "company", description: "New vendor Northern Supply added to vendors", timestamp: "3 hours ago", user: "Lisa K.", avatar: "LK" },
  { id: "act-5", type: "email", description: "Proposal sent to Dr. Emily Watson", timestamp: "1 day ago", user: "You", avatar: "YO" },
];

export const FOLLOW_UPS: FollowUp[] = [
  { id: "fu-1", contact: "James Wilson", company: "TechNova Inc", dueDate: "Today", priority: "high" },
  { id: "fu-2", contact: "Maria Garcia", company: "GreenLeaf Solutions", dueDate: "Tomorrow", priority: "high" },
  { id: "fu-3", contact: "Alex Kim", company: "Pinnacle Partners", dueDate: "Jul 10", priority: "medium" },
  { id: "fu-4", contact: "Rachel Adams", company: "Blue Ridge Corp", dueDate: "Jul 12", priority: "low" },
];

export const PIPELINE_STAGES: PipelineStage[] = [
  { id: "stage-1", name: "Qualification", value: 85000, count: 12, color: "bg-blue-500" },
  { id: "stage-2", name: "Discovery", value: 145000, count: 8, color: "bg-indigo-500" },
  { id: "stage-3", name: "Proposal", value: 220000, count: 5, color: "bg-violet-500" },
  { id: "stage-4", name: "Negotiation", value: 180000, count: 3, color: "bg-emerald-500" },
];

export const UPCOMING_TASKS: Task[] = [
  { id: "task-1", title: "Send proposal to Acme Corp", dueDate: "Today", priority: "high", completed: false, assignee: "You" },
  { id: "task-2", title: "Review vendor contract from Northern Supply", dueDate: "Tomorrow", priority: "high", completed: false, assignee: "You" },
  { id: "task-3", title: "Update pipeline for Q3 forecasts", dueDate: "Jul 9", priority: "medium", completed: false, assignee: "You" },
  { id: "task-4", title: "Schedule team standup for project Atlas", dueDate: "Jul 10", priority: "medium", completed: true, assignee: "You" },
  { id: "task-5", title: "Prepare monthly report for stakeholders", dueDate: "Jul 15", priority: "low", completed: false, assignee: "You" },
];
