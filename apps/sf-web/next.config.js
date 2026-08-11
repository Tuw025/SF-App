/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    cpus: 1,
    workerThreads: false
  },
  serverExternalPackages: ['anki-apkg-export'],
};

export default nextConfig;
