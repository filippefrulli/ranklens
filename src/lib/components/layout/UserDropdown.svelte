<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { enhance } from "$app/forms";
  import type { Session } from "@supabase/supabase-js";

  interface Props {
    session: Session;
  }

  let { session }: Props = $props();

  let userInitials: string | null = $state(null);
  let showDropdown: boolean = $state(false);
  let isSigningOut: boolean = $state(false);

  onMount(() => {
    updateUserInitials();

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".dropdown-container")) {
        showDropdown = false;
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  });

  function updateUserInitials() {
    if (session?.user?.email) {
      userInitials = session.user.email.charAt(0).toUpperCase();
    } else if (session?.user?.user_metadata?.full_name) {
      userInitials = session.user.user_metadata.full_name
        .charAt(0)
        .toUpperCase();
    } else {
      userInitials = null;
    }
  }

  function handleSignOutSubmit() {
    isSigningOut = true;
    return async ({ update }: { update: () => Promise<void> }) => {
      try {
        await update();
        showDropdown = false;
        // The redirect will be handled by the server action
      } catch (error) {
        console.error("Error during sign out:", error);
      } finally {
        isSigningOut = false;
      }
    };
  }

  function toggleDropdown() {
    showDropdown = !showDropdown;
  }

  function navigateAndClose(path: string) {
    goto(path);
    showDropdown = false;
  }

  $effect(() => {
    updateUserInitials();
  });
</script>

{#if userInitials && session}
  <div class="relative dropdown-container">
    <button
      onclick={toggleDropdown}
      class="w-10 h-10 bg-black rounded-lg flex items-center justify-center text-white font-semibold hover:bg-gray-800 transition-colors cursor-pointer"
      title={session.user.email}
    >
      {userInitials}
    </button>

    {#if showDropdown}
      <div
        class="absolute right-0 mt-2 w-56 bg-white rounded-lg py-3 z-50 border border-gray-100 shadow-lg"
      >
        <div class="px-4 py-3 text-sm">
          <div class="font-medium text-black">
            {session.user.user_metadata?.full_name || "User"}
          </div>
          <div class="text-gray-500 truncate">{session.user.email}</div>
        </div>

        <div class="h-px bg-gray-100 my-2"></div>

        <form
          method="POST"
          action="/auth/signout"
          use:enhance={handleSignOutSubmit}
        >
          <button
            type="submit"
            disabled={isSigningOut}
            class="flex items-center w-full text-left px-4 py-3 text-sm text-black hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            <svg
              class="w-4 h-4 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013 3v1"
              />
            </svg>
            {isSigningOut ? "Signing out..." : "Sign Out"}
          </button>
        </form>
      </div>
    {/if}
  </div>
{/if}
