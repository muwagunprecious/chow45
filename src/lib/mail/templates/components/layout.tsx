import {
    Body,
    Column,
    Container,
    Font,
    Head,
    Html,
    Img,
    Preview,
    Row,
    Section,
    Tailwind,
    Text,
} from "@react-email/components";
import * as React from "react";

const baseUrl = process.env.NEXT_PUBLIC_APP_URL;

const emailTailwindConfig = {
    theme: {
        extend: {
            colors: {
                primary: "#7c3aed",
                primaryTint: "#f5f0fe",
                ink: "#17171a",
                inkMuted: "#6b6b70",
                inkFaint: "#9a9a9f",
                border: "#e7e7e9",
                page: "#f4f4f5",
                codeBg: "#f7f7f8",
                iconBg: "#f0f0f2",
            },
        },
    },
};

interface EmailLayoutProps {
    preview: string;
    footerNote: string;
    children: React.ReactNode;
}

export function EmailLayout({
    preview,
    footerNote,
    children,
}: EmailLayoutProps) {
    return (
        <Html lang="en">
            <Head>
                <Font
                    fontFamily="Open Sans"
                    fallbackFontFamily="Arial"
                    webFont={{
                        url: "https://fonts.gstatic.com/s/opensans/v40/memSYaGs126MiZpBA-UvWbX2vVnXBbObj2OVZyOOSr4dVJWUgsjZ0B4gaVI.woff2",
                        format: "woff2",
                    }}
                    fontWeight={400}
                    fontStyle="normal"
                />
            </Head>

            <Preview>{preview}</Preview>

            <Tailwind config={emailTailwindConfig}>
                <Body className="m-0 bg-page p-0">
                    <Container className="mx-auto my-0 max-w-[600px] px-4 py-10">
                        <Section className="pb-7 text-center">
                            <Img
                                src={`${baseUrl}/assets/img/logo.png`}
                                width="130"
                                height="38"
                                alt="Chow45"
                                className="mx-auto"
                            />
                        </Section>

                        <Section className="rounded-2xl border border-solid border-border bg-white">
                            {children}
                        </Section>

                        <Section className="pt-7">
                            <Row>
                                <Column align="center">
                                    <a
                                        href="https://x.com/Chow45"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            textDecoration: "none",
                                        }}
                                    >
                                        <table
                                            role="presentation"
                                            cellPadding="0"
                                            cellSpacing="0"
                                            width="36"
                                            height="36"
                                            style={{
                                                width: "36px",
                                                height: "36px",
                                                backgroundColor: "#f0f0f2",
                                                borderRadius: "8px",
                                            }}
                                        >
                                            <tbody>
                                                <tr>
                                                    <td
                                                        align="center"
                                                        valign="middle"
                                                    >
                                                        <span
                                                            style={{
                                                                fontFamily:
                                                                    "Arial, sans-serif",
                                                                fontSize: "14px",
                                                                fontWeight: "600",
                                                                color: "#4c4c50",
                                                            }}
                                                        >
                                                            𝕏
                                                        </span>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </a>
                                </Column>

                                <Column align="center">
                                    <a
                                        href="https://instagram.com/Chow45"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            textDecoration: "none",
                                        }}
                                    >
                                        <table
                                            role="presentation"
                                            cellPadding="0"
                                            cellSpacing="0"
                                            width="36"
                                            height="36"
                                            style={{
                                                width: "36px",
                                                height: "36px",
                                                backgroundColor: "#f0f0f2",
                                                borderRadius: "8px",
                                            }}
                                        >
                                            <tbody>
                                                <tr>
                                                    <td
                                                        align="center"
                                                        valign="middle"
                                                    >
                                                        <span
                                                            style={{
                                                                fontFamily:
                                                                    "Arial, sans-serif",
                                                                fontSize: "13px",
                                                                fontWeight: "600",
                                                                color: "#4c4c50",
                                                            }}
                                                        >
                                                            ◎
                                                        </span>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </a>
                                </Column>

                                <Column align="center">
                                    <a
                                        href="https://facebook.com/Chow45"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{
                                            textDecoration: "none",
                                        }}
                                    >
                                        <table
                                            role="presentation"
                                            cellPadding="0"
                                            cellSpacing="0"
                                            width="36"
                                            height="36"
                                            style={{
                                                width: "36px",
                                                height: "36px",
                                                backgroundColor: "#f0f0f2",
                                                borderRadius: "8px",
                                            }}
                                        >
                                            <tbody>
                                                <tr>
                                                    <td
                                                        align="center"
                                                        valign="middle"
                                                    >
                                                        <span
                                                            style={{
                                                                fontFamily:
                                                                    "Arial, sans-serif",
                                                                fontSize: "14px",
                                                                fontWeight: "600",
                                                                color: "#4c4c50",
                                                            }}
                                                        >
                                                            f
                                                        </span>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </a>
                                </Column>
                            </Row>
                        </Section>

                        <Text
                            className="mb-0 mt-5 px-10 text-center text-[12px] leading-[19px] text-inkFaint"
                        >
                            {footerNote}
                        </Text>

                        <Text
                            className="mb-10 mt-2 text-center text-[12px] leading-[18px] text-inkFaint"
                        >
                            © {new Date().getFullYear()} Chow45 
                        </Text>
                    </Container>
                </Body>
            </Tailwind>
        </Html>
    );
}