import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import {
  Users,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  Check,
  X,
  Shield,
  Crown,
  Phone,
  Mail,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import type { User, Tenant } from "@shared/schema";

type SafeUser = Omit<User, "passwordHash">;

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  SALES: "Sales",
  ACCOUNT_MANAGER: "Account Manager",
  PROJECT_MANAGER: "Project Manager",
  OUTSIDE_SALES: "Outside Sales",
  INSIDE_SALES: "Inside Sales",
  SALES_MANAGER: "Sales Manager",
  DESIGNER: "Designer",
  PRODUCTION_MANAGER: "Production Manager",
};

const BASE_ASSIGNABLE_ROLES = [
  { value: "ADMIN", label: "Admin (Owner Manager)" },
  { value: "SALES", label: "Sales" },
  { value: "ACCOUNT_MANAGER", label: "Account Manager" },
  { value: "PROJECT_MANAGER", label: "Project Manager" },
  { value: "OUTSIDE_SALES", label: "Outside Sales" },
  { value: "INSIDE_SALES", label: "Inside Sales" },
  { value: "SALES_MANAGER", label: "Sales Manager" },
  { value: "DESIGNER", label: "Designer" },
  { value: "PRODUCTION_MANAGER", label: "Production Manager" },
];

function getAssignableRoles(isSuperAdmin: boolean) {
  if (isSuperAdmin) {
    return [{ value: "SUPER_ADMIN", label: "Super Admin" }, ...BASE_ASSIGNABLE_ROLES];
  }
  return BASE_ASSIGNABLE_ROLES;
}

