import { Suspense } from 'react';
import { PreferencesForm } from '../_components/PreferencesForm';

interface PreferencesPageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = 'force-dynamic';

async function PreferencesContent({ token }: { token: string }) {
  const apiUrl = process.env['NEXT_PUBLIC_API_URL'] || 'http://localhost:3001';

  try {
    const response = await fetch(`${apiUrl}/v1/public/preferences`, {
      headers: { 'X-Preference-Token': token },
      cache: 'no-store',
    });

    if (!response.ok) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-muted">
          <div className="text-center">
            <h1 className="text-2xl font-semibold mb-2">Preferences Unavailable</h1>
            <p className="text-muted-foreground">
              {response.status === 404 ? 'Token not found or expired' : 'Unable to load preferences'}
            </p>
          </div>
        </div>
      );
    }

    const data = await response.json();
    return <PreferencesForm initialData={data} token={token} />;
  } catch (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Error Loading Preferences</h1>
          <p className="text-muted-foreground">Please try again later</p>
        </div>
      </div>
    );
  }
}

export default async function PreferencesPage({ params }: PreferencesPageProps) {
  const { token } = await params;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-muted">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <PreferencesContent token={token} />
    </Suspense>
  );
}
