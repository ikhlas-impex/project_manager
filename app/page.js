"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { Spinner } from "@/components/ui";

export default function Home() {
  const { session, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash && window.location.hash.includes("access_token")) {
      const targetBase = process.env.NEXT_PUBLIC_APP_URL || "https://project-manager-eight-lac.vercel.app";
      if (window.location.hostname === "localhost") {
        window.location.href = `${targetBase}/auth/confirm${window.location.hash}`;
        return;
      }
      router.replace(`/auth/confirm${window.location.hash}`);
      return;
    }

    if (!loading) router.replace(session ? "/dashboard" : "/login");
  }, [loading, session, router]);
  return (
    <div className="grid min-h-screen place-items-center">
      <Spinner />
    </div>
  );
}