function UserRow({
  userItem,
  currentUser,
  isSuperAdmin,
}: {
  userItem: SafeUser;
  currentUser: SafeUser | null;
  isSuperAdmin: boolean;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(userItem.name);
  const [editEmail, setEditEmail] = useState(userItem.email);
  const [editPhone, setEditPhone] = useState(userItem.phone || "");
  const [editRole, setEditRole] = useState<string>(userItem.role);
  const [newPassword, setNewPassword] = useState("");

  const tenantId = isSuperAdmin ? undefined : currentUser?.tenantId;
  const invalidateKey = tenantId ? ["/api/tenants", tenantId, "users"] : ["/api/tenants"];

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("PATCH", `/api/users/${userItem.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      toast({ title: "User updated" });
      setEditing(false);
      setNewPassword("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/users/${userItem.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invalidateKey });
      toast({ title: "User deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const isOwnAccount = currentUser?.id === userItem.id;
  const roleIcon =
    userItem.role === "SUPER_ADMIN" ? Crown : userItem.role === "ADMIN" ? Shield : null;
  const roleLabel = ROLE_LABELS[userItem.role] || userItem.role;

  return (
    <div
      className="flex items-center justify-between gap-3 p-3 border rounded-md"
      data-testid={`user-row-${userItem.id}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          {editing ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Name"
                  className="h-8 text-sm"
                  data-testid={`input-edit-user-name-${userItem.id}`}
                />
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger
                    className="w-44 h-8 text-xs"
                    data-testid={`select-edit-user-role-${userItem.id}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAssignableRoles(isSuperAdmin).map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Email"
                  className="h-8 text-sm"
                  data-testid={`input-edit-user-email-${userItem.id}`}
                />
                <Input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="h-8 text-sm"
                  data-testid={`input-edit-user-phone-${userItem.id}`}
                />
              </div>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password (leave blank to keep)"
                className="h-8 text-sm"
                data-testid={`input-edit-user-password-${userItem.id}`}
              />
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  onClick={() => {
                    const data: any = {
                      name: editName,
                      email: editEmail,
                      phone: editPhone,
                      role: editRole,
                    };
                    if (newPassword) data.password = newPassword;
                    updateMutation.mutate(data);
                  }}
                  disabled={updateMutation.isPending}
                  data-testid={`button-save-user-${userItem.id}`}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3 mr-1" />
                  )}
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditing(false);
                    setEditName(userItem.name);
                    setEditEmail(userItem.email);
                    setEditPhone(userItem.phone || "");
                    setEditRole(userItem.role);
                    setNewPassword("");
                  }}
                >
                  <X className="h-3 w-3 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="font-medium text-sm">{userItem.name}</p>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-0.5">
                  <Mail className="h-3 w-3" /> {userItem.email}
                </span>
                {userItem.phone && (
                  <span className="flex items-center gap-0.5">
                    <Phone className="h-3 w-3" /> {userItem.phone}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      {!editing && (
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="text-xs">
            {roleIcon &&
              (() => {
                const Icon = roleIcon;
                return <Icon className="h-3 w-3 mr-1" />;
              })()}
            {roleLabel}
          </Badge>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => setEditing(true)}
            data-testid={`button-edit-user-${userItem.id}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {!isOwnAccount && userItem.role !== "SUPER_ADMIN" && (
            <Button
              size="icon"
              variant="ghost"
              onClick={() => {
                if (confirm(`Delete user ${userItem.name}?`)) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-user-${userItem.id}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  const { user, isSuperAdmin, isTenantAdmin } = useAuth();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("SALES");
  const [selectedTenant, setSelectedTenant] = useState<string>("");

  const tenantId = user?.tenantId;

  const { data: tenants } = useQuery<Tenant[]>({
    queryKey: ["/api/tenants"],
    enabled: isSuperAdmin,
  });

  const activeTenantId = isSuperAdmin ? selectedTenant || tenants?.[0]?.id : tenantId;

  const { data: usersData, isLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/tenants", activeTenantId, "users"],
    enabled: !!activeTenantId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      email: string;
      phone?: string;
      password: string;
      role: string;
    }) => {
      const res = await apiRequest("POST", `/api/tenants/${activeTenantId}/users`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", activeTenantId, "users"] });
      toast({ title: "User created" });
      setDialogOpen(false);
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setNewPassword("");
      setNewRole("SALES");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  if (!isSuperAdmin && !isTenantAdmin) {
    return (
      <div className="p-3 sm:p-6 text-center">
        <p className="text-muted-foreground">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  const currentTenantName = isSuperAdmin
    ? tenants?.find((t) => t.id === activeTenantId)?.name
    : user?.tenantName;

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1
            className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2"
            data-testid="text-users-title"
          >
            <Users className="h-6 w-6" /> User Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {currentTenantName ? `Manage users for ${currentTenantName}` : "Manage team members"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isSuperAdmin && tenants && tenants.length > 0 && (
            <Select value={activeTenantId || ""} onValueChange={setSelectedTenant}>
              <SelectTrigger className="w-48" data-testid="select-tenant-filter">
                <SelectValue placeholder="Select owner..." />
              </SelectTrigger>
              <SelectContent>
                {tenants.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button disabled={!activeTenantId} data-testid="button-add-user">
                <Plus className="h-4 w-4 mr-2" /> Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label>Full Name</Label>
                  <Input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Jane Smith"
                    data-testid="input-new-user-name"
                  />
                </div>
                <div>
                  <Label>Username / Email</Label>
                  <Input
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="jane@company.com"
                    data-testid="input-new-user-email"
                  />
                </div>
                <div>
                  <Label>Phone (optional)</Label>
                  <Input
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    data-testid="input-new-user-phone"
                  />
                </div>
                <div>
                  <Label>Password</Label>
                  <PasswordInput
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter password"
                    data-testid="input-new-user-password"
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={newRole} onValueChange={setNewRole}>
                    <SelectTrigger data-testid="select-new-user-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getAssignableRoles(isSuperAdmin).map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() =>
                    createMutation.mutate({
                      name: newName,
                      email: newEmail,
                      phone: newPhone || undefined,
                      password: newPassword,
                      role: newRole,
                    })
                  }
                  disabled={createMutation.isPending || !newName || !newEmail || !newPassword}
                  className="w-full"
                  data-testid="button-create-user"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create User
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!activeTenantId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium mb-1">Select an owner</h3>
            <p className="text-sm text-muted-foreground">Choose an owner to manage its users.</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={`users-skeleton-${i}`} className="h-16 w-full" />
          ))}
        </div>
      ) : !usersData || usersData.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-medium mb-1">No users in this owner</h3>
            <p className="text-sm text-muted-foreground">
              Add your first team member to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {usersData.map((u) => (
            <UserRow
              key={u.id}
              userItem={u}
              currentUser={user as SafeUser | null}
              isSuperAdmin={isSuperAdmin}
            />
          ))}
        </div>
      )}
    </div>
  );
}
