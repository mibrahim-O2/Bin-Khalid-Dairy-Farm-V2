import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Package,
  Truck,
  Wheat,
  HandCoins,
  BarChart3,
  Settings,
  UserCheck,
  Milk,
  PawPrint,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hidden from anyone but the account owner (see src/lib/auth/owner.ts). */
  ownerOnly?: boolean;
};

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/customers", label: "Customers", icon: Users },
  { href: "/dashboard/milk-record", label: "Milk Record", icon: Milk },
  { href: "/dashboard/products", label: "Products", icon: Package },
  { href: "/dashboard/suppliers", label: "Suppliers", icon: Truck },
  { href: "/dashboard/farm-supplies", label: "Farm Supplies", icon: Wheat },
  { href: "/dashboard/livestock", label: "Livestock", icon: PawPrint },
  { href: "/dashboard/employees", label: "Employees", icon: HandCoins },
  { href: "/dashboard/reports", label: "Reports", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
  { href: "/dashboard/pending-users", label: "Pending Users", icon: UserCheck, ownerOnly: true },
];
