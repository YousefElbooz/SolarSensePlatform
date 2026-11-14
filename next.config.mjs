/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'three', 'gsap'],
  },
  async redirects() {
    return [
      { source: '/panels', destination: '/', permanent: false },
      { source: '/regions', destination: '/', permanent: false },
      { source: '/report/:path*', destination: '/', permanent: false },
      { source: '/app', destination: '/', permanent: false },
      { source: '/app/:path*', destination: '/', permanent: false },
      { source: '/about', destination: '/', permanent: false },
      { source: '/login', destination: '/', permanent: false },
      { source: '/register', destination: '/', permanent: false },
    ];
  },
};

export default nextConfig;
