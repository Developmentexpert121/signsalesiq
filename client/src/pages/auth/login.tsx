import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { ENABLE_GBB_TIERS } from "@/lib/featureFlags";
import { useLocation, useSearch, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Loader2,
  ArrowRight,
  Lock,
  CheckCircle2,
  Mail,
  Sun,
  Moon,
  Sparkles,
  FileText,
  Layers,
  Building2,
  Users,
  Settings2,
} from "lucide-react";
import logoImg from "@assets/signsalesiq-logo-v2-trimmed.png";
import { useEffect, useState, useMemo } from "react";
import { useTheme } from "@/lib/theme";

// Login is centralized at SignSuiteIQ. Unauthenticated visitors to the
// SignSalesIQ login page are redirected there to sign in (and then launch
// SignSalesIQ via the SignSuiteIQ dashboard). Overridable via env for non-prod.
const SIGNSUITE_LOGIN_URL =
  (import.meta.env.VITE_SIGNSUITE_LOGIN_URL as string | undefined)?.trim() ||
  "https://www.signsuiteiq.ai/login";

const schema = z.object({
  email: z.string().min(1, "Email or username is required"),
  password: z.string().min(1, "Password is required"),
});

const SSO_ERRORS: Record<string, string> = {
  config: "SSO configuration error. Please try again or use password login.",
  auth: "SSO authentication failed. Please try again.",
  no_email: "Your SSO account does not have an email. Please use password login.",
  no_account:
    "No account found matching your SSO email. Ask your admin to create an account first.",
};

function WaveBackground() {
  return (
    <svg
      className="absolute bottom-0 left-0 w-full opacity-[0.07]"
      viewBox="0 0 1440 320"
      preserveAspectRatio="none"
      style={{ height: "40%" }}
    >
      <path fill="white">
        <animate
          attributeName="d"
          dur="8s"
          repeatCount="indefinite"
          values="
          M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,138.7C672,128,768,160,864,181.3C960,203,1056,213,1152,197.3C1248,181,1344,139,1392,117.3L1440,96V320H0Z;
          M0,192L48,181.3C96,171,192,149,288,160C384,171,480,213,576,218.7C672,224,768,192,864,170.7C960,149,1056,139,1152,149.3C1248,160,1344,192,1392,208L1440,224V320H0Z;
          M0,160L48,176C96,192,192,224,288,213.3C384,203,480,149,576,138.7C672,128,768,160,864,181.3C960,203,1056,213,1152,197.3C1248,181,1344,139,1392,117.3L1440,96V320H0Z
        "
        />
      </path>
      <path fill="white" opacity="0.5">
        <animate
          attributeName="d"
          dur="10s"
          repeatCount="indefinite"
          values="
          M0,256L48,240C96,224,192,192,288,186.7C384,181,480,203,576,208C672,213,768,203,864,186.7C960,171,1056,149,1152,160C1248,171,1344,213,1392,234.7L1440,256V320H0Z;
          M0,224L48,234.7C96,245,192,267,288,261.3C384,256,480,224,576,213.3C672,203,768,213,864,229.3C960,245,1056,267,1152,261.3C1248,256,1344,224,1392,208L1440,192V320H0Z;
          M0,256L48,240C96,224,192,192,288,186.7C384,181,480,203,576,208C672,213,768,203,864,186.7C960,171,1056,149,1152,160C1248,171,1344,213,1392,234.7L1440,256V320H0Z
        "
        />
      </path>
    </svg>
  );
}

function ParticleField() {
  const dots = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        s: 1 + Math.random() * 2.5,
        d: 6 + Math.random() * 10,
        dl: Math.random() * 6,
      })),
    []
  );
  return (
    <>
      {dots.map((d) => (
        <div
          key={d.id}
          className="absolute rounded-full bg-white/20 login-particle"
          style={{
            left: `${d.x}%`,
            top: `${d.y}%`,
            width: d.s,
            height: d.s,
            animationDuration: `${d.d}s`,
            animationDelay: `${d.dl}s`,
          }}
        />
      ))}
    </>
  );
}

