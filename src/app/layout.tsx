import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Source_Sans_3 } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const barlow = Barlow_Condensed({ variable: "--font-barlow", subsets: ["latin"], weight: ["600", "700", "800"] });
const source = Source_Sans_3({ variable: "--font-source", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "LNGBA Hustle",
  description: "Hustle points for Lakeville North Girls Basketball travel teams.",
  appleWebApp: { capable: true, title: "Hustle", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#d7191f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${barlow.variable} ${source.variable} antialiased`}>
      <body className="min-h-dvh flex flex-col text-[17px] leading-normal">
        <SiteHeader />
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-5">{children}</main>
      </body>
    </html>
  );
}
