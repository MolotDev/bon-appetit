import type { Session } from "@supabase/supabase-js";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { usernameToEmail } from "@/constants/auth";
import { dictionary } from "@/constants/dictionary";
import { completePasswordChange, getOwnProfile } from "@/services/api";
import { getSupabaseClient } from "@/services/supabase";
import { useOrderCacheStore } from "@/stores/orderCacheStore";
import type { Profile } from "@/types";

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  isInitializing: boolean;
  initialize: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (newPassword: string) => Promise<void>;
};

async function loadProfileOrThrow(): Promise<Profile> {
  const profile = await getOwnProfile();
  if (profile.is_blocked) {
    await getSupabaseClient().auth.signOut();
    throw new Error(dictionary.login.blocked);
  }
  return profile;
}

function waitForPersistHydration(): Promise<void> {
  if (useAuthStore.persist.hasHydrated()) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
    if (useAuthStore.persist.hasHydrated()) {
      unsub();
      resolve();
    }
  });
}

let authListenerBound = false;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      profile: null,
      isInitializing: true,

      initialize: async () => {
        await waitForPersistHydration();
        try {
          const client = getSupabaseClient();
          const { data } = await client.auth.getSession();
          let profile: Profile | null = null;
          if (data.session) {
            try {
              profile = await loadProfileOrThrow();
            } catch (error) {
              const cached = get().profile;
              const sameUser = cached?.id === data.session.user.id;
              if (error instanceof Error && error.message === dictionary.login.blocked) {
                profile = null;
              } else if (sameUser && cached && !cached.is_blocked) {
                profile = cached;
              } else {
                profile = null;
                await client.auth.signOut();
              }
            }
          }
          set({
            session: data.session,
            profile,
            isInitializing: false,
          });

          if (!authListenerBound) {
            authListenerBound = true;
            client.auth.onAuthStateChange((_event, session) => {
              void (async () => {
                if (!session) {
                  set({ session: null, profile: null });
                  return;
                }
                try {
                  const nextProfile = await loadProfileOrThrow();
                  set({ session, profile: nextProfile });
                } catch (error) {
                  const cached = get().profile;
                  if (error instanceof Error && error.message === dictionary.login.blocked) {
                    set({ session: null, profile: null });
                    return;
                  }
                  if (cached && cached.id === session.user.id && !cached.is_blocked) {
                    set({ session, profile: cached });
                    return;
                  }
                  set({ session: null, profile: null });
                }
              })();
            });
          }
        } catch {
          set({ session: null, profile: get().profile, isInitializing: false });
        }
      },

      login: async (username, password) => {
        const client = getSupabaseClient();
        const { data, error } = await client.auth.signInWithPassword({
          email: usernameToEmail(username),
          password,
        });
        if (error || !data.session) {
          throw new Error(dictionary.login.invalidCredentials);
        }
        const profile = await loadProfileOrThrow();
        set({ session: data.session, profile });
      },

      logout: async () => {
        await getSupabaseClient().auth.signOut();
        useOrderCacheStore.getState().clear();
        set({ session: null, profile: null });
      },

      changePassword: async (newPassword) => {
        const client = getSupabaseClient();
        const { error } = await client.auth.updateUser({ password: newPassword });
        if (error) {
          throw new Error(error.message);
        }
        await completePasswordChange(client);
        const profile = await loadProfileOrThrow();
        set({ profile });
      },
    }),
    {
      name: "bon-appetit-auth",
      partialize: (state) => ({ profile: state.profile }),
    },
  ),
);
