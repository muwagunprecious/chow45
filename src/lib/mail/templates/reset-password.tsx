import { Button, Hr, Link, Section, Text } from "@react-email/components";
import * as React from "react";
import { EmailLayout } from "./components/layout";

interface ResetPasswordEmailProps {
    name?: string;
    url?: string;
}

export const ResetPasswordEmail = ({
    name = "there",
    url = "",
}: ResetPasswordEmailProps) => (
    <EmailLayout
        preview="Reset your Tixkarios password."
        footerNote="You're receiving this email because a password reset was requested for your Tixkarios account."
    >
        <Section className="px-12 pb-10 pt-10 text-center">
            <Section
                style={{
                    backgroundColor: "#f0f0f2",
                    borderRadius: "8px",
                    height: "160px",
                    textAlign: "center",
                }}
            >
                <Text
                    style={{
                        color: "#7c3aed",
                        fontFamily: "Arial, sans-serif",
                        fontSize: "28px",
                        fontWeight: "600",
                        lineHeight: "160px",
                        margin: 0,
                    }}
                >
                    ✓
                </Text>
            </Section>

            <Text className="mb-0 mt-5 text-[24px] font-bold leading-[32px] text-ink">
                Reset your password
            </Text>

            <Text className="mb-0 mt-2.5 text-[15px] leading-[24px] text-inkMuted">
                Hi {name}, we received a request to reset your Tixkarios
                password. Click the button below to choose a new password.
            </Text>

            <Section className="mt-7">
                <Button
                    href={url}
                    style={{
                        backgroundColor: "#7c3aed",
                        borderRadius: "10px",
                        color: "#ffffff",
                        display: "block",
                        fontFamily: "Arial, sans-serif",
                        fontSize: "15px",
                        fontWeight: "600",
                        padding: "14px 24px",
                        textAlign: "center",
                        textDecoration: "none",
                    }}
                >
                    Reset password
                </Button>
            </Section>

            <Text className="mb-0 mt-4 text-[13px] leading-[20px] text-inkFaint">
                This link expires in 1 hour.
            </Text>

            <Hr className="mt-8 border-border" />

            <Text className="mb-0 mt-6 text-left text-[13px] leading-[20px] text-inkMuted">
                If the button above doesn't work, copy and paste this link
                into your browser:
            </Text>

            <Section className="mt-1.5 rounded-lg bg-codeBg px-4 py-3 text-left">
                <Link
                    href={url}
                    className="break-all font-mono text-[12px] leading-[18px] text-primary"
                >
                    {url}
                </Link>
            </Section>

            <Text className="mb-0 mt-5 text-left text-[13px] leading-[20px] text-inkFaint">
                If you didn't request a password reset, you can safely ignore
                this email.
            </Text>
        </Section>
    </EmailLayout>
);

ResetPasswordEmail.PreviewProps = {
    name: "Roland",
    url: "https://tixkarios.com/reset-password?token=example",
} as ResetPasswordEmailProps;

export default ResetPasswordEmail;