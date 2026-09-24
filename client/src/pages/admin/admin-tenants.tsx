import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { apiUpload } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import {
  Building2,
  Plus,
  Loader2,
  Trash2,
  Pencil,
  Check,
  X,
  Users,
  Phone,
  MapPin,
  Globe,
  Mail,
  KeyRound,
  Download,
  ChevronDown,
  ChevronUp,
  Clock,
  Calendar,
  User,
  Shield,
  Lock,
  UserCog,
  Search,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useState, useRef, useEffect } from "react";
import type { Tenant, User as AppUser } from "@shared/schema";

type TenantWithCount = Tenant & {
  userCount: number;
  ownerAdminName: string | null;
  ownerAdminEmail: string | null;
};
type SafeUser = Omit<AppUser, "passwordHash">;

const ROLES = [
  { value: "SUPER_ADMIN", label: "Super Admin" },
  { value: "ADMIN", label: "Owner Admin" },
  { value: "SALES", label: "Sales" },
  { value: "ACCOUNT_MANAGER", label: "Account Manager" },
  { value: "PROJECT_MANAGER", label: "Project Manager" },
  { value: "OUTSIDE_SALES", label: "Outside Sales" },
  { value: "INSIDE_SALES", label: "Inside Sales" },
  { value: "SALES_MANAGER", label: "Sales Manager" },
  { value: "DESIGNER", label: "Designer" },
  { value: "PRODUCTION_MANAGER", label: "Production Manager" },
];

