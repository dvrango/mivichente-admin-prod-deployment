import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LoginForm } from './login-form'

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle>Vichente Admin</CardTitle>
          <CardDescription>Ingresa con tu cuenta de admin</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  )
}
