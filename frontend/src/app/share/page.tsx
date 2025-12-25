import { SharePageClient } from '@/components/SharePageClient';
import { Suspense } from 'react';

export default function SharePage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gradient-to-b from-orange-50 via-white to-blue-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 flex items-center justify-center"><div className="w-8 h-8 animate-spin border-4 border-orange-500 border-t-transparent rounded-full"></div></div>}>
            <SharePageClient />
        </Suspense>
    );
}
