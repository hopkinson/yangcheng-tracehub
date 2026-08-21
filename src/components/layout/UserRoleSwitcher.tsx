"use client";

import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { logoutAction, switchUserAction } from "@/actions/auth";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { UserCheck, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UserOption {
  id: string;
  fullName: string;
  role: string;
  channelName?: string | null;
}

export function UserRoleSwitcher({
  users,
  currentUserId,
}: {
  users: UserOption[];
  currentUserId?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSelect(userId: string) {
    startTransition(async () => {
      await switchUserAction(userId);
      const selected = users.find((u) => u.id === userId);
      toast.success(`已切换当前登录视角为: ${selected?.fullName} (${selected?.role})`);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <UserCheck className="size-3.5 text-muted-foreground hidden sm:inline" />
      <Select value={currentUserId || ""} onValueChange={handleSelect} disabled={isPending}>
        <SelectTrigger className="h-8 text-xs w-[175px] bg-background">
          <SelectValue placeholder="切换用户角色" />
        </SelectTrigger>
        <SelectContent>
          {users.map((u) => (
            <SelectItem key={u.id} value={u.id} className="text-xs">
              {u.fullName} {u.channelName ? `[${u.channelName}]` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <form action={logoutAction}>
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          title="退出登录"
        >
          <LogOut className="size-3.5" />
        </Button>
      </form>
    </div>
  );
}
