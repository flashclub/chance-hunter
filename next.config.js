const createNextIntlPlugin = require('next-intl/plugin');

const withNextIntl = createNextIntlPlugin();
/** @type {import('next').NextConfig} */
const nextConfig = {

    // 图片优化配置
    images: {
        unoptimized: true,
        domains: ['img.youtube.com', 'i.ytimg.com'],
        remotePatterns: [
            {
                protocol: 'http',
                hostname: 'localhost'
            },
            {
                protocol: 'https',
                hostname: '**'
            },
            {
                protocol: 'http',
                hostname: '**'
            },
            {
                protocol: 'http',
                hostname: '**.**'
            },
            {
                protocol: 'https',
                hostname: '**.**'
            }
        ]
    }
}

module.exports = withNextIntl(nextConfig);
