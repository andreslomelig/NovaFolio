/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,      // evitar que pdf.js pida el paquete 'canvas' de Node
    };
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false, path: false, crypto: false, stream: false,
    };
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({ canvas: 'commonjs canvas' });
    }
    return config;
  },
  // (opcional) silenciar el warning de dev-origins que viste:
  // allowedDevOrigins: ['http://192.168.100.57:3000'],
};

export default nextConfig;
