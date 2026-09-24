import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, ArrowLeft, Mail, CheckCircle2, Sun, Moon } from "lucide-react";
import logoImg from "@assets/signsalesiq-logo-v2-trimmed.png";
import { useState } from "react";
import { useTheme } from "@/lib/theme";

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export default function ForgotPasswordPage() {
  const { darkMode, toggleDarkMode } = useTheme();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const forgotPassword = useMutation({
    mutationFn: async (data: { email: string }) => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", data);
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
    },
  });

  const onSubmit = (data: z.infer<typeof schema>) => {
    forgotPassword.mutate(data);
  };

  return (
    <div
      className="h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-gray-950 px-5 relative"
      data-testid="page-forgot-password"
    >
      <div className="absolute top-3 right-3 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDarkMode}
          className="h-8 w-8 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          data-testid="button-toggle-dark-mode-forgot"
        >
          {darkMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
      <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03] pointer-events-none">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="fp-dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#fp-dots)" />
        </svg>
      </div>

      <div className="w-full max-w-[360px] sm:max-w-sm relative z-10">
        <div className="text-center mb-4 sm:mb-5">
          <img src={logoImg} alt="SignSalesIQ" className="h-8 mx-auto mb-4 object-contain" />
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 mb-3 shadow-sm">
            <Mail className="w-5 h-5 sm:w-6 sm:h-6 text-blue-700 dark:text-blue-400" />
          </div>
          <h2
            className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-0.5"
            data-testid="text-forgot-password-title"
          >
            {submitted ? "Check Your Email" : "Forgot Password?"}
          </h2>
          <p className="text-gray-400 dark:text-gray-500 text-xs sm:text-sm">
            {submitted
              ? "If an account exists with that email, you'll receive a reset link shortly."
              : "Enter your email and we'll send you a link to reset your password."}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-lg shadow-gray-200/40 dark:shadow-black/20 px-5 py-5 sm:px-7 sm:py-6">
          {submitted ? (
            <div className="text-center py-4">
              <CheckCircle2
                className="w-12 h-12 text-emerald-500 mx-auto mb-3"
                data-testid="icon-email-sent"
              />
              <p
                className="text-gray-600 dark:text-gray-400 text-sm mb-4"
                data-testid="text-email-sent-message"
              >
                We've sent a password reset link to your email. Please check your inbox and spam
                folder.
              </p>
              <Link href="/">
                <Button
                  variant="outline"
                  className="w-full h-9 sm:h-10 rounded-lg text-sm"
                  data-testid="button-back-to-login"
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Login
                </Button>
              </Link>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-600 dark:text-gray-400 font-medium text-xs">
                        Email Address
                      </FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300 dark:text-gray-600 group-focus-within:text-blue-500 transition-colors duration-200" />
                          <Input
                            data-testid="input-forgot-email"
                            type="email"
                            placeholder="Enter your email address"
                            className="pl-9 h-9 sm:h-10 text-sm rounded-lg border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all duration-200 placeholder:text-gray-300 dark:placeholder:text-gray-600"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {forgotPassword.isError && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20">
                    <p
                      className="text-xs text-red-600 dark:text-red-400"
                      data-testid="text-forgot-error"
                    >
                      Something went wrong. Please try again.
                    </p>
                  </div>
                )}

                <div className="pt-0.5">
                  <Button
                    data-testid="button-send-reset"
                    type="submit"
                    className="w-full h-9 sm:h-10 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold shadow-md shadow-blue-700/20 hover:shadow-lg hover:shadow-blue-800/30 transition-all duration-300"
                    disabled={forgotPassword.isPending}
                  >
                    {forgotPassword.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Mail className="mr-2 h-4 w-4" />
                    )}
                    Send Reset Link
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>

        {!submitted && (
          <div className="mt-4 text-center">
            <Link href="/">
              <span
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline cursor-pointer inline-flex items-center gap-1"
                data-testid="link-back-to-login"
              >
                <ArrowLeft className="h-3 w-3" />
                Back to Login
              </span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
