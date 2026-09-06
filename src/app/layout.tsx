import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "FacultyFlow — Make room for meaningful work",
  description:
    "Your teaching, research, and administrative tasks, thoughtfully organized.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
