import nodemailer from "nodemailer";
import { Resend } from "resend";
import type { IStorage } from "./storage";
import { env } from "./env";

import { logger } from "./logger";
function h(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

const RESEND_API_KEY = env.RESEND_API_KEY;
const EMAIL_PROVIDER = env.EMAIL_PROVIDER;
// Trim credentials: cloud env UIs often introduce trailing newlines/spaces on
// paste, which the SMTP server rejects with "535 authentication failed".
const SMTP_HOST = env.SMTP_HOST?.trim();
const SMTP_PORT = env.SMTP_PORT;
const SMTP_USER = (env.SMTP_USER ?? env.SMTP_FROM)?.trim();
const SMTP_PASS = env.SMTP_PASS?.trim();
const SMTP_FROM = (env.SMTP_FROM ?? SMTP_USER)?.trim();

let resendClient: Resend | null = null;
let transporter: nodemailer.Transporter | null = null;
let _storage: IStorage | null = null;

export function initEmailService(storage: IStorage): void {
  _storage = storage;
  if (RESEND_API_KEY && EMAIL_PROVIDER !== "smtp") {
    resendClient = new Resend(RESEND_API_KEY);
    logger.info(`[Email] Provider: Resend (from=${SMTP_FROM})`);
  } else if (SMTP_PASS) {
    const passHint = SMTP_PASS.substring(0, 3) + "***" + " (len=" + SMTP_PASS.length + ")";
    logger.info(
      `[Email] SMTP configured: host=${SMTP_HOST} port=${SMTP_PORT} user=${SMTP_USER} pass=${passHint}`
    );
    const t = getTransporter();
    if (t) {
      t.verify()
        .then(() => {
          logger.info("[Email] SMTP connection verified OK");
        })
        .catch((err: any) => {
          logger.error(`[Email] SMTP connection FAILED: ${err.message}`);
        });
    }
  } else {
    logger.warn("[Email] No email provider configured (set RESEND_API_KEY or SMTP_PASS)");
  }
}

function buildTransportConfig(debug = false) {
  const useSSL = SMTP_PORT === 465;
  return {
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: useSSL,
    requireTLS: !useSSL,
    auth: { user: SMTP_USER, pass: SMTP_PASS },

    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 30000,
    tls: { minVersion: "TLSv1.2" },
    ...(debug ? { debug: true, logger: true } : {}),
  } as any;
}

function getTransporter(): nodemailer.Transporter | null {
  if (!SMTP_PASS) {
    logger.warn("Email service: SMTP_PASS not configured, emails disabled");
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport(buildTransportConfig(false));
  }
  return transporter;
}

export async function testSmtpConnection(): Promise<{
  ok: boolean;
  message: string;
  config: object;
  smtpLog?: string[];
}> {
  const config = {
    host: SMTP_HOST,
    port: SMTP_PORT,
    user: SMTP_USER,
    passLength: SMTP_PASS ? SMTP_PASS.length : 0,
    passHint: SMTP_PASS ? SMTP_PASS.substring(0, 3) + "***" : "(not set)",
  };
  if (!SMTP_PASS) {
    return { ok: false, message: "SMTP_PASS not set", config };
  }
  transporter = null;
  const t = getTransporter();
  if (!t) return { ok: false, message: "Could not create transporter", config };
  try {
    await t.verify();
    return { ok: true, message: "SMTP connection verified OK", config };
  } catch (_firstErr: any) {
    transporter = null;
    const smtpLog: string[] = [];
    const debugTransport = nodemailer.createTransport({
      ...buildTransportConfig(false),
      logger: {
        level: () => {},
        trace: (msg: string, ...args: any[]) => smtpLog.push(`TRACE: ${msg} ${args.join(" ")}`),
        debug: (msg: string, ...args: any[]) => smtpLog.push(`DEBUG: ${msg} ${args.join(" ")}`),
        info: (msg: string, ...args: any[]) => smtpLog.push(`INFO:  ${msg} ${args.join(" ")}`),
        warn: (msg: string, ...args: any[]) => smtpLog.push(`WARN:  ${msg} ${args.join(" ")}`),
        error: (msg: string, ...args: any[]) => smtpLog.push(`ERROR: ${msg} ${args.join(" ")}`),
        fatal: (msg: string, ...args: any[]) => smtpLog.push(`FATAL: ${msg} ${args.join(" ")}`),
      } as any,
      debug: true,
    } as any);
    try {
      await debugTransport.verify();
      transporter = debugTransport;
      return { ok: true, message: "SMTP verified OK (debug transport)", config, smtpLog };
    } catch (err2: any) {
      smtpLog.forEach((line) => logger.error({ err: line }, "[SMTP-DEBUG]"));
      return { ok: false, message: err2.message, config, smtpLog };
    }
  }
}

function brandedTemplate(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
<tr>
<td style="background: linear-gradient(135deg, #1C4587 0%, #0d2e5e 100%);padding:28px 32px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:0.5px;">SignSalesIQ</h1>
<p style="margin:4px 0 0;color:#7eb8f0;font-size:13px;">Intelligent Signage Sales Platform</p>
</td>
</tr>
<tr>
<td style="padding:32px;">
<h2 style="margin:0 0 20px;color:#1C4587;font-size:20px;font-weight:600;">${title}</h2>
${body}
</td>
</tr>
<tr>
<td style="background-color:#f8f9fb;padding:20px 32px;border-top:1px solid #e8ecf1;">
<p style="margin:0;color:#8896a8;font-size:12px;text-align:center;">
This is an automated message from SignSalesIQ. Please do not reply directly to this email.
</p>
</td>
</tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function replaceVariables(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value || "");
  }
  return result;
}