export default function LoginPage() {
  const { login, user, isLoading: authLoading } = useAuth();
  const { darkMode, toggleDarkMode } = useTheme();
  const [, navigate] = useLocation();
  const search = useSearch();
  const [ssoError, setSsoError] = useState<string | null>(null);
  const [m, setM] = useState(false);

  // Centralized auth: once the session check resolves, send authenticated users
  // into the app and bounce unauthenticated visitors to the SignSuiteIQ login.
  // We skip the bounce when there's an SSO error / reset message to display,
  // otherwise the visitor would loop back to SignSuiteIQ and never see it.
  //
  // The bounce is for the LIVE production sites only. On the demo environments
  // (demo.signsalesiq.ai / demo.installiq.ai) we keep the local login form so
  // the demo can be signed into directly instead of being kicked to SignSuiteIQ.
  const isDemoHost =
    typeof window !== "undefined" && window.location.hostname.startsWith("demo.");
  const params = new URLSearchParams(search);
  const hasInterstitialMessage = !!params.get("sso_error") || params.get("reset") === "success";
  const willRedirectToSignSuite =
    !authLoading && !user && !hasInterstitialMessage && !isDemoHost && !import.meta.env.DEV;

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      navigate("/");
      return;
    }
    if (hasInterstitialMessage) return;
    if (isDemoHost) return;
    if (import.meta.env.DEV) return;
    window.location.replace(SIGNSUITE_LOGIN_URL);
  }, [authLoading, user, hasInterstitialMessage, isDemoHost, navigate]);

  useEffect(() => {
    const t = requestAnimationFrame(() => setM(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const [resetSuccess, setResetSuccess] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(search);
    const errorCode = params.get("sso_error");
    if (errorCode && SSO_ERRORS[errorCode]) {
      setSsoError(SSO_ERRORS[errorCode]);
      window.history.replaceState({}, "", "/");
    }
    if (params.get("reset") === "success") {
      setResetSuccess(true);
      window.history.replaceState({}, "", "/");
    }
  }, [search]);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: z.infer<typeof schema>) => {
    login.mutate(data, {
      onSuccess: () => navigate("/"),
    });
  };

  // While the session check is in flight or we're about to bounce to
  // SignSuiteIQ, show a minimal loader instead of flashing the login form.
  if (authLoading || willRedirectToSignSuite) {
    return (
      <div className="h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-gray-950">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="h-[100dvh] flex flex-col lg:flex-row overflow-hidden bg-slate-50 dark:bg-gray-950">
      <style>{`
        @keyframes login-drift {
          0%,100% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-15px) translateX(8px); }
          50% { transform: translateY(-6px) translateX(-4px); }
          75% { transform: translateY(-20px) translateX(5px); }
        }
        @keyframes login-reveal {
          0% { clip-path: inset(0 100% 0 0); opacity: 0; }
          100% { clip-path: inset(0 0% 0 0); opacity: 1; }
        }
        @keyframes login-rise {
          0% { opacity: 0; transform: translateY(24px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes login-card {
          0% { opacity: 0; transform: translateY(20px) scale(0.97); }
          60% { opacity: 1; transform: translateY(-2px) scale(1.005); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes login-pop {
          0% { opacity: 0; transform: scale(0) rotate(-30deg); }
          60% { transform: scale(1.12) rotate(3deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }
        @keyframes login-slide-in {
          0% { opacity: 0; transform: translateX(-20px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes login-number {
          0% { opacity: 0; transform: scale(0.6) translateY(8px); }
          60% { transform: scale(1.06) translateY(-1px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes login-fade-up {
          0% { opacity: 0; transform: translateY(10px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes login-glow {
          0%,100% { box-shadow: 0 0 8px 1px rgba(37,99,235,0.15); }
          50% { box-shadow: 0 0 18px 4px rgba(37,99,235,0.3); }
        }
        @keyframes login-gradient {
          0%,100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes login-shimmer {
          0% { left: -100%; }
          100% { left: 200%; }
        }
        .login-particle { animation: login-drift linear infinite; }
        .l-reveal { animation: login-reveal 0.9s cubic-bezier(.22,1,.36,1) forwards; opacity: 0; }
        .l-rise { animation: login-rise 0.7s cubic-bezier(.22,1,.36,1) forwards; opacity: 0; }
        .l-card { animation: login-card 0.8s cubic-bezier(.22,1,.36,1) forwards; opacity: 0; }
        .l-pop { animation: login-pop 0.65s cubic-bezier(.22,1,.36,1) forwards; opacity: 0; }
        .l-slide { animation: login-slide-in 0.55s cubic-bezier(.22,1,.36,1) forwards; opacity: 0; }
        .l-num { animation: login-number 0.6s cubic-bezier(.22,1,.36,1) forwards; opacity: 0; }
        .l-fade { animation: login-fade-up 0.5s ease-out forwards; opacity: 0; }
        .l-glow { animation: login-glow 3s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .login-particle,.l-reveal,.l-rise,.l-card,.l-pop,.l-slide,.l-num,.l-fade,.l-glow,
          [class*="animate-"] { animation: none !important; opacity: 1 !important; transform: none !important; }
        }
      `}</style>

      <div
        className={`hidden lg:flex lg:w-[44%] 2xl:w-[42%] relative flex-col justify-between p-7 xl:p-9 overflow-hidden transition-all duration-1000 ease-out ${
          m ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-20"
        }`}
        style={{
          background: "linear-gradient(155deg, #1e3a5f 0%, #122b4a 30%, #0d2137 60%, #091a2e 100%)",
        }}
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <ParticleField />
          <WaveBackground />
          <div className="absolute top-[-10%] right-[-15%] w-[50%] h-[50%] rounded-full bg-blue-500/8 blur-3xl motion-safe:animate-pulse" />
          <div
            className="absolute bottom-[-5%] left-[-10%] w-[45%] h-[45%] rounded-full bg-cyan-500/6 blur-3xl motion-safe:animate-pulse"
            style={{ animationDelay: "3s" }}
          />
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <div
              className="absolute top-0 w-[60%] h-full bg-gradient-to-r from-transparent via-white/[0.03] to-transparent"
              style={{ animation: m ? "login-shimmer 8s ease-in-out infinite 2s" : "none" }}
            />
          </div>
        </div>

        <div className="relative z-10 flex flex-col h-full">
          <div
            className={`transition-all duration-700 ${m ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
            style={{ transitionDelay: "200ms" }}
          >
            <img
              src={logoImg}
              alt="SignSalesIQ"
              className="h-10 xl:h-12 object-contain brightness-0 invert drop-shadow-md"
            />
          </div>

          <div className="flex-1 flex flex-col justify-center">
            <div
              className={`transition-all duration-700 ${m ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
              style={{ transitionDelay: "350ms" }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.08] border border-white/[0.1] backdrop-blur-sm mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 motion-safe:animate-pulse" />
                <span className="text-blue-300 text-xs font-medium tracking-wide">
                  Next-Gen Sign Sales Platform
                </span>
              </div>
            </div>

            <h1 className="text-3xl xl:text-4xl 2xl:text-5xl font-bold text-white leading-[1.15] mb-4">
              <span
                className={m ? "l-reveal inline-block" : "opacity-0"}
                style={{ animationDelay: "500ms" }}
              >
                AI-Powered
              </span>
              <br />
              <span
                className={`inline-block bg-clip-text text-transparent pb-1 ${m ? "l-reveal" : "opacity-0"}`}
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, #93c5fd, #60a5fa, #38bdf8, #7dd3fc, #93c5fd)",
                  backgroundSize: "200% 100%",
                  animation: m
                    ? "login-reveal 0.9s cubic-bezier(.22,1,.36,1) 700ms forwards, login-gradient 5s linear infinite 1.7s"
                    : "none",
                  opacity: 0,
                }}
              >
                Sign Sales
              </span>
            </h1>

            <p
              className={`text-blue-200/70 text-sm xl:text-base max-w-xs leading-relaxed transition-all duration-700 ${m ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
              style={{ transitionDelay: "900ms" }}
            >
              From mockup to proposal to close — all in one platform built for sign companies.
            </p>

            <div
              className={`mt-7 xl:mt-8 space-y-3 transition-all duration-700 ${m ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
              style={{ transitionDelay: "1050ms" }}
            >
              {[
                {
                  icon: Sparkles,
                  title: "AI-Powered Sign Mockups",
                  desc: "Upload a site photo and generate photorealistic sign mockups in seconds using Google Gemini AI.",
                  delay: "1100ms",
                },
                ...(ENABLE_GBB_TIERS
                  ? [
                      {
                        icon: Layers,
                        title: "Good / Better / Best Proposals",
                        desc: "Automatically create tiered proposals showing 3 pricing options for every client opportunity.",
                        delay: "1200ms",
                      },
                    ]
                  : []),
                {
                  icon: FileText,
                  title: "Branded PDF Exports",
                  desc: "Export professional, client-ready proposals with your logo, brand colors, and custom messaging.",
                  delay: "1300ms",
                },
                {
                  icon: Building2,
                  title: "47+ Sign Types Supported",
                  desc: "Channel letters, monuments, vehicle wraps, feather flags, window graphics, ADA signs, and more.",
                  delay: "1400ms",
                },
                {
                  icon: Users,
                  title: "Multi-Location Team Management",
                  desc: "Manage multiple locations, sales reps, and roles — Super Admin, Admin, Sales, and 8 more.",
                  delay: "1500ms",
                },
                {
                  icon: Settings2,
                  title: "Smart Product Rules Engine",
                  desc: ENABLE_GBB_TIERS
                    ? "Configure pricing tiers and product rules by sign type, location, and budget — fully customizable per location."
                    : "Configure product rules by sign type, location, and budget — fully customizable per location.",
                  delay: "1600ms",
                },
              ].map(({ icon: Icon, title, desc, delay }) => (
                <div
                  key={title}
                  className={`flex gap-3 items-start transition-all duration-500 ${m ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"}`}
                  style={{ transitionDelay: delay }}
                >
                  <div className="shrink-0 w-7 h-7 rounded-lg bg-white/[0.08] border border-white/[0.1] flex items-center justify-center mt-0.5">
                    <Icon className="w-3.5 h-3.5 text-blue-300" />
                  </div>
                  <div>
                    <p className="text-white/90 text-[12px] xl:text-[13px] font-semibold leading-tight">
                      {title}
                    </p>
                    <p className="text-blue-200/50 text-[11px] leading-snug mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`transition-all duration-700 ${m ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
            style={{ transitionDelay: "1400ms" }}
          >
            <p className="text-blue-400/40 text-[11px]">© 2025 SignSalesIQ. All rights reserved.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-5 sm:px-8 lg:px-10 xl:px-14 relative bg-white dark:bg-gray-950">
        <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03] pointer-events-none">
          <svg width="100%" height="100%">
            <defs>
              <pattern id="login-dots" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="currentColor" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#login-dots)" />
          </svg>
        </div>

        <div
          className={`absolute top-3 right-3 transition-all duration-500 ${m ? "opacity-100 scale-100" : "opacity-0 scale-0"}`}
          style={{ transitionDelay: "200ms" }}
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            className="h-8 w-8 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
            data-testid="button-toggle-dark-mode-login"
          >
            {darkMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>

        <div className="lg:hidden mb-4">
          <img
            src={logoImg}
            alt="SignSalesIQ"
            className={`h-8 object-contain transition-all duration-700 ${m ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4"}`}
          />
        </div>

        <div className="w-full max-w-[360px] sm:max-w-sm relative z-10">
          <div className="text-center mb-4 sm:mb-5">
            <div
              className={`inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 mb-3 shadow-sm ${m ? "l-pop" : "opacity-0"}`}
              style={{ animationDelay: "300ms" }}
            >
              <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-blue-700 dark:text-blue-400" />
            </div>
            <h2
              className={`text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-0.5 ${m ? "l-rise" : "opacity-0"}`}
              style={{ animationDelay: "420ms" }}
            >
              Welcome back
            </h2>
            <p
              className={`text-gray-400 dark:text-gray-500 text-xs sm:text-sm ${m ? "l-fade" : "opacity-0"}`}
              style={{ animationDelay: "520ms" }}
            >
              Sign in to your account to continue
            </p>
          </div>

          <div
            className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-lg shadow-gray-200/40 dark:shadow-black/20 px-5 py-5 sm:px-7 sm:py-6 ${m ? "l-card" : "opacity-0"}`}
            style={{ animationDelay: "450ms" }}
          >
            {resetSuccess && (
              <div
                className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-xs mb-3 flex items-center gap-2"
                data-testid="text-reset-success"
              >
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Your password has been reset successfully. Please sign in with your new password.
              </div>
            )}

            {ssoError && (
              <div
                className="p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs mb-3"
                data-testid="text-sso-error"
              >
                {ssoError}
              </div>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem
                      className={m ? "l-slide" : "opacity-0"}
                      style={{ animationDelay: "600ms" }}
                    >
                      <FormLabel className="text-gray-600 dark:text-gray-400 font-medium text-xs">
                        Email or Username
                      </FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300 dark:text-gray-600 group-focus-within:text-blue-500 transition-colors duration-200" />
                          <Input
                            data-testid="input-email"
                            type="text"
                            placeholder="Enter your email or username"
                            className="pl-9 h-9 sm:h-10 text-sm rounded-lg border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all duration-200 placeholder:text-gray-300 dark:placeholder:text-gray-600"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem
                      className={m ? "l-slide" : "opacity-0"}
                      style={{ animationDelay: "700ms" }}
                    >
                      <FormLabel className="text-gray-600 dark:text-gray-400 font-medium text-xs">
                        Password
                      </FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300 dark:text-gray-600 z-10 group-focus-within:text-blue-500 transition-colors duration-200" />
                          <PasswordInput
                            data-testid="input-password"
                            placeholder="Enter your password"
                            className="pl-9 h-9 sm:h-10 text-sm rounded-lg border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all duration-200 placeholder:text-gray-300 dark:placeholder:text-gray-600"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div
                  className={`flex justify-end ${m ? "l-fade" : "opacity-0"}`}
                  style={{ animationDelay: "750ms" }}
                >
                  <Link href="/forgot-password">
                    <span
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                      data-testid="link-forgot-password"
                    >
                      Forgot Password?
                    </span>
                  </Link>
                </div>

                {login.isError && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20">
                    <p
                      className="text-xs text-red-600 dark:text-red-400"
                      data-testid="text-login-error"
                    >
                      {login.error?.message?.includes("401")
                        ? "Invalid email or password"
                        : "Login failed. Please try again."}
                    </p>
                  </div>
                )}

                <div
                  className={m ? "l-slide pt-0.5" : "opacity-0 pt-0.5"}
                  style={{ animationDelay: "800ms" }}
                >
                  <Button
                    data-testid="button-login"
                    type="submit"
                    className="w-full h-9 sm:h-10 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold shadow-md shadow-blue-700/20 hover:shadow-lg hover:shadow-blue-800/30 transition-all duration-300 motion-safe:hover:translate-y-[-1px] motion-safe:active:translate-y-[0px] motion-safe:active:scale-[0.99] group relative overflow-hidden"
                    disabled={login.isPending}
                  >
                    <span
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{ transform: "skewX(-15deg)" }}
                    />
                    {login.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-200" />
                    )}
                    Sign In
                  </Button>
                </div>
              </form>
            </Form>
          </div>

          <div
            className={`mt-4 sm:mt-5 ${m ? "l-fade" : "opacity-0"}`}
            style={{ animationDelay: "1000ms" }}
          >
            <div className="flex items-center justify-center gap-3 sm:gap-5 text-[10px] sm:text-[11px] text-gray-400 dark:text-gray-500 mb-1.5">
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                256-bit SSL
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                SOC 2 Ready
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                99.9% Uptime
              </span>
            </div>
            <p className="text-center text-[10px] text-gray-300 dark:text-gray-600">
              Powered by SignSalesIQ
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
