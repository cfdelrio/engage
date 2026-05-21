export const dynamic = "force-dynamic";
import { UsersList } from "./UsersList";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Users</h1>
        <p className="text-muted-foreground mt-2">
          Engagement profiles, fatigue scores, channel preferences and delivery
          history
        </p>
      </div>

      <UsersList />
    </div>
  );
}
