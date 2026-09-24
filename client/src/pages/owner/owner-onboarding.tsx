import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { apiUpload } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Globe,
  Upload,
  FileText,
  Loader2,
  CheckCircle2,
  Image,
  Download,
  PenTool,
} from "lucide-react";
import type { Tenant } from "@shared/schema";

export default function OwnerOnboardingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const logoRef = useRef<HTMLInputElement>(null);
  const templateRef = useRef<HTMLInputElement>(null);

  const { data: tenant } = useQuery<Tenant>({
    queryKey: ["/api/tenant/profile"],
  });

  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [pdfHeaderText, setPdfHeaderText] = useState("");
  const [pdfFooterText, setPdfFooterText] = useState("");
  const [logoUploaded, setLogoUploaded] = useState(false);
  const [templateUploaded, setTemplateUploaded] = useState(false);
  const [saving, setSaving] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      setSaving(true);

      const res = await apiRequest("PATCH", "/api/tenant/profile", {
        address,
        phone,
        email,
        website: website || undefined,
        pdfHeaderText: pdfHeaderText || undefined,
        pdfFooterText: pdfFooterText || undefined,
        onboardingComplete: true,
      });

      if (logoRef.current?.files?.[0]) {
        const formData = new FormData();
        formData.append("file", logoRef.current.files[0]);
        await apiUpload("/api/tenant/profile/logo", formData);
      }

      if (templateRef.current?.files?.[0]) {
        const formData = new FormData();
        formData.append("file", templateRef.current.files[0]);
        await apiUpload("/api/tenant/profile/template", formData);
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/profile"] });
      toast({ title: "Setup complete! Welcome to SignSalesIQ." });
      setSaving(false);
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
      setSaving(false);
    },
  });

  const skipMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/tenant/profile", {
        onboardingComplete: true,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tenant/profile"] });
      toast({ title: "Setup skipped. You can complete it later from Company Settings." });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const isFormValid =
    address.trim() !== "" &&
    phone.trim() !== "" &&
    email.trim() !== "" &&
    (logoRef.current?.files?.[0] || logoUploaded);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-4 sm:space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center rounded-full bg-primary/10 p-3">
            <PenTool className="h-8 w-8 text-primary" />
          </div>
          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight"
            data-testid="text-onboarding-title"
          >
            Welcome to SignSalesIQ
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Let's set up your business profile. This information will appear on your proposals and
            help your team get started.
          </p>
          {tenant && <p className="text-sm font-medium text-primary">Setting up: {tenant.name}</p>}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Business Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> Business Address *
              </Label>
              <Input
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="123 Main St, Suite 100, City, State 12345"
                data-testid="input-onboarding-address"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" /> Phone *
                </Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  data-testid="input-onboarding-phone"
                />
              </div>
              <div>
                <Label className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> Email Address *
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@yourcompany.com"
                  data-testid="input-onboarding-email"
                />
              </div>
            </div>
            <div>
              <Label className="flex items-center gap-1">
                <Globe className="h-3.5 w-3.5" /> Web Address
              </Label>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://www.yourcompany.com"
                data-testid="input-onboarding-website"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Image className="h-5 w-5" />
              Company Logo *
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Upload your company logo in PNG or PDF format. This will appear on your proposals.
            </p>
            <Input
              type="file"
              accept=".png,.pdf,image/png,application/pdf"
              ref={logoRef}
              onChange={() => setLogoUploaded(!!logoRef.current?.files?.[0])}
              className="text-sm"
              data-testid="input-onboarding-logo"
            />
            {logoUploaded && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle2 className="h-4 w-4" />
                Logo selected
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />
              PDF Proposal Template
              <span className="text-xs font-normal text-muted-foreground ml-1">(Optional)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Upload a custom PDF template (8.5" x 11") to use as the background for your proposals.
              AI-generated mockup photos will be placed onto this template.
            </p>
            <div className="rounded-md border bg-muted/30 p-3 space-y-2">
              <p className="text-sm font-medium">Need a starting point?</p>
              <p className="text-xs text-muted-foreground">
                Download our sample template to see the layout, then customize it with your
                branding.
              </p>
              <Button variant="outline" size="sm" asChild>
                <a
                  href="/api/templates/sample-pdf"
                  download="sample-template.pdf"
                  data-testid="link-download-sample-template"
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download Sample Template
                </a>
              </Button>
            </div>
            <div>
              <Label>Upload Your Template</Label>
              <Input
                type="file"
                accept=".pdf"
                ref={templateRef}
                onChange={() => setTemplateUploaded(!!templateRef.current?.files?.[0])}
                className="text-sm"
                data-testid="input-onboarding-template"
              />
              {templateUploaded && (
                <div className="flex items-center gap-2 text-sm text-green-600 mt-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Template selected
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <Label>Custom Header Text</Label>
                <Textarea
                  value={pdfHeaderText}
                  onChange={(e) => setPdfHeaderText(e.target.value)}
                  placeholder='e.g. "Your Trusted Signage Partner Since 1985"'
                  rows={2}
                  className="text-sm"
                  data-testid="input-onboarding-header-text"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Appears in the header area of your proposals.
                </p>
              </div>
              <div>
                <Label>Custom Footer Text</Label>
                <Textarea
                  value={pdfFooterText}
                  onChange={(e) => setPdfFooterText(e.target.value)}
                  placeholder='e.g. "Thank you for choosing Acme Signs. Visit us at acmesigns.com"'
                  rows={2}
                  className="text-sm"
                  data-testid="input-onboarding-footer-text"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Appears in the footer area of your proposals, above the required disclaimer.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="pt-2 pb-8 space-y-3">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!isFormValid || saving || saveMutation.isPending}
            size="lg"
            className="w-full"
            data-testid="button-complete-onboarding"
          >
            {(saving || saveMutation.isPending) && (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            )}
            Complete Setup & Continue
          </Button>
          <Button
            variant="ghost"
            onClick={() => skipMutation.mutate()}
            disabled={skipMutation.isPending}
            size="lg"
            className="w-full text-muted-foreground"
            data-testid="button-skip-onboarding"
          >
            {skipMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Skip for now
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-3">
            You can update this information later from Company Settings. After completing setup,
            you'll be able to add users to your team.
          </p>
        </div>
      </div>
    </div>
  );
}
