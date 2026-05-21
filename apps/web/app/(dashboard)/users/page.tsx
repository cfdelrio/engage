export const dynamic = "force-dynamic";
import { UsersList } from "./UsersList";

export default function UsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Perfiles de engagement y fatiga
        </p>
      </div>

      <UsersList />
    </div>
  );
}
