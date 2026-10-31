import type { Metadata } from "next";
import { BudgetView } from "@/features/budget/BudgetView";

export const metadata: Metadata = { title: "Budget" };

export default function BudgetPage() {
  return <BudgetView />;
}
