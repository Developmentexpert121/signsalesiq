import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation, useSearch, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Loader2, ArrowRight, Lock, CheckCircle2, Sun, Moon } from "lucide-react";
import logoImg from "@assets/signsalesiq-logo-v2-trimmed.png";
import { useState } from "react";
import { useTheme } from "@/lib/theme";

const schema = z
  .object({
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export default function ResetPasswordPage() {
  const { darkMode, toggleDarkMode } = useTheme();
  const search = useSearch();
  const [, navigate] = useLocation();
  const [success, setSuccess] = useState(false);

  const params = new URLSearchParams(search);
  const token = params.get("token");

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const resetPassword = useMutation({
    mutationFn: async (data: { token: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/reset-password", data);
      return res.json();
    },
    onSuccess: () => {
      setSuccess(true);
      setTimeout(() => {
        navigate("/?reset=success");
      }, 2000);
    },
  });

  const onSubmit = (data: z.infer<typeof schema>) => {
    if (!token) return;
    resetPassword.mutate({ token, password: data.password });
  };

  if (!token) {
    return (
      <div
        className="h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-gray-950 px-5 relative"
        data-testid="page-reset-password-invalid"
      >
        <div className="absolute top-3 right-3 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleDarkMode}
            className="h-8 w-8 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            {darkMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
        <div className="w-full max-w-[360px] sm:max-w-sm text-center">
          <img src={logoImg} alt="SignSalesIQ" className="h-8 mx-auto mb-4 object-contain" />
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-lg shadow-gray-200/40 dark:shadow-black/20 px-5 py-6 sm:px-7">
            <p
              className="text-gray-600 dark:text-gray-400 text-sm mb-4"
              data-testid="text-invalid-token"
            >
              Invalid password reset link. Please request a new one.
            </p>
            <Link href="/forgot-password">
              <Button
                variant="outline"
                className="w-full h-9 sm:h-10 rounded-lg text-sm"
                data-testid="button-request-new"
              >
                Request New Reset Link
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-gray-950 px-5 relative"
      data-testid="page-reset-password"
    >
      <div className="absolute top-3 right-3 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleDarkMode}
          className="h-8 w-8 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          data-testid="button-toggle-dark-mode-reset"
        >
          {darkMode === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>
      <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03] pointer-events-none">
        <svg width="100%" height="100%">
          <defs>
            <pattern id="rp-dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#rp-dots)" />
        </svg>
      </div>

      <div className="w-full max-w-[360px] sm:max-w-sm relative z-10">
        <div className="text-center mb-4 sm:mb-5">
          <img src={logoImg} alt="SignSalesIQ" className="h-8 mx-auto mb-4 object-contain" />
          <div className="inline-flex items-center justify-center w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 mb-3 shadow-sm">
            <Lock className="w-5 h-5 sm:w-6 sm:h-6 text-blue-700 dark:text-blue-400" />
          </div>
          <h2
            className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white mb-0.5"
            data-testid="text-reset-password-title"
          >
            {success ? "Password Reset!" : "Set New Password"}
          </h2>
          <p className="text-gray-400 dark:text-gray-500 text-xs sm:text-sm">
            {success
              ? "Your password has been successfully reset."
              : "Enter your new password below."}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-lg shadow-gray-200/40 dark:shadow-black/20 px-5 py-5 sm:px-7 sm:py-6">
          {success ? (
            <div className="text-center py-4">
              <CheckCircle2
                className="w-12 h-12 text-emerald-500 mx-auto mb-3"
                data-testid="icon-reset-success"
              />
              <p
                className="text-gray-600 dark:text-gray-400 text-sm mb-4"
                data-testid="text-reset-success"
              >
                You can now log in with your new password.
              </p>
              <Link href="/?reset=success">
                <Button
                  className="w-full h-9 sm:h-10 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold shadow-md shadow-blue-700/20"
                  data-testid="button-go-to-login"
                >
                  <ArrowRight className="mr-2 h-4 w-4" />
                  Go to Login
                </Button>
              </Link>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3.5">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-600 dark:text-gray-400 font-medium text-xs">
                        New Password
                      </FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300 dark:text-gray-600 z-10 group-focus-within:text-blue-500 transition-colors duration-200" />
                          <PasswordInput
                            data-testid="input-new-password"
                            placeholder="Enter new password"
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
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-gray-600 dark:text-gray-400 font-medium text-xs">
                        Confirm Password
                      </FormLabel>
                      <FormControl>
                        <div className="relative group">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-300 dark:text-gray-600 z-10 group-focus-within:text-blue-500 transition-colors duration-200" />
                          <PasswordInput
                            data-testid="input-confirm-password"
                            placeholder="Confirm new password"
                            className="pl-9 h-9 sm:h-10 text-sm rounded-lg border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 focus:bg-white dark:focus:bg-gray-900 focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10 transition-all duration-200 placeholder:text-gray-300 dark:placeholder:text-gray-600"
                            {...field}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {resetPassword.isError && (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-900/20">
                    <p
                      className="text-xs text-red-600 dark:text-red-400"
                      data-testid="text-reset-error"
                    >
                      {(resetPassword.error as any)?.message?.includes("400")
                        ? "Invalid or expired reset link. Please request a new one."
                        : "Something went wrong. Please try again."}
                    </p>
                  </div>
                )}

                <div className="pt-0.5">
                  <Button
                    data-testid="button-reset-password"
                    type="submit"
                    className="w-full h-9 sm:h-10 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold shadow-md shadow-blue-700/20 hover:shadow-lg hover:shadow-blue-800/30 transition-all duration-300"
                    disabled={resetPassword.isPending}
                  >
                    {resetPassword.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Lock className="mr-2 h-4 w-4" />
                    )}
                    Reset Password
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}
