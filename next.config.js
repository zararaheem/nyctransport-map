/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Mapbox GL needs transpiling in some Next.js versions
  transpilePackages: ["mapbox-gl"],
};

module.exports = nextConfig;
