import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
    title: 'Terms of Service - mite.now',
    description: 'Terms of Service for mite.now',
};

export default function TermsPage() {
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
                    Terms of Service
                </h1>

                <div className="prose prose-zinc dark:prose-invert max-w-none">
                    <p className="text-zinc-600 dark:text-zinc-300 mb-6">
                        Last updated: December 24, 2024
                    </p>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                            1. Acceptance of Terms
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-300">
                            By accessing or using mite.now ("Service"), you agree to be bound by these Terms of Service.
                            If you disagree with any part of the terms, you may not access the Service.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                            2. Description of Service
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-300">
                            mite.now is a platform that allows users to deploy AI applications created with Google AI Studio
                            to custom subdomains. The Service includes hosting, deployment, and management of web applications.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                            3. User Accounts
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-300">
                            You are responsible for maintaining the security of your account and any activity that occurs under your account.
                            You must notify us immediately of any unauthorized use of your account.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                            4. Acceptable Use
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-300 mb-4">
                            You agree not to use the Service to:
                        </p>
                        <ul className="list-disc list-inside text-zinc-600 dark:text-zinc-300 space-y-2">
                            <li>Upload malicious code or content</li>
                            <li>Violate any applicable laws or regulations</li>
                            <li>Infringe on intellectual property rights</li>
                            <li>Distribute spam or harmful content</li>
                            <li>Attempt to gain unauthorized access to systems</li>
                        </ul>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                            5. Subscription and Billing
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-300">
                            Free tier deployments expire after 72 hours. Pro subscriptions are billed monthly and
                            provide extended features. Refunds are handled on a case-by-case basis.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                            6. Limitation of Liability
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-300">
                            The Service is provided "as is" without warranties of any kind. We are not liable for any
                            indirect, incidental, or consequential damages arising from your use of the Service.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                            7. Changes to Terms
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-300">
                            We reserve the right to modify these terms at any time. Continued use of the Service after
                            changes constitutes acceptance of the new terms.
                        </p>
                    </section>

                    <section className="mb-8">
                        <h2 className="text-xl font-semibold text-zinc-900 dark:text-white mb-4">
                            8. Contact
                        </h2>
                        <p className="text-zinc-600 dark:text-zinc-300">
                            For questions about these Terms, please contact us at support@mite.now.
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
