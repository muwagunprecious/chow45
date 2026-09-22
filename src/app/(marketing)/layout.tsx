import "./marketing.css";

export default function MarketingLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <div className="relative">
            <div className="page-noise" aria-hidden="true" />
            {children}
        </div>
    );
}