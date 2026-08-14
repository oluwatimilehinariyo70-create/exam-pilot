import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Exam Pilot | BOUESTI",
    template: "%s | Exam Pilot",
  },
  description: "Computerized examination timetable management for BOUESTI.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
