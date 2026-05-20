export const QUEUES = {
  EVENTS_INCOMING: 'events.incoming',
  DELIVERIES_SCHEDULED: 'deliveries.scheduled',
  DELIVERIES_EMAIL: 'deliveries.email',
  DELIVERIES_SMS: 'deliveries.sms',
  DELIVERIES_PUSH: 'deliveries.push',
  DELIVERIES_WHATSAPP: 'deliveries.whatsapp',
  DELIVERIES_VOICE: 'deliveries.voice',
  ANALYTICS_SCORE_RECALC: 'analytics.score_recalc',
} as const;

export type QueueName = typeof QUEUES[keyof typeof QUEUES];
