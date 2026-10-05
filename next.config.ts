import type { NextConfig } from "next";

/* 献立・食育の写真は Supabase Storage（menu-photos バケット）に置いている。
   next/image で縮小して配信できるよう、その場所だけを許可する */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!supabaseUrl) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL が未設定です");
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      new URL("/storage/v1/object/public/menu-photos/**", supabaseUrl),
    ],
    /* Next.js 16 から必須。画質は既定の 75 だけを許可する */
    qualities: [75],
  },
};

export default nextConfig;
