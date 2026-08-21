import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex size-11 items-center justify-center rounded-xl bg-foreground text-background text-base font-black shadow-sm tracking-tighter">
            YC
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            阳澄大闸蟹溯源品控系统
          </h1>
          <p className="text-xs text-muted-foreground">
            阳澄股份 × 山姆会员商店全链路数量闭环合规平台
          </p>
        </div>

        {/* Login Form Card */}
        <Card className="border-border/80 shadow-md">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-semibold">账号登录</CardTitle>
            <CardDescription className="text-xs">
              输入内部工号或审计专员账号进入系统
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm initialError={params?.error} initialRedirect={params?.redirect} />
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
