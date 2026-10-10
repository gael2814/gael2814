import type { Metadata } from "next";
import { getPublicMenu, imageUrl } from "@/lib/menu";
import { getCurrentPreorderStatus } from "@/lib/public-status";
import { SiteHeader } from "@/components/SiteHeader";
import { OrderApp } from "@/components/order/OrderApp";
import { preorderSubtext } from "@/components/PreorderBadge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Preorder Lunch" };

export default async function OrderPage() {
  const [{ settings, status }, menu] = await Promise.all([getCurrentPreorderStatus(), getPublicMenu()]);
  return (
    <>
      <SiteHeader logoUrl={imageUrl(settings.business.logoImageId)} showOrderButton={false} />
      <OrderApp
        initialMenu={menu}
        initialStatus={{ open: status.open, message: status.message, sub: preorderSubtext(status, settings.schedule) }}
        taxRateBps={settings.tax.rateBps}
        taxLabel={settings.tax.label}
        allergyNotice={settings.business.allergyNotice}
        address={`${settings.business.addressLine1}, ${settings.business.city}`}
      />
    </>
  );
}
