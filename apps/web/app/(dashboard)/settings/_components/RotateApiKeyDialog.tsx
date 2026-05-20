'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface RotateApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyId: string;
  keyName: string;
  onConfirm?: (keyId: string) => Promise<void>;
}

export function RotateApiKeyDialog({
  open,
  onOpenChange,
  keyId,
  keyName,
  onConfirm,
}: RotateApiKeyDialogProps) {
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
          <DialogTitle>Rotate API Key</DialogTitle>
          <DialogDescription>
            This action will generate a new key and disable the current one
          </DialogDescription>
        </DialogHeader>

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm font-medium text-red-900">⚠️ Warning</p>
          <p className="text-sm text-red-800 mt-1">
            Any services using <code className="font-mono bg-red-100 px-1">{keyName}</code> will
            stop working immediately after rotation. Make sure to update all references before
            proceeding.
          </p>
        </div>

        {error && <div className="text-sm text-red-500">{error}</div>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={loading} className="bg-red-600 hover:bg-red-700">
            {loading ? 'Rotating...' : 'Rotate Key'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
