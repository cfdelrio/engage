"use client";

import { apiFetch } from "@/lib/api-client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

const PERMISSIONS = [
  { id: "events:write", label: "Send events" },
  { id: "users:read", label: "Read users" },
  { id: "users:write", label: "Write users" },
  { id: "campaigns:read", label: "Read campaigns" },
  { id: "campaigns:write", label: "Write campaigns" },
  { id: "preferences:read", label: "Read preferences" },
  { id: "preferences:write", label: "Write preferences" },
] as const;

interface CreatedKeyData {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  status: string;
  createdAt: string;
  rawKey: string;
}

interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (key: CreatedKeyData) => void;
}

export function CreateApiKeyDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateApiKeyDialogProps) {
  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };
  const [name, setName] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    setPermissions((prev) =>
      checked
        ? [...prev, permissionId]
        : prev.filter((p) => p !== permissionId),
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (permissions.length === 0) {
      setError("At least one permission is required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(`/admin/api-keys`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, permissions }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message ?? "Failed to create API key");
      }

      const data = await res.json();
      onSuccess?.({
        id: data.id,
        name: data.name,
        keyPrefix: data.keyPrefix,
        permissions: data.permissions ?? [],
        status: data.status,
        createdAt: data.createdAt,
        rawKey: data.rawKey,
      });
      handleOpenChange(false);
      setName("");
      setPermissions([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogClose onClose={() => handleOpenChange(false)} />

        <DialogHeader>
          <DialogTitle>Create API Key</DialogTitle>
          <DialogDescription>
            Create a new API key with specific permissions
          </DialogDescription>
        </DialogHeader>

        <div className="border-t border-border" />

        <div className="px-6 py-5 space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="e.g., Mobile App, Backend Service"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label>Permissions</Label>
            <div className="bg-muted/40 rounded-lg border border-border p-3 space-y-2.5">
              {PERMISSIONS.map((perm) => (
                <div key={perm.id} className="flex items-center gap-3">
                  <Checkbox
                    id={perm.id}
                    checked={permissions.includes(perm.id)}
                    onCheckedChange={(checked) =>
                      handlePermissionChange(perm.id, checked as boolean)
                    }
                    disabled={loading}
                  />
                  <label
                    htmlFor={perm.id}
                    className="text-sm text-foreground cursor-pointer select-none"
                  >
                    {perm.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </div>

        <div className="border-t border-border" />

        <div className="flex justify-end gap-2 px-6 py-4">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? "Creating..." : "Create"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
