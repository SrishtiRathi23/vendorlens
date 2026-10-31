import { WorkspaceShell } from "@/features/workspace/WorkspaceShell";

export default function WorkspaceLayout({ children }: LayoutProps<"/workspace">) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
