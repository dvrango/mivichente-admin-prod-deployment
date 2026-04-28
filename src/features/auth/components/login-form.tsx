'use client'

import { useActionState, useTransition, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { login } from '../actions'
import { loginSchema, type LoginInput } from '../schema'

const DEV_KEY = 'dev_quick_login'

function DevQuickLogin({
  onQuickLogin,
  onSave,
}: {
  onQuickLogin: (email: string, password: string) => void
  onSave: () => { email: string; password: string }
}) {
  const [saved, setSaved] = useState<{ email: string; password: string } | null>(() => {
    if (typeof window === 'undefined') return null
    const raw = localStorage.getItem(DEV_KEY)
    return raw ? JSON.parse(raw) : null
  })

  if (process.env.NODE_ENV !== 'development') return null

  return (
    <div className="border-dashed border rounded-md p-3 space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Dev</p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1 text-xs"
          disabled={!saved}
          onClick={() => saved && onQuickLogin(saved.email, saved.password)}
        >
          {saved ? `Entrar como ${saved.email}` : 'Sin credenciales guardadas'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={() => setSaved(onSave())}
        >
          Guardar
        </Button>
      </div>
    </div>
  )
}

export function LoginForm() {
  const [state, formAction] = useActionState(login, { error: null })
  const [isPending, startTransition] = useTransition()

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  function submitFormData(fd: FormData) {
    startTransition(() => formAction(fd))
  }

  function onSubmit(values: LoginInput) {
    const fd = new FormData()
    fd.set('email', values.email)
    fd.set('password', values.password)
    submitFormData(fd)
  }

  function handleQuickLogin(email: string, password: string) {
    form.setValue('email', email)
    form.setValue('password', password)
    const fd = new FormData()
    fd.set('email', email)
    fd.set('password', password)
    submitFormData(fd)
  }

  function handleSaveCredentials() {
    const { email, password } = form.getValues()
    const creds = { email, password }
    localStorage.setItem(DEV_KEY, JSON.stringify(creds))
    return creds
  }

  return (
    <Form {...form}>
      <form action={formAction} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="email" disabled={isPending} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contraseña</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="current-password"
                  disabled={isPending}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {state?.error ? (
          <p className="text-destructive text-sm" role="alert">
            {state.error}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Entrando…' : 'Entrar'}
        </Button>
        <DevQuickLogin onQuickLogin={handleQuickLogin} onSave={handleSaveCredentials} />
      </form>
    </Form>
  )
}