function sendMail(
  to: string,
  subject: string,
  html: string,
  templateKey: string,
  recipientName?: string,
  metadata?: Record<string, string>,
  replyTo?: string
): void {
  if (resendClient) {
    resendClient.emails
      .send({
        from: `SignSalesIQ <${SMTP_FROM}>`,
        to,
        replyTo,
        subject,
        html,
      })
      .then((result) => {
        if (result.error) {
          logger.error({ err: result.error }, `Email failed to ${to}: ${subject}`);
          logEmail(
            templateKey,
            to,
            recipientName || "",
            subject,
            "failed",
            result.error.message,
            metadata
          );
        } else {
          logger.info(`Email sent to ${to}: ${subject}`);
          logEmail(templateKey, to, recipientName || "", subject, "sent", undefined, metadata);
        }
      })
      .catch((err) => {
        logger.error({ err: err }, `Email failed to ${to}: ${subject}`);
        logEmail(templateKey, to, recipientName || "", subject, "failed", err.message, metadata);
      });
    return;
  }
  const t = getTransporter();
  if (!t) {
    logEmail(
      templateKey,
      to,
      recipientName || "",
      subject,
      "skipped",
      "Email not configured",
      metadata
    );
    return;
  }
  t.sendMail({
    from: `"SignSalesIQ" <${SMTP_FROM}>`,
    to,
    replyTo,
    subject,
    html,
  })
    .then(() => {
      logger.info(`Email sent to ${to}: ${subject}`);
      logEmail(templateKey, to, recipientName || "", subject, "sent", undefined, metadata);
    })
    .catch((err) => {
      logger.error({ err: err }, `Email failed to ${to}: ${subject}`);
      logEmail(templateKey, to, recipientName || "", subject, "failed", err.message, metadata);
    });
}

function logEmail(
  templateKey: string,
  recipientEmail: string,
  recipientName: string,
  subject: string,
  status: string,
  errorMessage?: string,
  metadata?: Record<string, string>
): void {
  if (!_storage) return;
  _storage
    .createEmailLog({
      templateKey,
      recipientEmail,
      recipientName: recipientName || null,
      subject,
      status,
      errorMessage: errorMessage || null,
      metadata: metadata || null,
    })
    .catch((err) => {
      logger.error({ err: err }, "Failed to log email:");
    });
}

