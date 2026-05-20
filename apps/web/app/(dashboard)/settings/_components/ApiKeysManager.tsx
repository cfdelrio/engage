'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ApiKeysList } from './ApiKeysList';
import { CreateApiKeyDialog } from './CreateApiKeyDialog';
import { RotateApiKeyDialog } from './RotateApiKeyDialog';
import { DeleteApiKeyDialog } from './DeleteApiKeyDialog';

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  lastUsedAt: string | null;
  createdAt: string;
  enabled: boolean;
}

interface CreatedKey extends ApiKey {
  key: string;
}

export function ApiKeysManager() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<CreatedKey | null>(null);
  const [rotateKeyId, setRotateKeyId] = useState<string | null>(null);
  const [rotateKeyName, setRotateKeyName] = useState('');
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null);
  const [deleteKeyName, setDeleteKeyName] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const fetchKeys = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/admin/api-keys');
        if (!response.ok) {
          throw new Error('Failed to fetch API keys');
        }
        const data = await response.json();
        setKeys(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchKeys();
  }, []);

  const handleCreateSuccess = (keyData: { id: string; name: string; key: string }) => {
    const createdKey: CreatedKey = {
      ...keyData,
      keyPrefix: keyData.key.substring(0, 10),
      permissions: [],
      lastUsedAt: null,
      createdAt: new Date().toISOString(),
      enabled: true,
    };
    setCreatedKey(createdKey);
    // Refetch keys after creation
    fetch('/admin/api-keys')
      .then((response) => {
        if (response.ok) {
          return response.json();
        }
      })
      .then((data) => {
        if (data) {
          setKeys(data);
        }
      })
      .catch(() => {
        // Silent fail on refetch
      });
  };

  const handleRotate = (keyId: string) => {
    const key = keys.find((k) => k.id === keyId);
    if (key) {
      setRotateKeyId(keyId);
      setRotateKeyName(key.name);
    }
  };

  const handleRotateConfirm = async (keyId: string) => {
    try {
      const response = await fetch(`/admin/api-keys/${keyId}/rotate`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to rotate API key');
      }

      const data = await response.json();
      setCreatedKey(data);
      setRotateKeyId(null);

      // Refetch keys after rotation
      const keysResponse = await fetch('/admin/api-keys');
      if (keysResponse.ok) {
        const keysData = await keysResponse.json();
        setKeys(keysData);
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('An error occurred');
    }
  };

  const handleDelete = (keyId: string) => {
    const key = keys.find((k) => k.id === keyId);
    if (key) {
      setDeleteKeyId(keyId);
      setDeleteKeyName(key.name);
    }
  };

  const handleDeleteConfirm = async (keyId: string) => {
    try {
      const response = await fetch(`/admin/api-keys/${keyId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete API key');
      }

      setDeleteKeyId(null);

      // Refetch keys after deletion
      const keysResponse = await fetch('/admin/api-keys');
      if (keysResponse.ok) {
        const keysData = await keysResponse.json();
        setKeys(keysData);
      }
    } catch (err) {
      throw err instanceof Error ? err : new Error('An error occurred');
    }
  };

  const handleCopyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {createdKey && (
        <Alert className="border-green-200 bg-green-50">
          <AlertDescription className="space-y-3">
            <p className="font-medium text-green-900">✓ API Key Created</p>
            <p className="text-sm text-green-800">
              Store this key securely. You won&apos;t be able to see it again.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={createdKey.key}
                className="font-mono text-xs bg-white border-green-200"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyKey}
                className="text-green-700 border-green-200 hover:bg-green-50"
              >
                {copied ? '✓ Copied' : 'Copy'}
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
              <CardDescription>Manage API keys for authenticating requests to our API</CardDescription>
            </div>
            <CreateApiKeyDialog onSuccess={handleCreateSuccess} />
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 p-3 rounded">
              {error}
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
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

      <RotateApiKeyDialog
        open={rotateKeyId !== null}
        onOpenChange={(open) => !open && setRotateKeyId(null)}
        keyId={rotateKeyId || ''}
        keyName={rotateKeyName}
        onConfirm={handleRotateConfirm}
      />

      <DeleteApiKeyDialog
        open={deleteKeyId !== null}
        onOpenChange={(open) => !open && setDeleteKeyId(null)}
        keyId={deleteKeyId || ''}
        keyName={deleteKeyName}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
