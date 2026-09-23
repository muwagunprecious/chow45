import { Button, Hr, Link, Section, Text } from '@react-email/components';
import * as React from 'react';
import { EmailLayout } from './components/layout';

interface CollaboratorInviteEmailProps {
    name?: string;
    inviterName?: string;
    eventTitle?: string;
    role?: string;
    url?: string;
    isNewUser?: boolean;
    recipientEmail?: string;
}

export const CollaboratorInviteEmail = ({
    name = 'there',
    inviterName = 'The organizer',
    eventTitle = 'an event',
    role = 'Co-organizer',
    url = '',
    isNewUser = false,
    recipientEmail = '',
}: CollaboratorInviteEmailProps) => (
    <EmailLayout
        preview={`${inviterName} invited you to help manage "${eventTitle}" on Tixkarios.`}
        footerNote="You're receiving this email because someone invited you to collaborate on their Tixkarios event. If you weren't expecting this, you can safely ignore it."
    >
        <Section className="px-12 pb-10 pt-10 text-center">
            <table role="presentation" cellPadding={0} cellSpacing={0} align="center" style={{ backgroundColor: "#f0f0f2", borderRadius: "50%", margin: "0 auto" }}>
                <tbody>
                    <tr>
                        <td align="center" valign="middle" style={{ width: 52, height: 52, fontSize: 22, color: '#7c3aed', fontFamily: 'Arial, sans-serif' }}>
                            &#128101;
                        </td>
                    </tr>
                </tbody>
            </table>

            <Text className="mb-0 mt-5 text-[24px] font-bold leading-[32px] text-ink">
                You've been invited to collaborate
            </Text>

            <Text className="mb-0 mt-2.5 text-[15px] leading-[24px] text-inkMuted">
                Hi {name}, {inviterName} invited you to join <strong>{eventTitle}</strong> as a {role.toLowerCase()} on Tixkarios.
            </Text>

            {isNewUser ? (
                <Text className="mb-0 mt-2.5 text-[15px] leading-[24px] text-inkMuted">
                    You don't have a Tixkarios account yet. Create one with <strong>{recipientEmail}</strong> and the invitation will be waiting on your dashboard.
                </Text>
            ) : null}

            <Section className="mt-7">
                <Button
                    href={url}
                    className="box-border w-full max-w-[280px] rounded-[10px] bg-primary px-0 py-3.5 text-center text-[15px] font-semibold text-white"
                >
                    {isNewUser ? 'Create account' : 'View invitation'}
                </Button>
            </Section>

            <Text className="mb-0 mt-4 text-[13px] leading-[20px] text-inkFaint">
                {isNewUser
                    ? 'Sign up with the same email address this message was sent to, then accept the invite from My Events.'
                    : 'Accept the invite from My Events to get access to manage this event.'}
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
                Didn't expect this invite? You can safely ignore this email — no account changes will be made.
            </Text>
        </Section>
    </EmailLayout>
);

CollaboratorInviteEmail.PreviewProps = {
    name: '',
    inviterName: '',
    eventTitle: '',
    role: 'Co-organizer',
    url: '',
    isNewUser: false,
    recipientEmail: '',
} as CollaboratorInviteEmailProps;

export default CollaboratorInviteEmail;