export function sendAdminWelcomeEmail(
  name: string,
  email: string,
  tempPassword: string,
  tenantName: string
): void {
  const body = `
<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">Hello <strong>${h(name)}</strong>,</p>
<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">
Welcome to <strong>SignSalesIQ</strong>! Your admin account has been created for <strong>${h(tenantName)}</strong>.
</p>
<div style="background-color:#f0f5ff;border-left:4px solid #1C4587;border-radius:6px;padding:16px 20px;margin:20px 0;">
<p style="margin:0 0 8px;color:#1C4587;font-weight:600;font-size:14px;">Your Login Credentials</p>
<table style="font-size:14px;color:#3a4a5c;">
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Email:</td><td>${h(email)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Password:</td><td style="font-family:monospace;background:#e8ecf1;padding:2px 8px;border-radius:4px;">${h(tempPassword)}</td></tr>
</table>
</div>
<p style="color:#3a4a5c;font-size:14px;line-height:1.6;">
Please log in and change your password as soon as possible for security purposes.
</p>
<p style="color:#3a4a5c;font-size:14px;line-height:1.6;">
As an admin, you can manage users, create opportunities, and generate professional signage proposals.
</p>`;
  sendMail(
    email,
    `Welcome to SignSalesIQ - Admin Account Created`,
    brandedTemplate("Welcome, Admin!", body),
    "admin_welcome",
    name,
    { tenantName }
  );
}

export interface UserWelcomeEmailOptions {
  name: string;
  email: string;
  tempPassword: string;
  companyName: string;
  role: string;
  companyWebsite?: string | null;
  companyLogoUrl?: string | null;
}

export function sendUserWelcomeEmail(options: UserWelcomeEmailOptions): void {
  const { name, email, tempPassword, companyName, role, companyWebsite, companyLogoUrl } = options;
  const roleDisplay: Record<string, string> = {
    SALES: "Sales Representative",
    ACCOUNT_MANAGER: "Account Manager",
    PROJECT_MANAGER: "Project Manager",
    OUTSIDE_SALES: "Outside Sales",
    INSIDE_SALES: "Inside Sales",
    SALES_MANAGER: "Sales Manager",
    DESIGNER: "Designer",
    PRODUCTION_MANAGER: "Production Manager",
    ADMIN: "Administrator",
  };
  const roleLabel = roleDisplay[role] || role;

  const logoSection = companyLogoUrl
    ? `<div style="text-align:center;margin:0 0 20px;">
<img src="${h(companyLogoUrl)}" alt="${h(companyName)}" style="max-width:180px;max-height:80px;object-fit:contain;" />
</div>`
    : "";

  const websiteSection = companyWebsite
    ? `<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Website:</td><td><a href="${h(companyWebsite.startsWith("http") ? companyWebsite : "https://" + companyWebsite)}" style="color:#1C4587;text-decoration:underline;">${h(companyWebsite)}</a></td></tr>`
    : "";

  const body = `
${logoSection}
<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">Hello <strong>${h(name)}</strong>,</p>
<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">
Welcome! An account has been created for you at <strong>${h(companyName)}</strong>.
</p>
<div style="background-color:#f0f5ff;border-left:4px solid #1C4587;border-radius:6px;padding:16px 20px;margin:20px 0;">
<p style="margin:0 0 8px;color:#1C4587;font-weight:600;font-size:14px;">Your Login Credentials</p>
<table style="font-size:14px;color:#3a4a5c;">
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Email:</td><td>${h(email)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Password:</td><td style="font-family:monospace;background:#e8ecf1;padding:2px 8px;border-radius:4px;">${h(tempPassword)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Role:</td><td>${h(roleLabel)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Company:</td><td>${h(companyName)}</td></tr>
${websiteSection}
</table>
</div>
<p style="color:#3a4a5c;font-size:14px;line-height:1.6;">
Please log in and change your password as soon as possible for security purposes.
</p>
<p style="color:#3a4a5c;font-size:14px;line-height:1.6;">
You can now create opportunities and generate professional signage proposals for your clients.
</p>`;
  sendMail(
    email,
    `Welcome to ${companyName} - Your Account is Ready`,
    brandedTemplate(`Welcome to ${companyName}!`, body),
    "user_welcome",
    name,
    { companyName, role: roleLabel }
  );
}

