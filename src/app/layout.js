import "./globals.css";

export const metadata = {
  title: "Berlin Marathon 2026 — Training Dashboard",
  description: "Max's marathon training tracker with WHOOP data, HR zones, and race projections",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
