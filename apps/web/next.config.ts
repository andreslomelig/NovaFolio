/** @type {import('next').NextConfig} */
const nextConfig = {
  // (Optional) proxy to avoid CORS, keep if you added it earlier
  async rewrites() {
    return [
      { source: '/backend/:path*', destination: 'http://localhost:4000/:path*' },
    ];
  },

  webpack: (config, { isServer }) => {
    // Make sure 'canvas' is never resolved/bundled
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      canvas: false,
    };

    // On the server bundle, mark it as external so webpack doesn't try to bundle it
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({ canvas: 'commonjs canvas' });
    }

    // Some pdfjs builds reference Node core modules; make sure we don't polyfill them
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      path: false,
      crypto: false,
      stream: false,
    };

    return config;
  },
};

export default nextConfig;