function formatDate(date: string | Date | null | undefined) {
  if (!date) return "\u2014";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(date: string | Date | null | undefined) {
  if (!date) return "Never";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function roleLabel(role: string) {
  const found = ROLES.find((r) => r.value === role);
  if (found) return found.label;
  if (role === "SUPER_ADMIN") return "Super Admin";
  return role;
}

function EditUserDialog({
  open,
  onOpenChange,
  user,
  tenantId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SafeUser;
  tenantId: string;
}) {
  const { toast } = useToast();
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(user.phone || "");
  const [role, setRole] = useState(user.role);

  useEffect(() => {
    if (open) {
      setName(user.name);
      setEmail(user.email);
      setPhone(user.phone || "");
      setRole(user.role);
    }
  }, [open, user]);

  const updateMutation = useMutation({
    mutationFn: async (data: { name?: string; email?: string; phone?: string; role?: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${user.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", tenantId, "users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      toast({ title: "User updated" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    updateMutation.mutate({ name, email, phone, role });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>Update user details for {user.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Full Name *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Smith"
              data-testid="input-edit-user-name"
            />
          </div>
          <div>
            <Label>Email (Login) *</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@company.com"
              data-testid="input-edit-user-email"
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              data-testid="input-edit-user-phone"
            />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
              <SelectTrigger data-testid="select-edit-user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleSubmit}
            disabled={updateMutation.isPending || !name || !email}
            className="w-full"
            data-testid="button-save-user"
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  open,
  onOpenChange,
  user,
  tenantId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: SafeUser;
  tenantId: string;
}) {
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (open) {
      setNewPassword("");
      setConfirmPassword("");
    }
  }, [open]);

  const resetMutation = useMutation({
    mutationFn: async (data: { password: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${user.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants", tenantId, "users"] });
      toast({ title: "Password reset successfully" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const passwordsMatch = newPassword === confirmPassword;
  const passwordValid = newPassword.length >= 4;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            Set a new password for {user.name} ({user.email})
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>New Password *</Label>
            <PasswordInput
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
              data-testid="input-reset-password"
            />
            {newPassword && !passwordValid && (
              <p className="text-xs text-destructive mt-1">
                Password must be at least 4 characters
              </p>
            )}
          </div>
          <div>
            <Label>Confirm Password *</Label>
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              data-testid="input-confirm-password"
            />
            {confirmPassword && !passwordsMatch && (
              <p className="text-xs text-destructive mt-1">Passwords do not match</p>
            )}
          </div>
          <Button
            onClick={() => resetMutation.mutate({ password: newPassword })}
            disabled={resetMutation.isPending || !passwordValid || !passwordsMatch}
            className="w-full"
            data-testid="button-confirm-reset-password"
          >
            {resetMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Reset Password
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function UsersTable({ tenantId }: { tenantId: string }) {
  const [editingUser, setEditingUser] = useState<SafeUser | null>(null);
  const [resetPasswordUser, setResetPasswordUser] = useState<SafeUser | null>(null);

  const { data: users, isLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/tenants", tenantId, "users"],
    queryFn: async () => {
      const res = await fetch(`/api/tenants/${tenantId}/users`);
      if (!res.ok) throw new Error("Failed to load users");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="p-4">
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">No users in this account.</div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs">Name</TableHead>
              <TableHead className="text-xs">Email</TableHead>
              <TableHead className="text-xs">Role</TableHead>
              <TableHead className="text-xs">Phone</TableHead>
              <TableHead className="text-xs">Created</TableHead>
              <TableHead className="text-xs">Last Login</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                <TableCell
                  className="text-sm font-medium"
                  data-testid={`text-user-name-${user.id}`}
                >
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {user.name}
                  </div>
                </TableCell>
                <TableCell
                  className="text-sm text-muted-foreground"
                  data-testid={`text-user-email-${user.id}`}
                >
                  {user.email}
                </TableCell>
                <TableCell data-testid={`text-user-role-${user.id}`}>
                  <Badge
                    variant={user.role === "ADMIN" ? "default" : "outline"}
                    className="text-xs"
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    {roleLabel(user.role)}
                  </Badge>
                </TableCell>
                <TableCell
                  className="text-sm text-muted-foreground"
                  data-testid={`text-user-phone-${user.id}`}
                >
                  {user.phone || "\u2014"}
                </TableCell>
                <TableCell
                  className="text-sm text-muted-foreground"
                  data-testid={`text-user-created-${user.id}`}
                >
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(user.createdAt)}
                  </div>
                </TableCell>
                <TableCell data-testid={`text-user-lastlogin-${user.id}`}>
                  <div className="flex items-center gap-1 text-sm">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span
                      className={
                        user.lastLoginAt ? "text-foreground" : "text-muted-foreground italic"
                      }
                    >
                      {formatDateTime(user.lastLoginAt)}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => setEditingUser(user)}
                      data-testid={`button-edit-user-${user.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5 sm:mr-1" />
                      <span className="hidden sm:inline">Edit</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => setResetPasswordUser(user)}
                      data-testid={`button-reset-password-${user.id}`}
                    >
                      <Lock className="h-3.5 w-3.5 sm:mr-1" />
                      <span className="hidden sm:inline">Reset Password</span>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editingUser && (
        <EditUserDialog
          open={!!editingUser}
          onOpenChange={(open) => {
            if (!open) setEditingUser(null);
          }}
          user={editingUser}
          tenantId={tenantId}
        />
      )}

      {resetPasswordUser && (
        <ResetPasswordDialog
          open={!!resetPasswordUser}
          onOpenChange={(open) => {
            if (!open) setResetPasswordUser(null);
          }}
          user={resetPasswordUser}
          tenantId={tenantId}
        />
      )}
    </>
  );
}

function TenantCard({
  tenant,
  onEdit,
}: {
  tenant: TenantWithCount;
  onEdit: (t: TenantWithCount) => void;
}) {
  const { toast } = useToast();
  const [showUsers, setShowUsers] = useState(false);

  const updateMutation = useMutation({
    mutationFn: async (data: { active?: boolean }) => {
      const res = await apiRequest("PATCH", `/api/tenants/${tenant.id}`, data);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      toast({
        title: variables.active ? "Owner activated" : "Owner deactivated",
        description: variables.active
          ? "All users in this account can now log in."
          : "All users in this account have been blocked from logging in.",
      });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/tenants/${tenant.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      toast({ title: "Owner deleted" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card
      data-testid={`card-tenant-${tenant.id}`}
      className={!tenant.active ? "opacity-75 border-destructive/30" : ""}
    >
      <CardContent className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {tenant.logoFilename ? (
              <img
                src={`/api/uploads/${tenant.logoFilename}`}
                alt={tenant.name}
                className="h-10 w-10 rounded-md object-contain border shrink-0"
                data-testid={`img-tenant-logo-${tenant.id}`}
              />
            ) : (
              <div className="rounded-md bg-primary/10 p-2 shrink-0">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-medium text-sm">{tenant.name}</h3>
                <Badge variant={tenant.active ? "default" : "destructive"} className="text-xs">
                  {tenant.active ? "Active" : "Deactivated"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{tenant.slug}</p>
              {!tenant.active && (
                <p className="text-xs text-destructive mt-0.5">
                  All users in this account are blocked from logging in
                </p>
              )}
              <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                {tenant.email && (
                  <span
                    className="flex items-center gap-1"
                    data-testid={`text-tenant-email-${tenant.id}`}
                  >
                    <Mail className="h-3 w-3" /> {tenant.email}
                  </span>
                )}
                {tenant.phone && (
                  <span
                    className="flex items-center gap-1"
                    data-testid={`text-tenant-phone-${tenant.id}`}
                  >
                    <Phone className="h-3 w-3" /> {tenant.phone}
                  </span>
                )}
                {tenant.address && (
                  <span
                    className="flex items-center gap-1"
                    data-testid={`text-tenant-address-${tenant.id}`}
                  >
                    <MapPin className="h-3 w-3" /> {tenant.address}
                  </span>
                )}
                {tenant.website && (
                  <span
                    className="flex items-center gap-1"
                    data-testid={`text-tenant-website-${tenant.id}`}
                  >
                    <Globe className="h-3 w-3" /> {tenant.website}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap sm:shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowUsers(!showUsers)}
              data-testid={`button-view-users-${tenant.id}`}
            >
              <Users className="h-3.5 w-3.5 mr-1" />
              {tenant.userCount} user{tenant.userCount !== 1 ? "s" : ""}
              {showUsers ? (
                <ChevronUp className="h-3.5 w-3.5 ml-1" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 ml-1" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onEdit(tenant)}
              data-testid={`button-edit-tenant-${tenant.id}`}
            >
              <Pencil className="h-3.5 w-3.5 sm:mr-1" />{" "}
              <span className="hidden sm:inline">Edit</span>
            </Button>
            <Button
              size="sm"
              variant={tenant.active ? "outline" : "default"}
              onClick={() => {
                const action = tenant.active ? "deactivate" : "activate";
                const msg = tenant.active
                  ? `Are you sure you want to deactivate ${tenant.name}? All ${tenant.userCount} user(s) will be immediately blocked from logging in.`
                  : `Are you sure you want to activate ${tenant.name}? All users will be able to log in again.`;
                if (confirm(msg)) {
                  updateMutation.mutate({ active: !tenant.active });
                }
              }}
              disabled={updateMutation.isPending}
              data-testid={`button-toggle-tenant-${tenant.id}`}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 sm:mr-1 animate-spin" />
              ) : tenant.active ? (
                <X className="h-3.5 w-3.5 sm:mr-1" />
              ) : (
                <Check className="h-3.5 w-3.5 sm:mr-1" />
              )}
              <span className="hidden sm:inline">{tenant.active ? "Deactivate" : "Activate"}</span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (tenant.active) {
                  alert("Please deactivate this owner account before deleting it.");
                  return;
                }
                if (
                  confirm(
                    `Delete "${tenant.name}"? This will permanently remove this owner, all their users, and all their opportunities. This cannot be undone.`
                  )
                ) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending || (tenant.active ?? false)}
              data-testid={`button-delete-tenant-${tenant.id}`}
            >
              {deleteMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 sm:mr-1 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 sm:mr-1" />
              )}
              <span className="hidden sm:inline">Delete</span>
            </Button>
          </div>
        </div>
        {showUsers && (
          <div
            className="mt-4 border rounded-md bg-muted/30"
            data-testid={`section-users-${tenant.id}`}
          >
            <div className="px-4 py-2 border-b bg-muted/50">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <UserCog className="h-3.5 w-3.5" /> Account Users &mdash; Edit users or reset
                passwords
              </h4>
            </div>
            <UsersTable tenantId={tenant.id} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TenantFormDialog({
  open,
  onOpenChange,
  tenant,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant?: TenantWithCount | null;
}) {
  const { toast } = useToast();
  const logoRef = useRef<HTMLInputElement>(null);
  const isEditing = !!tenant;

  const [name, setName] = useState(tenant?.name || "");
  const [slug, setSlug] = useState(tenant?.slug || "");
  const [email, setEmail] = useState(tenant?.email || "");
  const [phone, setPhone] = useState(tenant?.phone || "");
  const [address, setAddress] = useState(tenant?.address || "");
  const [website, setWebsite] = useState(tenant?.website || "");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(tenant?.name || "");
      setSlug(tenant?.slug || "");
      setEmail(tenant?.email || "");
      setPhone(tenant?.phone || "");
      setAddress(tenant?.address || "");
      setWebsite(tenant?.website || "");
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
    }
  }, [open, tenant]);

  const generateSlug = (n: string) =>
    n
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

  const createMutation = useMutation({
    mutationFn: async (data: {
      name: string;
      slug: string;
      email?: string;
      phone?: string;
      address?: string;
      website?: string;
      adminName: string;
      adminEmail: string;
      adminPassword: string;
    }) => {
      const res = await apiRequest("POST", "/api/tenants", data);
      return res.json();
    },
    onSuccess: async (newTenant: Tenant) => {
      if (logoRef.current?.files?.[0]) {
        const formData = new FormData();
        formData.append("file", logoRef.current.files[0]);
        setLogoUploading(true);
        await apiUpload(`/api/tenants/${newTenant.id}/logo`, formData);
        setLogoUploading(false);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      toast({ title: "Owner created" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: {
      name?: string;
      email?: string;
      phone?: string;
      address?: string;
      website?: string;
    }) => {
      const res = await apiRequest("PATCH", `/api/tenants/${tenant?.id}`, data);
      return res.json();
    },
    onSuccess: async () => {
      if (logoRef.current?.files?.[0]) {
        const formData = new FormData();
        formData.append("file", logoRef.current.files[0]);
        setLogoUploading(true);
        await apiUpload(`/api/tenants/${tenant?.id}/logo`, formData);
        setLogoUploading(false);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      toast({ title: "Owner updated" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (isEditing) {
      updateMutation.mutate({ name, email, phone, address, website });
    } else {
      createMutation.mutate({
        name,
        slug,
        email,
        phone,
        address,
        website,
        adminName,
        adminEmail,
        adminPassword,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending || logoUploading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Owner" : "New Owner"}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? "Update this owner's account details."
              : "Create a new owner organization and admin account."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>Company Name *</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!isEditing) setSlug(generateSlug(e.target.value));
              }}
              placeholder="Acme Signs Inc."
              data-testid="input-tenant-name"
            />
          </div>
          {!isEditing && (
            <div>
              <Label>Slug (URL identifier) *</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="acme-signs"
                data-testid="input-tenant-slug"
              />
            </div>
          )}
          <div>
            <Label>Email</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="info@company.com"
              data-testid="input-tenant-email"
            />
          </div>
          <div>
            <Label>Phone</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              data-testid="input-tenant-phone"
            />
          </div>
          <div>
            <Label>Address</Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, City, State 12345"
              data-testid="input-tenant-address"
            />
          </div>
          <div>
            <Label>Website</Label>
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.example.com"
              data-testid="input-tenant-website"
            />
          </div>
          <div>
            <Label>Company Logo</Label>
            <div className="flex items-center gap-3 mt-1">
              {isEditing && tenant?.logoFilename && (
                <img
                  src={`/api/uploads/${tenant.logoFilename}`}
                  alt="Current logo"
                  className="h-10 w-10 rounded border object-contain"
                />
              )}
              <Input
                type="file"
                accept="image/*,.pdf,.svg"
                ref={logoRef}
                className="text-sm"
                data-testid="input-tenant-logo"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPG, SVG, or PDF. Will be converted to PNG.
            </p>
          </div>
          {!isEditing && (
            <>
              <Separator />
              <div>
                <Label className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                  <KeyRound className="h-4 w-4" /> Owner Admin Login
                </Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Create the admin account for this owner. They will use these credentials to log in
                  and complete their business setup.
                </p>
                <div className="space-y-3">
                  <div>
                    <Label>Admin Full Name *</Label>
                    <Input
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      placeholder="John Smith"
                      data-testid="input-admin-name"
                    />
                  </div>
                  <div>
                    <Label>Admin Email (Login) *</Label>
                    <Input
                      type="email"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      placeholder="owner@company.com"
                      data-testid="input-admin-email"
                    />
                  </div>
                  <div>
                    <Label>Admin Password *</Label>
                    <PasswordInput
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      placeholder="Set a password"
                      data-testid="input-admin-password"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
          <Button
            onClick={handleSubmit}
            disabled={
              isPending ||
              !name ||
              (!isEditing && (!slug || !adminName || !adminEmail || !adminPassword))
            }
            className="w-full"
            data-testid="button-submit-tenant"
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Save Changes" : "Create Owner"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminTenantsPage() {
  const { isSuperAdmin } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantWithCount | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: tenantsData, isLoading } = useQuery<TenantWithCount[]>({
    queryKey: ["/api/tenants"],
  });

  const filteredTenants = tenantsData?.filter((tenant) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.trim().toLowerCase();
    const addressMatch = tenant.address?.toLowerCase().includes(q) ?? false;
    const nameMatch = tenant.name.toLowerCase().includes(q);
    const emailMatch = tenant.email?.toLowerCase().includes(q) ?? false;
    const ownerNameMatch = tenant.ownerAdminName?.toLowerCase().includes(q) ?? false;
    const ownerEmailMatch = tenant.ownerAdminEmail?.toLowerCase().includes(q) ?? false;
    return addressMatch || nameMatch || emailMatch || ownerNameMatch || ownerEmailMatch;
  });

  if (!isSuperAdmin) {
    return (
      <div className="p-3 sm:p-6 text-center">
        <p className="text-muted-foreground">Access denied. Super Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1
            className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2"
            data-testid="text-tenants-title"
          >
            <Building2 className="h-6 w-6 shrink-0" /> Owner Management
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage owner accounts, edit users, reset passwords, and control access.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <a
              href="/api/templates/sample-pdf"
              download="sample-template.pdf"
              data-testid="link-download-sample-template"
            >
              <Download className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Sample PDF Template</span>
            </a>
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditingTenant(null);
              setDialogOpen(true);
            }}
            data-testid="button-add-tenant"
          >
            <Plus className="h-4 w-4 mr-1" /> Add Owner
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, owner admin, or address..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
          data-testid="input-search-owners"
        />
        {searchQuery && filteredTenants && (
          <p className="text-xs text-muted-foreground mt-1.5">
            Showing {filteredTenants.length} of {tenantsData?.length ?? 0} owners
            {searchQuery.trim() && (
              <button
                onClick={() => setSearchQuery("")}
                className="ml-2 text-primary hover:underline"
              >
                Clear
              </button>
            )}
          </p>
        )}
      </div>

      <TenantFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingTenant(null);
        }}
        tenant={editingTenant}
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={`tenants-skeleton-${i}`}>
              <CardContent className="p-4">
                <Skeleton className="h-16 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !filteredTenants || filteredTenants.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            {searchQuery.trim() ? (
              <>
                <h3 className="font-medium mb-1">No owners match "{searchQuery}"</h3>
                <p className="text-sm text-muted-foreground">
                  Try a different name, email, owner admin, or address.
                </p>
              </>
            ) : (
              <>
                <h3 className="font-medium mb-1">No owners yet</h3>
                <p className="text-sm text-muted-foreground">
                  Create your first owner organization to get started.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTenants.map((tenant) => (
            <TenantCard
              key={tenant.id}
              tenant={tenant}
              onEdit={(t) => {
                setEditingTenant(t);
                setDialogOpen(true);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
