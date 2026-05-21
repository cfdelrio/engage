import { Suspense } from "react";
import {
  PreferencesForm,
  type PublicPreferencesResponse,
} from "../_components/PreferencesForm";

interface PreferencesPageProps {
  params: Promise<{ token: string }>;
}

export const dynamic = "force-dynamic";

function ErrorUI({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted">
      <div className="text-center">
        <h1 className="text-2xl font-semibold mb-2">{title}</h1>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

async function PreferencesContent({ token }: { token: string }) {
  const apiUrl = process.env["NEXT_PUBLIC_API_URL"] || "http://localhost:3001";

  let errorTitle: string | null = null;
  let errorMessage: string | null = null;
  let data: unknown = null;

  try {
    const response = await fetch(`${apiUrl}/v1/public/preferences`, {
      headers: { "X-Preference-Token": token },
      cache: "no-store",
    });

    if (!response.ok) {
      errorTitle = "Preferences Unavailable";
      errorMessage =
        response.status === 404
          ? "Token not found or expired"
          : "Unable to load preferences";
    } else {
      data = await response.json();
    }
  } catch {
    errorTitle = "Error Loading Preferences";
    errorMessage = "Please try again later";
  }

  if (errorTitle && errorMessage) {
    return <ErrorUI title={errorTitle} message={errorMessage} />;
  }

  return (
    <PreferencesForm
      initialData={data as PublicPreferencesResponse}
      token={token}
    />
  );
}

export default async function PreferencesPage({
  params,
}: PreferencesPageProps) {
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