export function sendOpportunityCreatedEmail(
  recipientEmail: string,
  recipientName: string,
  oppName: string,
  oppAddress: string,
  creatorName: string
): void {
  const body = `
<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">Hello <strong>${h(recipientName)}</strong>,</p>
<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">
A new opportunity has been created in SignSalesIQ.
</p>
<div style="background-color:#f0faf5;border-left:4px solid #009987;border-radius:6px;padding:16px 20px;margin:20px 0;">
<p style="margin:0 0 8px;color:#009987;font-weight:600;font-size:14px;">Opportunity Details</p>
<table style="font-size:14px;color:#3a4a5c;">
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Name:</td><td>${h(oppName)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Address:</td><td>${h(oppAddress) || "N/A"}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Created By:</td><td>${h(creatorName)}</td></tr>
</table>
</div>
<p style="color:#3a4a5c;font-size:14px;line-height:1.6;">
Log in to SignSalesIQ to view the full details and start working on this opportunity.
</p>`;
  sendMail(
    recipientEmail,
    `New Opportunity Created: ${oppName}`,
    brandedTemplate("New Opportunity Created", body),
    "opportunity_created",
    recipientName,
    { opportunityName: oppName, creatorName }
  );
}

export function sendOpportunityStatusEmail(
  recipientEmail: string,
  recipientName: string,
  oppName: string,
  status: string
): void {
  const isWon = status === "WON";
  const statusLabel = isWon ? "Won" : "Lost";
  const statusColor = isWon ? "#16a34a" : "#dc2626";
  const statusBg = isWon ? "#f0fdf4" : "#fef2f2";
  const statusIcon = isWon ? "🎉" : "📋";

  const body = `
<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">Hello <strong>${h(recipientName)}</strong>,</p>
<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">
An opportunity status has been updated in SignSalesIQ.
</p>
<div style="background-color:${statusBg};border-left:4px solid ${statusColor};border-radius:6px;padding:16px 20px;margin:20px 0;">
<p style="margin:0 0 8px;font-weight:600;font-size:16px;">
${statusIcon} Opportunity: <strong>${h(oppName)}</strong>
</p>
<p style="margin:0;font-size:15px;">
Status: <span style="color:${statusColor};font-weight:700;font-size:16px;">${statusLabel}</span>
</p>
</div>
<p style="color:#3a4a5c;font-size:14px;line-height:1.6;">
Log in to SignSalesIQ to view the full details.
</p>`;
  sendMail(
    recipientEmail,
    `Opportunity ${statusLabel}: ${oppName}`,
    brandedTemplate(`Opportunity ${statusLabel}`, body),
    "opportunity_status",
    recipientName,
    { opportunityName: oppName, status: statusLabel }
  );
}

export function sendPlanPurchaseEmail(
  recipientEmail: string,
  recipientName: string,
  planName: string,
  planPrice: string
): void {
  const body = `
<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">Hello <strong>${h(recipientName)}</strong>,</p>
<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">
Thank you for your purchase! Your subscription has been activated.
</p>
<div style="background-color:#fef9f0;border-left:4px solid #f59e0b;border-radius:6px;padding:16px 20px;margin:20px 0;">
<p style="margin:0 0 8px;color:#b45309;font-weight:600;font-size:14px;">Subscription Details</p>
<table style="font-size:14px;color:#3a4a5c;">
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Plan:</td><td>${h(planName)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Amount Paid:</td><td>$${h(planPrice)}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Status:</td><td style="color:#16a34a;font-weight:600;">Active</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Valid For:</td><td>30 days</td></tr>
</table>
</div>
<p style="color:#3a4a5c;font-size:14px;line-height:1.6;">
Your subscription is now active. You can view your subscription details and usage on the My Subscription page.
</p>`;
  sendMail(
    recipientEmail,
    `Subscription Confirmed: ${planName}`,
    brandedTemplate("Subscription Confirmed!", body),
    "plan_purchase",
    recipientName,
    { planName, planPrice }
  );
}

