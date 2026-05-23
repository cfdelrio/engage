"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Key } from "lucide-react";
import { ApiKeysList } from "./ApiKeysList";
import { CreateApiKeyDialog } from "./CreateApiKeyDialog";
import { RotateApiKeyDialog } from "./RotateApiKeyDialog";
import { DeleteApiKeyDialog } from "./DeleteApiKeyDialog";
import { useApiKey } from "@/hooks/useApiKey";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface CreatedKey extends ApiKey {
  rawKey: string;
}

export function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeKeyInput, setActiveKeyInput] = useState("");
  const [activeKeySaved, setActiveKeySaved] = useState(false);

  const storedApiKey = useApiKey();

  useEffect(() => {
    setActiveKeyInput(localStorage.getItem("engage_api_key") || "");
  }, []);

  const handleSaveActiveKey = () => {
    localStorage.setItem("engage_api_key", activeKeyInput.trim());
    setActiveKeySaved(true);
    setTimeout(() => setActiveKeySaved(false), 2000);
    window.location.reload();
  };

  const [createKeyOpen, setCreateKeyOpen] = useState(false);
  const [rotateKeyId, setRotateKeyId] = useState<string | null>(null);
  const [rotateKeyName, setRotateKeyName] = useState("");
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [deleteKeyName, setDeleteKeyName] = useState("");

  const fetchKeys = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/admin/api-keys`, {
        headers: { "x-api-key": storedApiKey },
      });
      if (!res.ok) throw new Error("Failed to fetch API keys");
      setKeys(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [storedApiKey]);

  useEffect(() => {
    void fetchKeys();
  }, [fetchKeys]);

  const handleCreateSuccess = (keyData: {
    id: string;
    name: string;
    keyPrefix: string;
    permissions: string[];
    status: string;
    createdAt: string;
    rawKey: string;
  }) => {
    setCreatedKey({
      id: keyData.id,
      name: keyData.name,
      keyPrefix: keyData.keyPrefix,
      permissions: keyData.permissions,
      status: keyData.status,
      lastUsedAt: null,
      createdAt: keyData.createdAt,
      rawKey: keyData.rawKey,
    });
    fetchKeys();
  };

  const handleRotate = (keyId: string) => {
    const key = keys.find((k) => k.id === keyId);
    if (key) {
      setCreateKeyOpen(false);
      setDeleteKeyId(null);
      setRotateKeyId(keyId);
      setRotateKeyName(key.name);
    }
  };

  const handleRotateConfirm = async (keyId: string) => {
    const res = await fetch(`${API_URL}/admin/api-keys/${keyId}/rotate`, {
      method: "POST",
      headers: { "x-api-key": storedApiKey },
    });
    if (!res.ok) throw new Error("Failed to rotate API key");

    const data = await res.json();
    setCreatedKey({
      id: data.id,
      name: data.name,
      keyPrefix: data.keyPrefix,
      permissions: data.permissions ?? [],
      status: data.status,
      lastUsedAt: null,
      createdAt: data.createdAt,
      rawKey: data.rawKey,
    });
    setRotateKeyId(null);
    await fetchKeys();
  };

  const handleDelete = (keyId: string) => {
    const key = keys.find((k) => k.id === keyId);
    if (key) {
      setCreateKeyOpen(false);
      setRotateKeyId(null);
      setDeleteKeyId(keyId);
      setDeleteKeyName(key.name);
    }
  };

  const handleDeleteConfirm = async (keyId: string) => {
    const res = await fetch(`${API_URL}/admin/api-keys/${keyId}`, {
      method: "DELETE",
      headers: { "x-api-key": storedApiKey },
    });
    if (!res.ok) throw new Error("Failed to delete API key");
    setDeleteKeyId(null);
    await fetchKeys();
  };

  const handleCopyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey.rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            <CardTitle className="text-base">Active API Key</CardTitle>
          </div>
          <CardDescription>
            The API key used by this dashboard to authenticate all requests.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="oek_..."
              value={activeKeyInput}
              onChange={(e) => setActiveKeyInput(e.target.value)}
              className="font-mono text-sm"
            />
            <Button onClick={handleSaveActiveKey} className="shrink-0 gap-2">
              {activeKeySaved ? (
                <>
                  <Check className="h-4 w-4" /> Saved
                </>
              ) : (
                "Save & Reload"
              )}
            </Button>
          </div>
          {storedApiKey && (
            <p className="mt-2 text-xs text-muted-foreground">
              Active:{" "}
              <Badge variant="outline" className="font-mono text-xs">
                {storedApiKey.slice(0, 12)}…
              </Badge>
            </p>
          )}
        </CardContent>
      </Card>

      {createdKey && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="space-y-3">
            <p className="font-medium text-green-900">API Key Created</p>
            <p className="text-sm text-green-800">
              Store this key securely — you won&apos;t be able to see it again.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={createdKey.rawKey}
                className="font-mono text-xs bg-white border-green-200"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyKey}
                className="shrink-0 text-green-700 border-green-200 hover:bg-green-50"
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCreatedKey(null)}
              className="w-full"
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>API Keys</CardTitle>
              <CardDescription>
                Manage API keys for authenticating requests to your tenant
              </CardDescription>
            </div>
            <Button onClick={() => setCreateKeyOpen(true)}>
              Create API Key
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded">
              {error}
            </div>
          )}
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : (
            <ApiKeysList
              keys={keys}
              onRotate={handleRotate}
              onDelete={handleDelete}
              loading={loading}
            />
          )}
        </CardContent>
      </Card>

      <CreateApiKeyDialog
        open={createKeyOpen}
        onOpenChange={setCreateKeyOpen}
        onSuccess={handleCreateSuccess}
      />

      <RotateApiKeyDialog
        open={rotateKeyId !== null}
        onOpenChange={(open) => !open && setRotateKeyId(null)}
        keyId={rotateKeyId ?? ""}
        keyName={rotateKeyName}
        onConfirm={handleRotateConfirm}
      />

      <DeleteApiKeyDialog
        open={deleteKeyId !== null}
        onOpenChange={(open) => !open && setDeleteKeyId(null)}
        keyId={deleteKeyId ?? ""}
        keyName={deleteKeyName}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
