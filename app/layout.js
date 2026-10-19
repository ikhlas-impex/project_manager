import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { ToastProvider } from "@/components/Toast";

const font = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans" });

export const metadata = {
  title: "TeamFlow — Projects & Daily Updates",
  description: "Assign tasks, track waiting time, auto-generate daily updates and AI reports.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={font.variable}>
      <body className="font-sans">
        <div className="orbs" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <ToastProvider>
          <AuthProvider>{children}</AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