export function sendPlanExpirationWarningEmail(
  recipientEmail: string,
  recipientName: string,
  planName: string,
  daysLeft: number
): void {
  const isToday = daysLeft <= 0;
  const urgencyColor = isToday ? "#dc2626" : "#f59e0b";
  const urgencyBg = isToday ? "#fef2f2" : "#fef9f0";
  const urgencyTitle = isToday
    ? "Your Plan Expires Today"
    : `Your Plan Expires in ${daysLeft} Days`;
  const urgencyIcon = isToday ? "⚠️" : "⏰";

  const body = `
<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">Hello <strong>${h(recipientName)}</strong>,</p>
<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">
${
  isToday
    ? "Your subscription plan expires <strong>today</strong>. Please renew to continue using all features."
    : `Your subscription plan will expire in <strong>${daysLeft} days</strong>. Please renew soon to avoid any service interruption.`
}
</p>
<div style="background-color:${urgencyBg};border-left:4px solid ${urgencyColor};border-radius:6px;padding:16px 20px;margin:20px 0;">
<p style="margin:0;font-size:16px;font-weight:600;">
${urgencyIcon} Plan: <strong>${h(planName)}</strong>
</p>
<p style="margin:8px 0 0;font-size:14px;color:${urgencyColor};font-weight:600;">
${isToday ? "Expires today — please renew now" : `Expires in ${daysLeft} days`}
</p>
</div>
<p style="color:#3a4a5c;font-size:14px;line-height:1.6;">
Visit the <strong>My Subscription</strong> page to renew or upgrade your plan.
</p>`;
  sendMail(
    recipientEmail,
    `${urgencyIcon} ${urgencyTitle} - ${planName}`,
    brandedTemplate(urgencyTitle, body),
    "plan_expiration",
    recipientName,
    { planName, daysLeft: String(daysLeft) }
  );
}

export async function checkPlanExpirations(storage: any): Promise<void> {
  try {
    const subscriptions = await storage.getAllActiveSubscriptions();
    if (!subscriptions || subscriptions.length === 0) return;

    const now = new Date();
    for (const sub of subscriptions) {
      if (!sub.subscribedAt) continue;

      const subscribedAt = new Date(sub.subscribedAt);
      const expiryDate = new Date(subscribedAt);
      expiryDate.setDate(expiryDate.getDate() + 30);

      const diffMs = expiryDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      const notified = sub.expirationNotified;

      if (diffDays <= 0 && notified !== "expired") {
        const user = sub.userId ? await storage.getUser(sub.userId) : null;
        const email = user?.email || sub.tenantEmail;
        const name = user?.name || sub.tenantName || "Customer";
        if (email) {
          sendPlanExpirationWarningEmail(email, name, sub.planName || "Your Plan", 0);
          await storage.updateExpirationNotified(sub.id, "expired");
        }
      } else if (diffDays > 0 && diffDays <= 2 && notified !== "2day" && notified !== "expired") {
        const user = sub.userId ? await storage.getUser(sub.userId) : null;
        const email = user?.email || sub.tenantEmail;
        const name = user?.name || sub.tenantName || "Customer";
        if (email) {
          sendPlanExpirationWarningEmail(email, name, sub.planName || "Your Plan", diffDays);
          await storage.updateExpirationNotified(sub.id, "2day");
        }
      }
    }
  } catch (err: any) {
    logger.error({ err: err }, "Plan expiration check failed:");
  }
}

let schedulerInterval: NodeJS.Timeout | null = null;

export function startExpirationScheduler(storage: any): void {
  logger.info("Starting plan expiration scheduler (runs every 12 hours)");
  checkPlanExpirations(storage);
  schedulerInterval = setInterval(
    () => {
      checkPlanExpirations(storage);
    },
    12 * 60 * 60 * 1000
  );
}

