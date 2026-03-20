import {
  Intent,
  Section,
  SectionCard,
  Spinner,
} from "@blueprintjs/core";
import { useCallback, useEffect, useState } from "react";
import { usersApi } from "../../api";
import { useToaster } from "../../hooks/useToaster";
import type { Member } from "../../types";

export function UserProfile() {
  const [profile, setProfile] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showToaster } = useToaster();

  const fetchProfile = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await usersApi.getMe();
      setProfile(data);
    } catch (err: any) {
      showToaster(err.message || "Failed to fetch profile", Intent.DANGER);
    } finally {
      setIsLoading(false);
    }
  }, [showToaster]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Spinner />
        <p className="mt-4 text-gray-500 text-sm">Loading profile...</p>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <Section title="Personal Information" icon="user">
        <SectionCard className="space-y-4">
          <div className="flex items-start gap-8">
            <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 overflow-hidden shrink-0">
                {profile.picture ? (
                    <img src={profile.picture} className="w-full h-full object-cover" />
                ) : (
                    <div className="text-2xl font-black text-gray-300 uppercase">{profile.name.substring(0, 2)}</div>
                )}
            </div>
            <div className="grow grid grid-cols-2 gap-y-4 gap-x-8">
                <div>
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">Full Name</p>
                    <p className="text-sm font-medium">{profile.name}</p>
                </div>
                <div>
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">Email Address</p>
                    <p className="text-sm font-medium">{profile.email}</p>
                </div>
                <div>
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">Account Status</p>
                    <p className="text-sm capitalize text-green-600 font-bold">{profile.status}</p>
                </div>
                <div>
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">Last Login</p>
                    <p className="text-sm">{profile.last_login ? new Date(profile.last_login).toLocaleString() : "First time"}</p>
                </div>
                <div>
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">User ID</p>
                    <p className="text-xs font-mono text-gray-600">{profile.id}</p>
                </div>
            </div>
          </div>
        </SectionCard>
      </Section>
    </div>
  );
}
