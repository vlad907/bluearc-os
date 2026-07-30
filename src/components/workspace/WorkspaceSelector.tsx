"use client";

import { useOrganization } from "@/context/OrganizationContext";

type WorkspaceSelectorProps = {
  id?: string;
  label?: string;
  hideLabel?: boolean;
  className?: string;
  inputClassName?: string;
  tone?: "default" | "hero";
};

const defaultInputClassName = "w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none";
const heroInputClassName = "w-full px-3 py-2 text-sm bg-white/10 border border-white/15 rounded-lg text-white placeholder:text-indigo-100/50 outline-none focus:ring-2 focus:ring-indigo-300";

export default function WorkspaceSelector({
  id = "workspace-selector",
  label = "Workspace",
  hideLabel = false,
  className = "w-full",
  inputClassName,
  tone = "default",
}: WorkspaceSelectorProps) {
  const { organizationId, setOrganizationId, sessionLoaded, user, workspaces } = useOrganization();
  const selectedWorkspace = workspaces.find((workspace) => workspace.id === organizationId);
  const canSelectMembership = user && workspaces.length > 0;
  const resolvedInputClassName = inputClassName ?? (tone === "hero" ? heroInputClassName : defaultInputClassName);

  return (
    <div className={className}>
      {!hideLabel && (
        <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300" htmlFor={id}>
          {label}
        </label>
      )}
      {canSelectMembership ? (
        <select
          id={id}
          className={resolvedInputClassName}
          value={selectedWorkspace?.id ?? organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name} · {workspace.role}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          className={resolvedInputClassName}
          placeholder={sessionLoaded ? "Workspace ID" : "Loading workspace..."}
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
        />
      )}
      {!canSelectMembership && sessionLoaded && (
        <p className={tone === "hero" ? "mt-1 text-xs text-indigo-100/60" : "mt-1 text-xs text-gray-500 dark:text-gray-500"}>
          Development fallback: sign in or create an account to select a workspace by name.
        </p>
      )}
    </div>
  );
}