export const DEFAULT_EMAIL_TEMPLATES = [
  {
    templateKey: "admin_welcome",
    name: "Admin Welcome",
    subject: "Welcome to SignSalesIQ - Admin Account Created",
    description: "Sent when a Super Admin creates a new tenant/owner and their admin account.",
    variables: ["name", "email", "tempPassword", "tenantName"],
    bodyHtml: `<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">Hello <strong>{{name}}</strong>,</p>
<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">
Welcome to <strong>SignSalesIQ</strong>! Your admin account has been created for <strong>{{tenantName}}</strong>.
</p>
<div style="background-color:#f0f5ff;border-left:4px solid #1C4587;border-radius:6px;padding:16px 20px;margin:20px 0;">
<p style="margin:0 0 8px;color:#1C4587;font-weight:600;font-size:14px;">Your Login Credentials</p>
<table style="font-size:14px;color:#3a4a5c;">
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Email:</td><td>{{email}}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Password:</td><td style="font-family:monospace;background:#e8ecf1;padding:2px 8px;border-radius:4px;">{{tempPassword}}</td></tr>
</table>
</div>
<p style="color:#3a4a5c;font-size:14px;line-height:1.6;">
Please log in and change your password as soon as possible for security purposes.
</p>
<p style="color:#3a4a5c;font-size:14px;line-height:1.6;">
As an admin, you can manage users, create opportunities, and generate professional signage proposals.
</p>`,
  },
  {
    templateKey: "user_welcome",
    name: "User Welcome",
    subject: "Welcome to {{companyName}} - Your Account is Ready",
    description:
      "Sent when an admin creates a new user under their tenant. Includes company branding.",
    variables: [
      "name",
      "email",
      "tempPassword",
      "companyName",
      "role",
      "companyWebsite",
      "companyLogoUrl",
    ],
    bodyHtml: `{{logoSection}}
<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">Hello <strong>{{name}}</strong>,</p>
<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">
Welcome! An account has been created for you at <strong>{{companyName}}</strong>.
</p>
<div style="background-color:#f0f5ff;border-left:4px solid #1C4587;border-radius:6px;padding:16px 20px;margin:20px 0;">
<p style="margin:0 0 8px;color:#1C4587;font-weight:600;font-size:14px;">Your Login Credentials</p>
<table style="font-size:14px;color:#3a4a5c;">
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Email:</td><td>{{email}}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Password:</td><td style="font-family:monospace;background:#e8ecf1;padding:2px 8px;border-radius:4px;">{{tempPassword}}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Role:</td><td>{{role}}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Company:</td><td>{{companyName}}</td></tr>
{{websiteSection}}
</table>
</div>
<p style="color:#3a4a5c;font-size:14px;line-height:1.6;">
Please log in and change your password as soon as possible for security purposes.
</p>
<p style="color:#3a4a5c;font-size:14px;line-height:1.6;">
You can now create opportunities and generate professional signage proposals for your clients.
</p>`,
  },
  {
    templateKey: "opportunity_created",
    name: "Opportunity Created",
    subject: "New Opportunity Created: {{opportunityName}}",
    description: "Sent when a new opportunity is created, notifying the creator.",
    variables: ["recipientName", "opportunityName", "opportunityAddress", "creatorName"],
    bodyHtml: `<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">Hello <strong>{{recipientName}}</strong>,</p>
<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">
A new opportunity has been created in SignSalesIQ.
</p>
<div style="background-color:#f0faf5;border-left:4px solid #009987;border-radius:6px;padding:16px 20px;margin:20px 0;">
<p style="margin:0 0 8px;color:#009987;font-weight:600;font-size:14px;">Opportunity Details</p>
<table style="font-size:14px;color:#3a4a5c;">
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Name:</td><td>{{opportunityName}}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Address:</td><td>{{opportunityAddress}}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Created By:</td><td>{{creatorName}}</td></tr>
</table>
</div>
<p style="color:#3a4a5c;font-size:14px;line-height:1.6;">
Log in to SignSalesIQ to view the full details and start working on this opportunity.
</p>`,
  },
  {
    templateKey: "opportunity_status",
    name: "Opportunity Status Update",
    subject: "Opportunity {{status}}: {{opportunityName}}",
    description: "Sent when an opportunity status changes to WON or LOST.",
    variables: [
      "recipientName",
      "opportunityName",
      "status",
      "statusColor",
      "statusBg",
      "statusIcon",
    ],
    bodyHtml: `<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">Hello <strong>{{recipientName}}</strong>,</p>
<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">
An opportunity status has been updated in SignSalesIQ.
</p>
<div style="background-color:{{statusBg}};border-left:4px solid {{statusColor}};border-radius:6px;padding:16px 20px;margin:20px 0;">
<p style="margin:0 0 8px;font-weight:600;font-size:16px;">
{{statusIcon}} Opportunity: <strong>{{opportunityName}}</strong>
</p>
<p style="margin:0;font-size:15px;">
Status: <span style="color:{{statusColor}};font-weight:700;font-size:16px;">{{status}}</span>
</p>
</div>
<p style="color:#3a4a5c;font-size:14px;line-height:1.6;">
Log in to SignSalesIQ to view the full details.
</p>`,
  },
  {
    templateKey: "plan_purchase",
    name: "Plan Purchase Confirmation",
    subject: "Subscription Confirmed: {{planName}}",
    description: "Sent after a successful Stripe payment and subscription activation.",
    variables: ["recipientName", "planName", "planPrice"],
    bodyHtml: `<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">Hello <strong>{{recipientName}}</strong>,</p>
<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">
Thank you for your purchase! Your subscription has been activated.
</p>
<div style="background-color:#fef9f0;border-left:4px solid #f59e0b;border-radius:6px;padding:16px 20px;margin:20px 0;">
<p style="margin:0 0 8px;color:#b45309;font-weight:600;font-size:14px;">Subscription Details</p>
<table style="font-size:14px;color:#3a4a5c;">
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Plan:</td><td>{{planName}}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Amount Paid:</td><td>${"$"}{{planPrice}}</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Status:</td><td style="color:#16a34a;font-weight:600;">Active</td></tr>
<tr><td style="padding:4px 12px 4px 0;font-weight:600;">Valid For:</td><td>30 days</td></tr>
</table>
</div>
<p style="color:#3a4a5c;font-size:14px;line-height:1.6;">
Your subscription is now active. You can view your subscription details and usage on the My Subscription page.
</p>`,
  },
  {
    templateKey: "plan_expiration",
    name: "Plan Expiration Warning",
    subject: "Your Plan Expires Soon - {{planName}}",
    description: "Sent 2 days before and on the day of plan expiration.",
    variables: [
      "recipientName",
      "planName",
      "daysLeft",
      "urgencyColor",
      "urgencyBg",
      "urgencyIcon",
      "urgencyMessage",
    ],
    bodyHtml: `<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">Hello <strong>{{recipientName}}</strong>,</p>
<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">
{{urgencyMessage}}
</p>
<div style="background-color:{{urgencyBg}};border-left:4px solid {{urgencyColor}};border-radius:6px;padding:16px 20px;margin:20px 0;">
<p style="margin:0;font-size:16px;font-weight:600;">
{{urgencyIcon}} Plan: <strong>{{planName}}</strong>
</p>
<p style="margin:8px 0 0;font-size:14px;color:{{urgencyColor}};font-weight:600;">
{{expiryText}}
</p>
</div>
<p style="color:#3a4a5c;font-size:14px;line-height:1.6;">
Visit the <strong>My Subscription</strong> page to renew or upgrade your plan.
</p>`,
  },
];

