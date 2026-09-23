import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from "next/server";
import { mailConfig } from "@/lib/mail/config";
import type { MailProvider, SendMailOptions } from "@/lib/mail/types";

function getMailProvider(): MailProvider {
    switch (mailConfig.provider) {
        case "":
            
        default:
            throw new Error(`Unsupported mail provider: ${mailConfig.provider}`);
    }
}

async function handler(request: Request) {
    const { to, template } = (await request.json()) as SendMailOptions;
    const provider = getMailProvider();

    const result = await provider.send({
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
        from: `${mailConfig.from.name} <${mailConfig.from.email}>`,
    });

    if (!result.success) {
        return NextResponse.json(
            {
                success: false,
                error: result.error,
            },
            { status: 500 }
        );
    }

    return NextResponse.json({
        success: true,
        messageId: result.messageId,
    });
}

export async function POST(request: Request) {
    if (process.env.NODE_ENV === "production") {
        return verifySignatureAppRouter(handler)(request);
    }
    return handler(request);
}