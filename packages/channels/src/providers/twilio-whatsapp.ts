import twilio from "twilio";
import Handlebars from "handlebars";

export interface WhatsAppMessagePayload {
  phone: string; // E.164: +5491123456789
  body: string;
  headerType?: "text" | "image" | "document" | "video"; // default: text
  headerValue?: string;
  footerText?: string;
  buttons?: Array<{ id: string; title: string }>; // Quick reply buttons
  mediaUrl?: string;
}

export interface WhatsAppResult {
  messageSid: string;
  status: "queued" | "sent" | "failed";
  error?: string;
}

export class TwilioWhatsAppProvider {
  private client: twilio.Twilio;
  private fromNumber: string;

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.client = twilio(accountSid, authToken);
    this.fromNumber = fromNumber;
  }

  private buildBody(payload: WhatsAppMessagePayload): string {
    if (payload.headerType === "text" && payload.headerValue) {
      let body = `${payload.headerValue}\n\n${payload.body}`;
      if (payload.footerText) body += `\n\n${payload.footerText}`;
      return body;
    }
    let body = payload.body;
    if (payload.footerText) body += `\n\n${payload.footerText}`;
    return body;
  }

  async send(payload: WhatsAppMessagePayload): Promise<WhatsAppResult> {
    try {
      if (!this.isValidE164(payload.phone)) {
        throw new Error(`Invalid phone number format: ${payload.phone}`);
      }

      const base = {
        from: `whatsapp:${this.fromNumber}`,
        to: `whatsapp:${payload.phone}`,
      };

      const message = payload.mediaUrl
        ? await this.client.messages.create({
            ...base,
            mediaUrl: [payload.mediaUrl],
            body: payload.body,
          })
        : await this.client.messages.create({
            ...base,
            body: this.buildBody(payload),
          });

      console.log(
        `[twilio-whatsapp] Message sent ${message.sid} to ${payload.phone}`,
      );

      return {
        messageSid: message.sid,
        status: "queued",
      };
    } catch (err) {
      console.error(`[twilio-whatsapp] Failed to send: ${err}`);

      return {
        messageSid: "",
        status: "failed",
        error: String(err),
      };
    }
  }

  async sendTemplate(
    phone: string,
    templateName: string,
    parameters?: Record<string, string>,
  ): Promise<WhatsAppResult> {
    try {
      if (!this.isValidE164(phone)) {
        throw new Error(`Invalid phone number format: ${phone}`);
      }

      // Twilio WhatsApp templates use parameter substitution
      const templateParams = parameters ? Object.values(parameters) : [];

      const message = await this.client.messages.create({
        from: `whatsapp:${this.fromNumber}`,
        to: `whatsapp:${phone}`,
        contentSid: templateName, // Twilio Content SID for template
        contentVariables: JSON.stringify({ 1: templateParams[0] || "" }),
      });

      console.log(
        `[twilio-whatsapp] Template message sent ${message.sid} to ${phone}`,
      );

      return {
        messageSid: message.sid,
        status: "queued",
      };
    } catch (err) {
      console.error(`[twilio-whatsapp] Template send failed: ${err}`);

      return {
        messageSid: "",
        status: "failed",
        error: String(err),
      };
    }
  }

  renderMessage(body: string, variables: Record<string, unknown>): string {
    try {
      const template = Handlebars.compile(body);
      return template(variables);
    } catch (err) {
      console.error(`[twilio-whatsapp] Failed to render template: ${err}`);
      return body;
    }
  }

  parseWebhook(
    body: Record<string, string>,
    _headers: Record<string, string>,
  ): Array<{
    type: string;
    messageSid: string;
    status: string;
    timestamp: Date;
  }> {
    const events: Array<{
      type: string;
      messageSid: string;
      status: string;
      timestamp: Date;
    }> = [];

    const smsStatus = body["SmsStatus"];
    const messageSid = body["MessageSid"];

    if (smsStatus && messageSid) {
      const statusMap: Record<string, string> = {
        sent: "sent",
        delivered: "delivered",
        read: "read",
        failed: "failed",
        undelivered: "failed",
      };

      const status = statusMap[smsStatus] ?? smsStatus;

      events.push({
        type: status,
        messageSid,
        status,
        timestamp: new Date(),
      });
    }

    if (body["Body"] && body["From"]) {
      events.push({
        type: "reply_incoming",
        messageSid: messageSid ?? `reply_${Date.now()}`,
        status: "received",
        timestamp: new Date(),
      });
    }

    return events;
  }

  async validateConfig(config: Record<string, unknown>): Promise<boolean> {
    try {
      if (!config["accountSid"] || !config["authToken"] || !config["from"]) {
        console.error("[twilio-whatsapp] Missing required config fields");
        return false;
      }

      // Test credentials by creating a temporary client
      const testClient = twilio(
        String(config["accountSid"]),
        String(config["authToken"]),
      );
      await testClient.api.accounts.list({ limit: 1 });

      return true;
    } catch (err) {
      console.error(`[twilio-whatsapp] Invalid config: ${err}`);
      return false;
    }
  }

  private isValidE164(phone: string): boolean {
    // E.164 format: +[country code][number]
    // Example: +5491123456789
    return /^\+\d{1,15}$/.test(phone);
  }
}
