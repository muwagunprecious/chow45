import { Button, Hr, Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './components/layout';

interface VerificationEmailProps {
    name?: string;
    url?: string;
}

export const VerificationEmail = ({
    name = 'there',
    url = '',
}: VerificationEmailProps) => (
    <EmailLayout
        preview="Confirm your email address to finish setting up your Tixkarios account."
        footerNote="You're receiving this email because you recently signed up for a Tixkarios account and need to verify your email address."
    >
        <Section className="px-12 pb-10 pt-10 text-center">
            <table role="presentation" cellPadding={0} cellSpacing={0} width={600} style={{ backgroundColor: "#f0f0f2", borderRadius: "8px", height: "400px" }}>
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style={{ width: 52, height: 52, fontSize: 22, color: '#7c3aed', fontFamily: 'Arial, sans-serif' }}>
                            &#10003;
                        </td>
                    </tr>
                </tbody>
            </table>

            <Text className="mb-0 mt-5 text-[24px] font-bold leading-[32px] text-ink">
                Confirm your email address
            </Text>

            <Text className="mb-0 mt-2.5 text-[15px] leading-[24px] text-inkMuted">
                Hi {name}, thanks for signing up on Tixkarios. Verify your email address to activate your account.
            </Text>

            <Section className="mt-7">
                <Button
                    href={url}
                    className="box-border w-full max-w-[280px] rounded-[10px] bg-primary px-0 py-3.5 text-center text-[15px] font-semibold text-white"
                >
                    Verify email address
                </Button>
            </Section>

            <Text className="mb-0 mt-4 text-[13px] leading-[20px] text-inkFaint">
                This link expires in 1 hour.
            </Text>

            <Hr className="mt-8 border-border" />

            <Text className="mb-0 mt-6 text-left text-[13px] leading-[20px] text-inkMuted">
                If the button above doesn't work, copy and paste this link into your browser:
            </Text>

            <Section className="mt-1.5 rounded-lg bg-codeBg px-4 py-3 text-left">
                <Link href={url} className="break-all font-mono text-[12px] leading-[18px] text-primary">
                    {url}
                </Link>
            </Section>

            <Text className="mb-0 mt-5 text-left text-[13px] leading-[20px] text-inkFaint">
                Didn't create a Tixkarios account? You can safely ignore this email.
            </Text>
        </Section>
    </EmailLayout>
);
VerificationEmail.PreviewProps = {
    name: '',
    url: '',
} as VerificationEmailProps;

export default VerificationEmail;