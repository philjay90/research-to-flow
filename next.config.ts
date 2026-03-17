import type { NextConfig } from "next";

const securityHeaders = [
  // Prevent browsers from guessing MIME types (reduces drive-by download risk)
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Deny framing entirely — prevents clickjacking
  { key: 'X-Frame-Options', value: 'DENY' },
  // Force HTTPS for 2 years, including subdomains
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  // Don't send the full URL as a referrer to external sites
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Disable features the app doesn't need
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // Enable XSS filter in older browsers
  { key: 'X-XSS-Protection', value: '1; mode=block' },
]

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig;
