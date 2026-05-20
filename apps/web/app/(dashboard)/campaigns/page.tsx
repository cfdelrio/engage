export const dynamic = 'force-dynamic';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Bell, MessageCircle, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CampaignsPage() {
  const campaignTypes = [
    {
      href: '/push-campaigns',
      label: 'Push Notifications',
      icon: Bell,
      description: 'Notificaciones push para apps móviles',
      color: 'bg-blue-500',
    },
    {
      href: '/whatsapp-campaigns',
      label: 'WhatsApp Campaigns',
      icon: MessageCircle,
      description: 'Mensajes de WhatsApp personalizados',
      color: 'bg-green-500',
    },
    {
      href: '/voice-campaigns',
      label: 'Voice Campaigns',
      icon: Phone,
      description: 'Llamadas telefónicas automatizadas',
      color: 'bg-orange-500',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campañas</h1>
          <p className="text-muted-foreground text-sm mt-1">Engagement orquestado multi-canal</p>
        </div>
      </div>

      {/* Campaign Types */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {campaignTypes.map(({ href, label, icon: Icon, description, color }) => (
          <Link key={href} href={href}>
            <Card className="cursor-pointer hover:shadow-lg transition-shadow h-full">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className={`${color} p-2 rounded-lg text-white`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-sm">{label}</CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">{description}</p>
                  </div>
                </div>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
