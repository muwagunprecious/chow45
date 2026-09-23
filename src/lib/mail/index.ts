import "server-only";
import { Client } from "@upstash/qstash";
import { queueConfig } from "../queue/config";
import type { SendMailOptions } from "./types";

const qstash = new Client({
    token: queueConfig.token,
});

export async function sendMail({
    to,
    template,
}: SendMailOptions) {
    return qstash.publishJSON({
        url: `${queueConfig.baseUrl}/api/queue/send-email`,
        body: { to, template },
    });
}