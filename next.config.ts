import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // El modo campo se prueba desde el celular contra el dev server de la laptop,
  // así que las requests llegan con un Origin de LAN y Next las bloquea por
  // default. Sólo aplica a `next dev` — en producción no tiene efecto.
  allowedDevOrigins: ['192.168.101.17', '100.96.221.80'],
  images: {
    dangerouslyAllowLocalIP: process.env.NODE_ENV === 'development',
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'http',
        hostname: '100.96.221.80',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
}

export default nextConfig
