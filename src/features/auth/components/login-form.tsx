'use client'

import { useState, useTransition } from 'react'
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

export function LoginForm() {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  function onSubmit(values: LoginInput) {
    setServerError(null)
    const fd = new FormData()
    fd.set('email', values.email)
    fd.set('password', values.password)
    startTransition(async () => {
      const result = await login({ error: null }, fd)
      if (result?.error) setServerError(result.error)
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
        {serverError ? (
          <p className="text-destructive text-sm" role="alert">
            {serverError}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={isPending}>
          {isPending ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </Form>
  )
}