export async function sendProposalPdfEmail(
  to: string,
  clientName: string,
  opportunityName: string,
  salespersonName: string,
  pdfBuffer: Buffer,
  replyTo?: string
): Promise<{ success: boolean; error?: string }> {
  const subject = `Your Sign Proposal: ${opportunityName}`;
  const html = brandedTemplate(
    "Your Sign Proposal is Ready",
    `<p style="margin:0 0 16px;color:#374151;font-size:15px;">Dear ${h(clientName)},</p>
<p style="margin:0 0 16px;color:#374151;font-size:15px;">
  Please find your sign proposal attached to this email. The PDF includes detailed mockups, specifications, and pricing for your review.
</p>
<p style="margin:0 0 16px;color:#374151;font-size:15px;">
  If you have any questions or would like to discuss the proposal, please don't hesitate to reach out to us.
</p>
<p style="margin:0 0 0;color:#374151;font-size:15px;">Best regards,<br/><strong>${h(salespersonName)}</strong></p>`
  );
  const filename = `${opportunityName.replace(/[^a-z0-9]/gi, "_")}_proposal.pdf`;

  if (resendClient) {
    try {
      const result = await resendClient.emails.send({
        from: `SignSalesIQ <${SMTP_FROM}>`,
        to,
        replyTo,
        subject,
        html,
        attachments: [{ filename, content: pdfBuffer }],
      });
      if (result.error) {
        logger.error({ err: result.error }, `Proposal email failed to ${to}:`);
        logEmail("proposal_pdf", to, clientName, subject, "failed", result.error.message);
        return { success: false, error: result.error.message };
      }
      logEmail("proposal_pdf", to, clientName, subject, "sent");
      return { success: true };
    } catch (err: any) {
      logger.error({ err: err }, `Proposal email failed to ${to}:`);
      logEmail("proposal_pdf", to, clientName, subject, "failed", err.message);
      return { success: false, error: err.message };
    }
  }

  const t = getTransporter();
  if (!t) {
    logEmail("proposal_pdf", to, clientName, subject, "skipped", "Email not configured");
    return {
      success: false,
      error: "Email service not configured (set RESEND_API_KEY or SMTP_PASS)",
    };
  }

  try {
    await t.sendMail({
      from: `"SignSalesIQ" <${SMTP_FROM}>`,
      to,
      replyTo,
      subject,
      html,
      attachments: [{ filename, content: pdfBuffer, contentType: "application/pdf" }],
    });
    logEmail("proposal_pdf", to, clientName, subject, "sent");
    return { success: true };
  } catch (err: any) {
    logger.error({ err: err }, `Proposal email failed to ${to}:`);
    logEmail("proposal_pdf", to, clientName, subject, "failed", err.message);
    return { success: false, error: err.message };
  }
}

