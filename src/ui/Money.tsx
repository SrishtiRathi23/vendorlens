import { formatINR, type Paise } from "@/domain/money";

/** A rupee amount in tabular figures. `null` renders as the word "unknown", never as ₹0. */
export function Money({ paise, className = "" }: { paise: Paise | null; className?: string }) {
  if (paise === null) return <span className={`text-brick italic ${className}`}>unknown</span>;
  return <span className={`figures ${className}`}>{formatINR(paise)}</span>;
}
