import { Badge } from "@/components/ui/badge";

const STATUS_CLASSES: Record<string, string> = {
  draft: "bg-gray-100 text-gray-900",
  active: "bg-green-100 text-green-900",
  running: "bg-green-100 text-green-900",
  paused: "bg-yellow-100 text-yellow-900",
  completed: "bg-blue-100 text-blue-900",
};

interface Props {
  status: string;
}

export function CampaignStatusBadge({ status }: Props) {
  return (
    <Badge className={STATUS_CLASSES[status] ?? "bg-gray-100 text-gray-900"}>
      {status}
    </Badge>
  );
}
