import { z } from "zod";

const triggerTypeSchema = z.enum([
  "manual",
  "scheduled",
  "rule-based",
  "event-based",
]);

export const emailCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  description: z.string().optional(),
  subject: z.string().min(1, "Subject is required"),
  bodyHtml: z.string().min(1, "Email body is required"),
  bodyText: z.string().optional(),
  fromName: z.string().optional(),
  fromEmail: z.string().email("Invalid email").optional().or(z.literal("")),
  replyTo: z.string().email("Invalid email").optional().or(z.literal("")),
  triggerType: triggerTypeSchema,
  eventType: z.string().optional(),
  scheduledFor: z.string().optional(),
});

export const smsCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  description: z.string().optional(),
  body: z
    .string()
    .min(1, "Message body is required")
    .max(1600, "Message cannot exceed 1600 characters"),
  fromNumber: z.string().optional(),
  triggerType: triggerTypeSchema,
  eventType: z.string().optional(),
  scheduledFor: z.string().optional(),
});

export const pushCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  description: z.string().optional(),
  title: z.string().min(1, "Notification title is required"),
  body: z.string().min(1, "Notification body is required"),
  imageUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  actionUrl: z.string().url("Invalid URL").optional().or(z.literal("")),
  priority: z.enum(["high", "normal"]),
  triggerType: triggerTypeSchema,
  eventType: z.string().optional(),
});

const whatsAppButtonSchema = z.object({
  type: z.enum(["reply", "url"]),
  text: z.string().max(20),
  value: z.string().optional(),
});

export const whatsAppCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  description: z.string().optional(),
  body: z
    .string()
    .min(1, "Message is required")
    .max(4096, "Message must be 4096 characters or less"),
  headerType: z.enum(["none", "text", "image", "document", "video"]),
  headerValue: z.string().optional(),
  footerText: z
    .string()
    .max(60, "Footer must be 60 characters or less")
    .optional(),
  buttons: z.array(whatsAppButtonSchema).max(3).optional(),
  triggerType: triggerTypeSchema,
  eventType: z.string().optional(),
});

export const voiceCampaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  description: z.string().optional(),
  script: z.string().min(1, "Script is required"),
  languageCode: z.enum([
    "en-US",
    "en-GB",
    "es-ES",
    "es-MX",
    "fr-FR",
    "de-DE",
    "it-IT",
    "pt-BR",
  ]),
  voiceGender: z.enum(["male", "female"]),
  voiceSpeed: z.number().min(0.5).max(2.0),
  recordingEnabled: z.boolean(),
  dtmfEnabled: z.boolean(),
  maxRetries: z.number().int().min(0).max(5),
  triggerType: triggerTypeSchema,
  eventType: z.string().optional(),
});

export type EmailCampaignValues = z.infer<typeof emailCampaignSchema>;
export type SmsCampaignValues = z.infer<typeof smsCampaignSchema>;
export type PushCampaignValues = z.infer<typeof pushCampaignSchema>;
export type WhatsAppCampaignValues = z.infer<typeof whatsAppCampaignSchema>;

export type VoiceCampaignValues = z.infer<typeof voiceCampaignSchema>;
