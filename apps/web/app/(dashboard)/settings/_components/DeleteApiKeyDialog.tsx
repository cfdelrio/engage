'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface DeleteApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyId: string;
  keyName: string;
  onConfirm?: (keyId: string) => Promise<void>;
}

export function DeleteApiKeyDialog({
  open,
  onOpenChange,
  keyId,
  keyName,
  onConfirm,
}: DeleteApiKeyDialogProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);

    try {
      await onConfirm?.(keyId);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Delete API Key</DialogTitle>
          <DialogDescription>
            This action cannot be undone
          </DialogDescription>
        </DialogHeader>

        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-destructive">⚠️ Destructive Action</p>
          <p className="text-sm text-muted-foreground mt-1">
            Deleting <code className="font-mono bg-muted px-1">{keyName}</code> will prevent any
            services using this key from accessing your API. This cannot be undone.
          </p>
        </div>

        {error && <div className="text-sm text-red-500">{error}</div>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading}
            variant="destructive"
          >
            {loading ? 'Deleting...' : 'Delete Key'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
