import type { Metadata } from "next";
import { IdeasView } from "@/features/ideas/IdeasView";

export const metadata: Metadata = { title: "Ideas" };

export default function IdeasPage() {
  return <IdeasView />;
}
