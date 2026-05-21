"use client";

import type { ReactNode } from "react";
import React, { useState } from "react";

interface TabsContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = React.createContext<TabsContextType | undefined>(undefined);

export function Tabs({
  children,
  defaultValue,
  className = "",
}: {
  children: ReactNode;
  defaultValue?: string;
  className?: string;
}) {
  const [activeTab, setActiveTab] = useState(defaultValue || "");

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex gap-2 border-b border-gray-200 ${className}`}>
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className = "",
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error("TabsTrigger must be used within Tabs");

  const { activeTab, setActiveTab } = context;
  const isActive = activeTab === value;

  return (
    <button
      onClick={() => setActiveTab(value)}
      className={`px-4 py-2 font-medium text-sm border-b-2 transition-colors ${
        isActive
          ? "border-blue-600 text-blue-600"
          : "border-transparent text-gray-600 hover:text-gray-900"
      } ${className}`}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  className = "",
}: {
  value: string;
  children: ReactNode;
  className?: string;
}) {
  const context = React.useContext(TabsContext);
  if (!context) throw new Error("TabsContent must be used within Tabs");

  const { activeTab } = context;

  if (activeTab !== value) return null;

  return <div className={className}>{children}</div>;
}
