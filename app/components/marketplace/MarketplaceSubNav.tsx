"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

const tabs = [
  { label: "Browse", href: "/marketplace" },
  { label: "My Listings", href: "/marketplace/my-listings" },
  { label: "Purchases", href: "/marketplace/purchases" },
  { label: "Sales", href: "/marketplace/sales" },
  { label: "My Bids", href: "/marketplace/bids" },
  { label: "Saved", href: "/marketplace/saved" },
  { label: "Transactions", href: "/marketplace/transactions" },
];

export default function MarketplaceSubNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${
              active
                ? "bg-pink-500/10 text-pink-400 border border-pink-500/30"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
