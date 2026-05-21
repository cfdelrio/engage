"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Mail,
  MessageSquare,
  Bell,
  Phone,
  MessageCircle,
  TrendingUp,
} from "lucide-react";

interface MetricsData {
  email: { sent: number; delivered: number; opened: number };
  sms: { sent: number; delivered: number; failed: number };
  push: { sent: number; delivered: number; opened: number };
  voice: { sent: number; answered: number; completed: number };
  whatsapp: { sent: number; delivered: number; read: number };
}

const mockMetricsData = {
  email: { sent: 2500, delivered: 2450, opened: 1225 },
  sms: { sent: 1200, delivered: 1180, failed: 20 },
  push: { sent: 3000, delivered: 2850, opened: 1710 },
  voice: { sent: 450, answered: 380, completed: 320 },
  whatsapp: { sent: 800, delivered: 750, read: 600 },
};

const mockChartData = [
  { date: "Mon", email: 320, sms: 150, push: 280, voice: 45, whatsapp: 80 },
  { date: "Tue", email: 380, sms: 180, push: 320, voice: 55, whatsapp: 95 },
  { date: "Wed", email: 350, sms: 160, push: 300, voice: 50, whatsapp: 85 },
  { date: "Thu", email: 420, sms: 200, push: 350, voice: 60, whatsapp: 110 },
  { date: "Fri", email: 480, sms: 220, push: 400, voice: 70, whatsapp: 130 },
  { date: "Sat", email: 250, sms: 100, push: 200, voice: 30, whatsapp: 50 },
  { date: "Sun", email: 200, sms: 80, push: 150, voice: 25, whatsapp: 40 },
];

export default function DashboardPage() {
  const [metrics] = useState<MetricsData>(mockMetricsData);

  useEffect(() => {
    // TODO: Fetch real metrics from API
  }, []);

  const channelStats = [
    {
      name: "Email",
      icon: Mail,
      color: "bg-blue-500",
      sent: metrics.email.sent,
      delivered: metrics.email.delivered,
      openRate: Math.round(
        (metrics.email.opened / metrics.email.delivered) * 100,
      ),
    },
    {
      name: "SMS",
      icon: MessageSquare,
      color: "bg-green-500",
      sent: metrics.sms.sent,
      delivered: metrics.sms.delivered,
      rate: Math.round((metrics.sms.delivered / metrics.sms.sent) * 100),
    },
    {
      name: "Push",
      icon: Bell,
      color: "bg-purple-500",
      sent: metrics.push.sent,
      delivered: metrics.push.delivered,
      openRate: Math.round(
        (metrics.push.opened / metrics.push.delivered) * 100,
      ),
    },
    {
      name: "Voice",
      icon: Phone,
      color: "bg-orange-500",
      sent: metrics.voice.sent,
      answered: metrics.voice.answered,
      rate: Math.round((metrics.voice.answered / metrics.voice.sent) * 100),
    },
    {
      name: "WhatsApp",
      icon: MessageCircle,
      color: "bg-emerald-500",
      sent: metrics.whatsapp.sent,
      delivered: metrics.whatsapp.delivered,
      readRate: Math.round(
        (metrics.whatsapp.read / metrics.whatsapp.delivered) * 100,
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-2">
          Overview of your engagement campaigns
        </p>
      </div>

      {/* Channel Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {channelStats.map((channel) => {
          const Icon = channel.icon;
          return (
            <Card key={channel.name} className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`${channel.color} p-3 rounded-lg text-white`}>
                  <Icon size={24} />
                </div>
                <span className="text-sm font-medium text-slate-600">
                  {channel.name}
                </span>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-2xl font-bold text-slate-900">
                    {channel.sent.toLocaleString()}
                  </p>
                  <p className="text-xs text-slate-500">Messages Sent</p>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Delivered:</span>
                  <span className="font-medium text-slate-900">
                    {channel.delivered}
                  </span>
                </div>
                {channel.openRate !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Open Rate:</span>
                    <span className="font-medium text-slate-900">
                      {channel.openRate}%
                    </span>
                  </div>
                )}
                {channel.rate !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Success Rate:</span>
                    <span className="font-medium text-slate-900">
                      {channel.rate}%
                    </span>
                  </div>
                )}
                {channel.readRate !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Read Rate:</span>
                    <span className="font-medium text-slate-900">
                      {channel.readRate}%
                    </span>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">
            Messages Sent (7 days)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="email" stroke="#3b82f6" />
              <Line type="monotone" dataKey="sms" stroke="#10b981" />
              <Line type="monotone" dataKey="push" stroke="#a855f7" />
              <Line type="monotone" dataKey="voice" stroke="#f97316" />
              <Line type="monotone" dataKey="whatsapp" stroke="#059669" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">
            Channel Distribution
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={[
                { name: "Email", value: metrics.email.sent },
                { name: "SMS", value: metrics.sms.sent },
                { name: "Push", value: metrics.push.sent },
                { name: "Voice", value: metrics.voice.sent },
                { name: "WhatsApp", value: metrics.whatsapp.sent },
              ]}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-6 flex items-center gap-2">
          <TrendingUp size={20} />
          Recent Activity
        </h2>
        <div className="space-y-4">
          {[
            {
              campaign: "Q2 Product Launch",
              type: "Email",
              status: "Active",
              count: "2,450/2,500",
            },
            {
              campaign: "Weekend Reminder",
              type: "Push",
              status: "Active",
              count: "2,850/3,000",
            },
            {
              campaign: "Support Follow-up",
              type: "Voice",
              status: "Paused",
              count: "320/450",
            },
            {
              campaign: "Promotional SMS",
              type: "SMS",
              status: "Completed",
              count: "1,180/1,200",
            },
            {
              campaign: "Customer Feedback",
              type: "WhatsApp",
              status: "Active",
              count: "600/800",
            },
          ].map((activity, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between py-3 border-b border-slate-200 last:border-0"
            >
              <div className="flex-1">
                <p className="font-medium text-slate-900">
                  {activity.campaign}
                </p>
                <p className="text-sm text-slate-500">{activity.type}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900">
                    {activity.count}
                  </p>
                  <p className="text-xs text-slate-500">{activity.status}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
