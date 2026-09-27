import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Let phones on the same Wi-Fi open the dev server (QR survey demo).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.local"],
};

export default nextConfig;
