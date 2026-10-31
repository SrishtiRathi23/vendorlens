import type { Metadata } from "next";
import { VendorsView } from "@/features/vendors/VendorsView";

export const metadata: Metadata = { title: "Vendors" };

export default function VendorsPage() {
  return <VendorsView />;
}
