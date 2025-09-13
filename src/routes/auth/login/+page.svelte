<script lang="ts">
  import type { PageData } from './$types'
  import LoginForm from '../../../lib/components/auth/LoginForm.svelte'

  interface Props {
    data: PageData
  }

  let { data }: Props = $props()
</script>

<LoginForm supabase={data.supabase} />
