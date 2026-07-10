import {
  NavItem, KPIData, Activity, FollowUp, PipelineStage, Task,
  Company, Contact, Lead, Vendor, JobItem,
} from "@/types";

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard", href: "/" },
  { id: "companies", label: "Companies", icon: "Building2", href: "/companies" },
  { id: "contacts", label: "Contacts", icon: "Users", href: "/contacts" },
  { id: "leads", label: "Leads", icon: "TrendingUp", href: "/leads" },
  { id: "vendors", label: "Vendors", icon: "Truck", href: "/vendors" },
  { id: "jobs", label: "Jobs", icon: "Briefcase", href: "/jobs" },
  { id: "outreach", label: "Outreach", icon: "Mail", href: "/outreach" },
  { id: "tasks", label: "Tasks", icon: "CheckSquare", href: "/tasks" },
  { id: "settings", label: "Settings", icon: "Settings", href: "/settings" },
];

export const CRM_COMMAND_ITEMS: NavItem[] = [
  { id: "discovery", label: "Discovery", icon: "Search", href: "/discovery" },
  { id: "partners", label: "Partnerships", icon: "Users", href: "/partners" },
  { id: "automation", label: "Automation", icon: "Zap", href: "/automation" },
];

export const KPI_DATA: KPIData[] = [
  { id: "kpi-1", label: "Total Revenue", value: "$284,500", change: 12.5, trend: "up", icon: "DollarSign" },
  { id: "kpi-2", label: "Active Leads", value: 243, change: -3.2, trend: "down", icon: "Users" },
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

export const COMPANIES: Company[] = [
  { id: "co-1", name: "Acme Corp", industry: "Technology", location: "San Francisco, CA", status: "active", contacts: 12, revenue: "$2.4M" },
  { id: "co-2", name: "GlobalTech Solutions", industry: "Enterprise Software", location: "New York, NY", status: "active", contacts: 8, revenue: "$5.1M" },
  { id: "co-3", name: "GreenLeaf Solutions", industry: "Clean Energy", location: "Austin, TX", status: "active", contacts: 5, revenue: "$890K" },
  { id: "co-4", name: "Pinnacle Partners", industry: "Consulting", location: "Chicago, IL", status: "lead", contacts: 3, revenue: "$420K" },
  { id: "co-5", name: "Blue Ridge Corp", industry: "Manufacturing", location: "Denver, CO", status: "inactive", contacts: 2, revenue: "$1.1M" },
  { id: "co-6", name: "Northern Supply Co", industry: "Logistics", location: "Seattle, WA", status: "active", contacts: 7, revenue: "$3.2M" },
];

export const CONTACTS: Contact[] = [
  { id: "ct-1", name: "Sarah Chen", email: "sarah@acmecorp.com", phone: "(415) 555-0102", company: "Acme Corp", role: "VP of Engineering", status: "active" },
  { id: "ct-2", name: "James Wilson", email: "jwilson@globaltech.io", phone: "(212) 555-0198", company: "GlobalTech Solutions", role: "CTO", status: "active" },
  { id: "ct-3", name: "Maria Garcia", email: "mgarcia@greenleaf.com", phone: "(512) 555-0341", company: "GreenLeaf Solutions", role: "Operations Director", status: "active" },
  { id: "ct-4", name: "Alex Kim", email: "alex@pinnaclepartners.com", phone: "(312) 555-0723", company: "Pinnacle Partners", role: "Senior Partner", status: "active" },
  { id: "ct-5", name: "Rachel Adams", email: "rachel@blueridgecorp.com", phone: "(303) 555-0412", company: "Blue Ridge Corp", role: "Procurement Manager", status: "inactive" },
  { id: "ct-6", name: "Dr. Emily Watson", email: "ewatson@northernsupply.com", phone: "(206) 555-0634", company: "Northern Supply Co", role: "CEO", status: "active" },
  { id: "ct-7", name: "Michael Torres", email: "mtorres@acmecorp.com", phone: "(415) 555-0217", company: "Acme Corp", role: "Product Manager", status: "active" },
  { id: "ct-8", name: "Lisa Kimura", email: "lisa@globaltech.io", phone: "(212) 555-0876", company: "GlobalTech Solutions", role: "Head of Sales", status: "active" },
];

export const LEADS: Lead[] = [
  { id: "ld-1", name: "Oracle Corp", company: "Oracle Corp", value: 120000, stage: "Negotiation", probability: 75, assignedTo: "Mike R." },
  { id: "ld-2", name: "Stripe Integration", company: "Stripe", value: 85000, stage: "Proposal", probability: 60, assignedTo: "You" },
  { id: "ld-3", name: "Atlassian Enterprise", company: "Atlassian", value: 200000, stage: "Discovery", probability: 40, assignedTo: "Lisa K." },
  { id: "ld-4", name: "Shopify Plus Deal", company: "Shopify", value: 95000, stage: "Qualification", probability: 20, assignedTo: "You" },
  { id: "ld-5", name: "Datadog Partnership", company: "Datadog", value: 150000, stage: "Discovery", probability: 35, assignedTo: "Mike R." },
  { id: "ld-6", name: "Vercel Enterprise", company: "Vercel", value: 60000, stage: "Proposal", probability: 55, assignedTo: "You" },
];

export const VENDORS: Vendor[] = [
  { id: "vn-1", name: "CloudScale Hosting", category: "Cloud Infrastructure", contact: "Tom Baker", email: "tom@cloudscale.io", status: "active", rating: 4 },
  { id: "vn-2", name: "DataSync Analytics", category: "Data Platform", contact: "Amy Park", email: "amy@datasync.com", status: "active", rating: 5 },
  { id: "vn-3", name: "SecureMail Pro", category: "Email Security", contact: "John Reed", email: "john@securemail.pro", status: "active", rating: 3 },
  { id: "vn-4", name: "OfficeHub Solutions", category: "Office Software", contact: "Nina Gupta", email: "nina@officehub.com", status: "pending", rating: 0 },
  { id: "vn-5", name: "PayFlow Gateway", category: "Payment Processing", contact: "Carlos Mendez", email: "carlos@payflow.com", status: "active", rating: 4 },
  { id: "vn-6", name: "NetGuard Security", category: "Cybersecurity", contact: "Sarah Blake", email: "sarah@netguard.io", status: "inactive", rating: 2 },
];

export const JOBS: JobItem[] = [
  { id: "jb-1", title: "Senior Frontend Engineer", company: "Acme Corp", location: "San Francisco, CA", type: "full-time", status: "open", applicants: 24 },
  { id: "jb-2", title: "Backend Developer (Go)", company: "GlobalTech Solutions", location: "Remote", type: "remote", status: "open", applicants: 18 },
  { id: "jb-3", title: "Product Design Lead", company: "GreenLeaf Solutions", location: "Austin, TX", type: "full-time", status: "open", applicants: 31 },
  { id: "jb-4", title: "DevOps Engineer", company: "Pinnacle Partners", location: "Chicago, IL", type: "contract", status: "draft", applicants: 0 },
  { id: "jb-5", title: "Data Analyst", company: "Blue Ridge Corp", location: "Denver, CO", type: "part-time", status: "closed", applicants: 12 },
  { id: "jb-6", title: "Customer Success Manager", company: "Northern Supply Co", location: "Seattle, WA", type: "full-time", status: "open", applicants: 9 },
];

export const TASKS_LIST: Task[] = [
  { id: "tsk-1", title: "Send proposal to Acme Corp", dueDate: "Today", priority: "high", completed: false, assignee: "You" },
  { id: "tsk-2", title: "Review vendor contract from Northern Supply", dueDate: "Tomorrow", priority: "high", completed: false, assignee: "You" },
  { id: "tsk-3", title: "Update pipeline for Q3 forecasts", dueDate: "Jul 9", priority: "medium", completed: false, assignee: "You" },
  { id: "tsk-4", title: "Schedule team standup for project Atlas", dueDate: "Jul 10", priority: "medium", completed: true, assignee: "You" },
  { id: "tsk-5", title: "Prepare monthly report for stakeholders", dueDate: "Jul 15", priority: "low", completed: false, assignee: "You" },
  { id: "tsk-6", title: "Research new CRM integrations", dueDate: "Jul 16", priority: "low", completed: false, assignee: "You" },
  { id: "tsk-7", title: "Set up Q4 OKRs with team leads", dueDate: "Jul 18", priority: "medium", completed: false, assignee: "You" },
  { id: "tsk-8", title: "Review Q2 financial report", dueDate: "Jul 20", priority: "low", completed: true, assignee: "You" },
];