export function sendPasswordResetEmail(name: string, email: string, resetLink: string): void {
  const body = `
<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">Hello <strong>${h(name)}</strong>,</p>
<p style="color:#3a4a5c;font-size:15px;line-height:1.6;">
We received a request to reset the password for your SignSalesIQ account.
</p>
<div style="text-align:center;margin:28px 0;">
<a href="${h(resetLink)}" style="display:inline-block;background:linear-gradient(135deg,#1C4587 0%,#0d2e5e 100%);color:#ffffff;text-decoration:none;padding:14px 36px;border-radius:8px;font-size:15px;font-weight:600;letter-spacing:0.3px;box-shadow:0 2px 8px rgba(28,69,135,0.3);">
Reset Your Password
</a>
</div>
<p style="color:#3a4a5c;font-size:14px;line-height:1.6;">
This link will expire in <strong>1 hour</strong>. If you didn't request a password reset, you can safely ignore this email — your password will remain unchanged.
</p>
<p style="color:#8896a8;font-size:12px;line-height:1.6;margin-top:20px;">
If the button above doesn't work, copy and paste this URL into your browser:<br>
<span style="color:#1C4587;word-break:break-all;">${h(resetLink)}</span>
</p>`;
  sendMail(
    email,
    "Reset Your Password - SignSalesIQ",
    brandedTemplate("Password Reset Request", body),
    "password_reset",
    name
  );
}

export async function seedEmailTemplates(storage: IStorage): Promise<void> {
  try {
    const existing = await storage.getEmailTemplates();
    for (const tmpl of DEFAULT_EMAIL_TEMPLATES) {
      const found = existing.find((e) => e.templateKey === tmpl.templateKey);
      if (!found) {
        await storage.createEmailTemplate(tmpl);
        logger.info(`Seeded email template: ${tmpl.name}`);
      }
    }
  } catch (err: any) {
    logger.error({ err: err }, "Failed to seed email templates:");
  }
}
