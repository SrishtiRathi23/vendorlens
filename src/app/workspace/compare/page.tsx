import type { Metadata } from "next";
import { CompareView } from "@/features/compare/CompareView";

export const metadata: Metadata = { title: "Compare quotes" };

export default function ComparePage() {
  return <CompareView />;
}
