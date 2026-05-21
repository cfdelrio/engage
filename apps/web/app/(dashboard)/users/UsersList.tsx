"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Search } from "lucide-react";
import { useApiKey } from "@/hooks/useApiKey";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

interface User {
  id: string;
  externalId: string;
  email: string | null;
  phone: string | null;
  timezone: string;
  locale: string;
  tags: string[];
  createdAt: string;
}

interface UsersResponse {
  users: User[];
  nextCursor: string | null;
  hasMore: boolean;
}

export function UsersList() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const apiKey = useApiKey();

  useEffect(() => {
    const handler = setTimeout(() => setSearchTerm(search), 250);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    if (!apiKey) return;
    const params = new URLSearchParams({ limit: "50" });
    if (searchTerm) params.set("externalId", searchTerm);

    let cancelled = false;
    setLoading(true);
    fetch(`${API_URL}/v1/users?${params.toString()}`, {
      headers: { "x-api-key": apiKey },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: UsersResponse | null) => {
        if (cancelled) return;
        if (data) {
          setUsers(data.users);
          setNextCursor(data.nextCursor);
          setHasMore(data.hasMore);
        } else {
          setUsers([]);
          setNextCursor(null);
          setHasMore(false);
        }
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [searchTerm, apiKey]);

  const loadMore = async () => {
    if (!nextCursor || !apiKey) return;
    const params = new URLSearchParams({ limit: "50", cursor: nextCursor });
    if (searchTerm) params.set("externalId", searchTerm);
    try {
      const res = await fetch(`${API_URL}/v1/users?${params.toString()}`, {
        headers: { "x-api-key": apiKey },
      });
      if (!res.ok) return;
      const data = (await res.json()) as UsersResponse;
      setUsers((prev) => [...prev, ...data.users]);
      setNextCursor(data.nextCursor);
      setHasMore(data.hasMore);
    } catch {
      // ignore
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between gap-4">
          <span>Users</span>
          <div className="relative w-72 max-w-full">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by externalId..."
              className="pl-8 h-8 text-sm"
            />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && users.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            {searchTerm ? "No results" : "No users yet"}
          </p>
        ) : (
          <>
            <div className="divide-y">
              {users.map((user) => (
                <Link
                  key={user.id}
                  href={`/users/${user.id}`}
                  className="flex items-center gap-4 py-3 hover:bg-muted/30 rounded-md px-2 -mx-2 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-sm truncate">
                      {user.externalId}
                    </p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {user.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </span>
                      )}
                      {user.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {user.phone}
                        </span>
                      )}
                      <span>{user.timezone}</span>
                    </div>
                  </div>
                  {user.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap justify-end max-w-[200px]">
                      {user.tags.slice(0, 3).map((tag) => (
                        <Badge
                          key={tag}
                          variant="secondary"
                          className="text-xs"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {user.tags.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{user.tags.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </Link>
              ))}
            </div>
            {hasMore && (
              <div className="pt-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadMore}
                  disabled={loading}
                >
                  Load more
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
