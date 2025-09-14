<script lang="ts">
  import type { PageData } from './$types'
  import LoginForm from '../../../lib/components/auth/LoginForm.svelte'
  import Card from '$lib/components/ui/Card.svelte'
  interface Props { data: PageData }
  let { data }: Props = $props()
</script>

<div class="min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 bg-gradient-to-br from-slate-50 to-blue-50">
  <div class="w-full max-w-md mx-auto px-4">
    <Card variant="glass" padding="p-8">
      <div class="mb-6 text-center">
        <h1 class="text-2xl font-semibold text-slate-800">Sign in</h1>
        <p class="mt-1 text-sm text-slate-500">Use your email and password or continue with Google.</p>
      </div>
      <LoginForm supabase={data.supabase} />
      <p class="mt-8 text-[11px] text-slate-400 text-center">Looking for the new experience? <a href="/signin" class="underline hover:text-slate-600">Go to unified sign-in</a>.</p>
    </Card>
  </div>
</div>
