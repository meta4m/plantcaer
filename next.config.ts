import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ['192.168.18.2', '192.168.1.21'],
  transpilePackages: ['@fullcalendar/react', '@fullcalendar/daygrid', '@fullcalendar/interaction', '@fullcalendar/core'],
};

export default nextConfig;
