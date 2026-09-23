export interface EmailTemplate {
  subject: string;
  html: string;
  text?: string;
}

export interface SendMailOptions {
  to: string;
  template: EmailTemplate;
}

export interface MailProviderOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from: string;
}

export interface MailProviderResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface MailProvider {
  send(
    options: MailProviderOptions
  ): Promise<MailProviderResponse>;
}