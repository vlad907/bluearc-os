export function classNames(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function getPriorityColor(priority: string) {
  switch (priority) {
    case "urgent": return "text-red-700 dark:text-red-300";
    case "high": return "text-red-600 dark:text-red-400";
    case "medium": return "text-amber-600 dark:text-amber-400";
    case "low": return "text-green-600 dark:text-green-400";
    default: return "text-gray-500";
  }
}

export function getPriorityBadge(priority: string) {
  switch (priority) {
    case "urgent": return "bg-red-200 text-red-800 dark:bg-red-950/60 dark:text-red-300";
    case "high": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
    case "medium": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
    case "low": return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
    default: return "bg-gray-100 text-gray-700";
  }
}
