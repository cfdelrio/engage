'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const TEMPLATE_VARIABLES = {
  user: {
    id: 'User ID',
    firstName: 'User first name',
    email: 'User email',
    phone: 'User phone number',
    externalId: 'External user ID',
  },
  metadata: {
    note: 'Any custom fields from user metadata',
  },
};

export function TemplateVariables() {
  return (
    <Card className="p-6 bg-slate-50">
      <h3 className="font-semibold text-slate-900 mb-4">Available Variables</h3>
      <div className="space-y-4">
        {Object.entries(TEMPLATE_VARIABLES).map(([category, vars]) => (
          <div key={category}>
            <p className="text-xs font-medium text-slate-600 uppercase mb-2">{category}</p>
            <div className="flex flex-wrap gap-2">
              {typeof vars === 'object' && !Array.isArray(vars) ? (
                Object.entries(vars).map(([key, description]) => (
                  <Badge
                    key={key}
                    className="bg-slate-200 text-slate-900 cursor-pointer hover:bg-slate-300 font-mono text-xs"
                    title={description as string}
                  >
                    {`{{${category}.${key}}}`}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-slate-600">{vars}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
