"use client";

import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  permissions: string[];
  status: string;
  lastUsedAt: string | null;
  createdAt: string;
}

interface ApiKeysListProps {
  keys: ApiKey[];
  onRotate?: (keyId: string) => void;
  onDelete?: (keyId: string) => void;
  loading?: boolean;
}

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  active: "default",
  disabled: "secondary",
  revoked: "destructive",
};

export function ApiKeysList({
  keys,
  onRotate,
  onDelete,
  loading,
}: ApiKeysListProps) {
  if (keys.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No API keys yet. Create one to get started.</p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Key Prefix</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Last Used</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {keys.map((key) => (
            <TableRow key={key.id}>
              <TableCell className="font-medium">{key.name}</TableCell>
              <TableCell>
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {key.keyPrefix}...
                </code>
              </TableCell>
              <TableCell>
                <Badge
                  variant={STATUS_VARIANTS[key.status] ?? "outline"}
                  className="capitalize"
                >
                  {key.status}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {key.lastUsedAt
                  ? formatDistanceToNow(new Date(key.lastUsedAt), {
                      addSuffix: true,
                    })
                  : "Never"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(key.createdAt), {
                  addSuffix: true,
                })}
              </TableCell>
              <TableCell>
                <div className="flex gap-2">
                  {key.status === "active" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRotate?.(key.id)}
                      disabled={loading}
                    >
                      Rotate
                    </Button>
                  )}
                  {key.status !== "revoked" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete?.(key.id)}
                      disabled={loading}
                      className="text-destructive hover:text-destructive"
                    >
                      Revoke
                    </Button>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
