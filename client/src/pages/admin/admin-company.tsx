import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { apiUpload } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2,
  Loader2,
  Upload,
  FileText,
  Phone,
  MapPin,
  Globe,
  Mail,
  Palette,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Tenant } from "@shared/schema";

export default function AdminCompanyPage() {
  const { isTenantAdmin, isSuperAdmin } = useAuth();
  const { toast } = useToast();
  const logoRef = useRef<HTMLInputElement>(null);
  const templateRef = useRef<HTMLInputElement>(null);

  const { data: tenant, isLoading } = useQuery<Tenant>({
    queryKey: ["/api/tenant/profile"],
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [website, setWebsite] = useState("");
  const [pdfHeaderText, setPdfHeaderText] = useState("");
  const [pdfFooterText, setPdfFooterText] = useState("");
  const [pdfBannerText, setPdfBannerText] = useState("");
  const [pdfPrimaryColor, setPdfPrimaryColor] = useState("#1C4587");
  const [pdfAccentColor, setPdfAccentColor] = useState("#009987");

  useEffect(() => {
    if (tenant) {
      setName(tenant.name || "");
      setEmail(tenant.email || "");
      setPhone(tenant.phone || "");
      setAddress(tenant.address || "");
      setWebsite(tenant.website || "");
      setPdfHeaderText(tenant.pdfHeaderText || "");
      setPdfFooterText(tenant.pdfFooterText || "");
      setPdfBannerText(tenant.pdfBannerText || "");
      setPdfPrimaryColor(tenant.pdfPrimaryColor || "#1C4587");
      setPdfAccentColor(tenant.pdfAccentColor || "#009987");
    }
  }, [tenant]);

  const updateMutation = useMutation({
    mutationFn: async (data: {
      name?: string;
      email?: string;
      phone?: string;
      address?: string;
      website?: string;
      pdfHeaderText?: string;
      pdfFooterText?: string;
      pdfBannerText?: string;
      pdfPrimaryColor?: string;
      pdfAccentColor?: string;
    }) => {
      const res = await apiRequest("PATCH", "/api/tenant/profile", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/profile"] });
      toast({ title: "Company settings updated" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const [logoUploading, setLogoUploading] = useState(false);
  const [templateUploading, setTemplateUploading] = useState(false);

  const uploadLogo = async () => {
    if (!logoRef.current?.files?.[0]) return;
    const formData = new FormData();
    formData.append("file", logoRef.current.files[0]);
    setLogoUploading(true);
    try {
      await apiUpload("/api/tenant/profile/logo", formData);
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/profile"] });
      toast({ title: "Logo uploaded" });
      if (logoRef.current) logoRef.current.value = "";
    } catch (err) {
      toast({
        title: "Error uploading logo",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
    setLogoUploading(false);
  };

  const uploadTemplate = async () => {
    if (!templateRef.current?.files?.[0]) return;
    const formData = new FormData();
    formData.append("file", templateRef.current.files[0]);
    setTemplateUploading(true);
    try {
      await apiUpload("/api/tenant/profile/template", formData);
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/profile"] });
      toast({ title: "PDF template uploaded" });
      if (templateRef.current) templateRef.current.value = "";
    } catch (err) {
      toast({
        title: "Error uploading template",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
    setTemplateUploading(false);
  };

  if (!isTenantAdmin && !isSuperAdmin) {
    return (
      <div className="p-3 sm:p-6 text-center">
        <p className="text-muted-foreground">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
        <Skeleton className="h-8 w-48" />
        <Card>
          <CardContent className="p-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 space-y-4 sm:space-y-6">
      <div>
        <h1
          className="text-xl sm:text-2xl font-bold tracking-tight flex items-center gap-2"
          data-testid="text-company-title"
        >
          <Building2 className="h-6 w-6" /> Company Settings
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage your organization's branding and contact information.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Company Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Company Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your Company Name"
              data-testid="input-company-name"
            />
          </div>
          <div>
            <Label className="flex items-center gap-1">
              <Mail className="h-3.5 w-3.5" /> Email
            </Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="info@company.com"
              data-testid="input-company-email"
            />
          </div>
          <div>
            <Label className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5" /> Phone
            </Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
              data-testid="input-company-phone"
            />
          </div>
          <div>
            <Label className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> Address
            </Label>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main St, City, State 12345"
              data-testid="input-company-address"
            />
          </div>
          <div>
            <Label className="flex items-center gap-1">
              <Globe className="h-3.5 w-3.5" /> Website
            </Label>
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.example.com"
              data-testid="input-company-website"
            />
          </div>
          <Button
            onClick={() =>
              updateMutation.mutate({
                name,
                email,
                phone,
                address,
                website,
                pdfHeaderText,
                pdfFooterText,
                pdfBannerText,
                pdfPrimaryColor,
                pdfAccentColor,
              })
            }
            disabled={updateMutation.isPending}
            data-testid="button-save-company"
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="h-5 w-5" /> PDF Customization
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Banner Title</Label>
            <Input
              value={pdfBannerText}
              onChange={(e) => setPdfBannerText(e.target.value)}
              placeholder="SIGN CONCEPT RENDERING"
              data-testid="input-pdf-banner-text"
            />
            <p className="text-xs text-muted-foreground mt-1">
              The main heading that appears on the PDF proposal banner. Leave blank to use the
              default.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Primary Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={pdfPrimaryColor}
                  onChange={(e) => setPdfPrimaryColor(e.target.value)}
                  className="h-10 w-14 rounded border cursor-pointer"
                  data-testid="input-pdf-primary-color"
                />
                <Input
                  value={pdfPrimaryColor}
                  onChange={(e) => setPdfPrimaryColor(e.target.value)}
                  placeholder="#1C4587"
                  className="flex-1 font-mono text-sm"
                  data-testid="input-pdf-primary-color-hex"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Used for the banner and top/bottom bars.
              </p>
            </div>
            <div>
              <Label>Accent Color</Label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="color"
                  value={pdfAccentColor}
                  onChange={(e) => setPdfAccentColor(e.target.value)}
                  className="h-10 w-14 rounded border cursor-pointer"
                  data-testid="input-pdf-accent-color"
                />
                <Input
                  value={pdfAccentColor}
                  onChange={(e) => setPdfAccentColor(e.target.value)}
                  placeholder="#009987"
                  className="flex-1 font-mono text-sm"
                  data-testid="input-pdf-accent-color-hex"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Used for accent stripe, section labels, and divider lines.
              </p>
            </div>
          </div>
          <div
            className="rounded-lg border p-3 mt-2"
            style={{
              background: `linear-gradient(135deg, ${pdfPrimaryColor}15, ${pdfAccentColor}15)`,
            }}
          >
            <p className="text-xs font-medium mb-2">Preview</p>
            <div className="flex items-center gap-2">
              <div className="h-6 flex-1 rounded" style={{ backgroundColor: pdfPrimaryColor }} />
              <div className="h-1 flex-1 rounded" style={{ backgroundColor: pdfAccentColor }} />
            </div>
            <p className="text-xs mt-2 font-bold" style={{ color: pdfPrimaryColor }}>
              {pdfBannerText || "SIGN CONCEPT RENDERING"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">PDF Header & Footer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>PDF Header Text</Label>
            <Textarea
              value={pdfHeaderText}
              onChange={(e) => setPdfHeaderText(e.target.value)}
              placeholder="Custom text to display in the header of generated proposals"
              className="resize-none"
              rows={3}
              data-testid="input-company-pdf-header"
            />
            <p className="text-xs text-muted-foreground mt-1">
              This text will appear at the top of your generated PDF proposals.
            </p>
          </div>
          <div>
            <Label>PDF Footer Text</Label>
            <Textarea
              value={pdfFooterText}
              onChange={(e) => setPdfFooterText(e.target.value)}
              placeholder="Custom text to display in the footer of generated proposals"
              className="resize-none"
              rows={3}
              data-testid="input-company-pdf-footer"
            />
            <p className="text-xs text-muted-foreground mt-1">
              This text will appear at the bottom of your generated PDF proposals alongside the
              standard disclaimer.
            </p>
          </div>
          <Button
            onClick={() =>
              updateMutation.mutate({
                name,
                email,
                phone,
                address,
                website,
                pdfHeaderText,
                pdfFooterText,
                pdfBannerText,
                pdfPrimaryColor,
                pdfAccentColor,
              })
            }
            disabled={updateMutation.isPending}
            data-testid="button-save-pdf-text"
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Company Logo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tenant?.logoFilename && (
            <div className="flex items-center gap-3">
              <img
                src={`/api/uploads/${tenant.logoFilename}`}
                alt="Company logo"
                className="h-16 w-auto max-w-[200px] rounded border object-contain p-1"
                data-testid="img-company-logo"
              />
              <span className="text-sm text-muted-foreground">Current logo</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept="image/*,.pdf,.svg"
              ref={logoRef}
              className="text-sm flex-1"
              data-testid="input-company-logo-file"
            />
            <Button
              onClick={uploadLogo}
              disabled={logoUploading}
              variant="outline"
              data-testid="button-upload-logo"
            >
              {logoUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Upload
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, SVG, or PDF. Will be converted to PNG for use in proposals.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">PDF Proposal Template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {tenant?.pdfTemplateFilename && (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground" data-testid="text-template-filename">
                Template uploaded: {tenant.pdfTemplateFilename}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept=".pdf"
              ref={templateRef}
              className="text-sm flex-1"
              data-testid="input-company-template-file"
            />
            <Button
              onClick={uploadTemplate}
              disabled={templateUploading}
              variant="outline"
              data-testid="button-upload-template"
            >
              {templateUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Upload
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Upload a PDF to use as the background template for your proposals.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
