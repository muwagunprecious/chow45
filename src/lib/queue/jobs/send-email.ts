import { publishJob } from "../index";

export type SendEmailJob =
    | { type: "verification"; to: string; payload: { url: string } }
    | { type: "password-reset"; to: string; payload: { url: string } }
    | { type: "welcome"; to: string; payload: { name: string } };

export async function enqueueSendEmail(job: SendEmailJob) {
    return publishJob("/api/queue/send-email", job);
}