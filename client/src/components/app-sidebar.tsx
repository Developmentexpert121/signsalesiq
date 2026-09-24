import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/lib/auth";
import { ENABLE_GBB_TIERS } from "@/lib/featureFlags";
import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  LogOut,
  Shield,
  ImageIcon,
  Type,
  Building2,
  Crown,
  BarChart3,
  FileDown,
  BookOpen,
  Mail,
  Ruler,
} from "lucide-react";
import logoImg from "@assets/signsalesiq-logo-v2-trimmed.png";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export function AppSidebar() {
  const { user, logout, isSuperAdmin, isTenantAdmin } = useAuth();
  const [location] = useLocation();

  const mainItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Opportunities", url: "/opportunities", icon: FolderOpen },
    { title: "Reference Measurements", url: "/measurements", icon: Ruler },
  ];

  // Owners, Users and Subscription are now managed centrally in SignSuiteIQ,
  // so those tabs are intentionally hidden from the SignSalesIQ sidebar.
  const superAdminItems = isSuperAdmin
    ? [
        { title: "Sign Types", url: "/admin/sign-types", icon: Type },
        ...(ENABLE_GBB_TIERS
          ? [{ title: "Rules Engine", url: "/admin/rules", icon: Settings }]
          : []),
        { title: "Reference Images", url: "/admin/references", icon: ImageIcon },
        { title: "Platform Stats", url: "/admin/usage", icon: BarChart3 },
        { title: "Email Templates", url: "/admin/email-templates", icon: Mail },
      ]
    : [];

  const tenantAdminItems =
    isTenantAdmin && !isSuperAdmin
      ? [
          { title: "Company Settings", url: "/admin/company", icon: Building2 },
          ...(ENABLE_GBB_TIERS
            ? [{ title: "Rules Engine", url: "/admin/rules", icon: Settings }]
            : []),
        ]
      : [];

  const roleBadge = isSuperAdmin ? "Super Admin" : isTenantAdmin ? "Admin" : null;
  const roleIcon = isSuperAdmin ? Crown : Shield;
  const RoleIcon = roleIcon;

  return (
    <Sidebar>
      <SidebarHeader className="p-5 pb-4">
        <Link href="/" className="flex items-center justify-center">
          <img src={logoImg} alt="SignSalesIQ" className="max-w-full h-12 object-contain" />
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    data-active={
                      location === item.url || (item.url !== "/" && location.startsWith(item.url))
                    }
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {superAdminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Platform Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {superAdminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-active={location.startsWith(item.url)}>
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {isSuperAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Manuals</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a
                      href="/api/docs/super-admin-manual"
                      download="SignSalesIQ_Super_Admin_Manual.pdf"
                      data-testid="link-download-super-admin-manual"
                    >
                      <Crown className="h-4 w-4" />
                      <span>Super Admin Manual</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a
                      href="/api/docs/owner-admin-manual"
                      download="SignSalesIQ_Owner_Admin_Manual.pdf"
                      data-testid="link-download-owner-admin-manual"
                    >
                      <Building2 className="h-4 w-4" />
                      <span>Owner Admin Manual</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a
                      href="/api/docs/sales-user-manual"
                      download="SignSalesIQ_Sales_User_Manual.pdf"
                      data-testid="link-download-sales-manual"
                    >
                      <BookOpen className="h-4 w-4" />
                      <span>Sales User Manual</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <a
                      href="/api/docs/developer-guide"
                      download="SignSalesIQ_Developer_Guide.pdf"
                      data-testid="link-download-dev-guide"
                    >
                      <FileDown className="h-4 w-4" />
                      <span>Developer Guide</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {tenantAdminItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Team Management</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {tenantAdminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild data-active={location.startsWith(item.url)}>
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        {user && (
          <div className="flex items-center gap-2">
            <Link
              href="/profile"
              data-testid="link-profile"
              className="flex items-center gap-2 flex-1 min-w-0 rounded-md hover:bg-accent p-1 -m-1 transition-colors cursor-pointer"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs bg-primary/10 text-primary">
                  {user.name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {roleBadge && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0">
                      <RoleIcon className="h-2.5 w-2.5 mr-0.5" />
                      {roleBadge}
                    </Badge>
                  )}
                  {user.tenantName && (
                    <span className="text-[10px] text-muted-foreground truncate">
                      {user.tenantName}
                    </span>
                  )}
                </div>
              </div>
            </Link>
            <Button
              data-testid="button-logout"
              size="icon"
              variant="ghost"
              onClick={() => logout.mutate()}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
