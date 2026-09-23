export const queueConfig = {
    token: process.env.QSTASH_TOKEN || "",
    currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || "",
    nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || "",
    baseUrl: process.env.NEXT_PUBLIC_APP_URL || "",
};