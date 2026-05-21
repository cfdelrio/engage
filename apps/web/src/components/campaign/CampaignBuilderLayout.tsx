"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, Save, X } from "lucide-react";

interface CampaignBuilderLayoutProps {
  title: string;
  children: React.ReactNode;
  onSave?: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
  errors?: string[];
}

export function CampaignBuilderLayout({
  title,
  children,
  onSave,
  onCancel,
  isLoading,
  errors = [],
}: CampaignBuilderLayoutProps) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">{title}</h1>
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            <X size={20} />
            Cancel
          </Button>
        )}
      </div>

      {errors.length > 0 && (
        <Card className="border-red-200 bg-red-50 p-4">
          <div className="flex gap-3">
            <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
            <div>
              <h3 className="font-medium text-red-900">Errors</h3>
              <ul className="mt-2 space-y-1 text-sm text-red-800">
                {errors.map((error, idx) => (
                  <li key={idx}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">{children}</div>

        {onSave && (
          <div className="lg:col-span-1 h-fit sticky top-8">
            <Card className="p-6 space-y-4">
              <h2 className="font-semibold text-slate-900">Campaign Summary</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Status</span>
                  <span className="font-medium text-slate-900">Draft</span>
                </div>
                <div className="border-t border-slate-200 pt-3 flex justify-between">
                  <span className="text-slate-600">Type</span>
                  <span className="font-medium text-slate-900 capitalize">
                    {title.split(" ")[0]?.toLowerCase()}
                  </span>
                </div>
              </div>
              <Button
                className="w-full gap-2"
                onClick={onSave}
                disabled={isLoading}
              >
                <Save size={20} />
                {isLoading ? "Saving..." : "Create Campaign"}
              </Button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
