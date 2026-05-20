export const dynamic = 'force-dynamic';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Megaphone, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CampaignsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Campañas</h1>
          <p className="text-muted-foreground text-sm mt-1">Engagement orquestado multi-canal</p>
        </div>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Nueva campaña
        </Button>
      </div>

      <div className="grid gap-4">
        {[
          { name: 'Reactivación de usuarios', type: 'voice', status: 'active', users: 1240, sent: 980 },
          { name: 'Top 3 semanal', type: 'push + email', status: 'active', users: 450, sent: 450 },
          { name: 'Recordatorio de pago', type: 'email + sms', status: 'draft', users: 320, sent: 0 },
        ].map((campaign) => (
          <Card key={campaign.name}>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Megaphone className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{campaign.name}</p>
                <p className="text-xs text-muted-foreground">{campaign.type}</p>
              </div>
              <div className="text-right">
                <p className="text-sm">{campaign.sent.toLocaleString()} / {campaign.users.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">enviados / alcance</p>
              </div>
              <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                {campaign.status}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
