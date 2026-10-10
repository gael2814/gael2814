import { getNow, serviceDateOf } from "@/lib/time";
import { ProductionView } from "@/components/staff/ProductionView";
export const metadata = { title: "Production" };
export const dynamic = "force-dynamic";

export default function ProductionPage() {
  return <ProductionView today={serviceDateOf(getNow())} />;
}
