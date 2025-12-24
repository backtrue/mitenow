import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Privacy Policy - mite.now',
    description: 'Privacy Policy for mite.now',
};

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-900">
            <header className="bg-white dark:bg-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <Link href="/" className="text-xl font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
                        mite.now
                    </Link>
                </div>
            </header>

            <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
                <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-8">
                    Privacy Policy
                </h1>

                <div className="prose prose-zinc dark:prose-invert max-w-none">
                    <p className="text-zinc-600 dark:text-zinc-300 mb-6">
                        Last updated: December 24, 2024
                    </p>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                            1. Information We Collect
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                            When you use mite.now, we collect:
                        </p>
                        <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-300 space-y-2">
                            <li>Google account information (email, name, profile picture) when you sign in</li>
                            <li>Application files you upload for deployment</li>
                            <li>Usage data and analytics</li>
                            <li>Payment information processed through Stripe</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                            2. How We Use Your Information
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                            We use collected information to:
                        </p>
                        <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-300 space-y-2">
                            <li>Provide and maintain the Service</li>
                            <li>Process your deployments</li>
                            <li>Send important updates about your account</li>
                            <li>Improve our services</li>
                            <li>Prevent fraud and abuse</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                            3. Data Storage and Security
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-300">
                            Your data is stored securely using Cloudflare's infrastructure (R2, D1, KV) and
                            Google Cloud Platform. We implement industry-standard security measures including
                            encryption in transit and at rest.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                            4. Data Retention
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-300">
                            Free tier deployments are automatically deleted after 72 hours. Pro tier deployments
                            are retained until you delete them. Account data is retained while your account is active.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                            5. Third-Party Services
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                            We use the following third-party services:
                        </p>
                        <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-300 space-y-2">
                            <li>Google OAuth for authentication</li>
                            <li>Stripe for payment processing</li>
                            <li>Cloudflare for hosting and CDN</li>
                            <li>Google Cloud Platform for application deployment</li>
                            <li>Sentry for error tracking</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                            6. Your Rights
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                            You have the right to:
                        </p>
                        <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-300 space-y-2">
                            <li>Access your personal data</li>
                            <li>Request data deletion</li>
                            <li>Export your data</li>
                            <li>Opt out of marketing communications</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                            7. Cookies
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-300">
                            We use essential cookies for authentication and session management.
                            We do not use third-party tracking cookies.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                            8. Changes to This Policy
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-300">
                            We may update this Privacy Policy from time to time. We will notify you of any
                            significant changes by email or through the Service.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                            9. Contact Us
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-300">
                            For privacy-related questions, please contact us at privacy@mite.now.
                        </p>
                    </section>
                </div>

                <div className="mt-12 pt-8 border-t border-zinc-200 dark:border-zinc-700">
                    <Link href="/" className="text-violet-600 hover:text-violet-700 font-medium">
                        ← Back to Home
                    </Link>
                </div>
            </main>
        </div>
    );
}
