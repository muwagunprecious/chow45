import { Client } from "@upstash/qstash";
import { queueConfig } from "./config";

const globalForQstash = globalThis as unknown as {
  qstash: Client | undefined;
};

let qstashInstance: Client | null = null;

function getQstash() {
  if (!qstashInstance) {
    qstashInstance =
      globalForQstash.qstash ??
      new Client({
        token: queueConfig.token,
        devMode: process.env.NODE_ENV !== "production",
      });

    if (process.env.NODE_ENV !== "production") {
      globalForQstash.qstash = qstashInstance;
    }
  }
  return qstashInstance;
}

export const qstash = new Proxy({} as Client, {
  get(_target, prop) {
    const instance = getQstash() as any;
    return instance[prop];
  },
});

export async function publishJob<T>(endpoint: string, body: T) {
  return getQstash().publishJSON({
    url: `${queueConfig.baseUrl}${endpoint}`,
    body,
  });
}