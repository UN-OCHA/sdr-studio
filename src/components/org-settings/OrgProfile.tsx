import {
  Button,
  Callout,
  Intent,
  Section,
  SectionCard,
  Spinner,
} from "@blueprintjs/core";
import { useCallback, useEffect, useState } from "react";
import { orgsApi } from "../../api";
import { useToaster } from "../../hooks/useToaster";
import type { Organization } from "../../types";

export function OrgProfile() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { showToaster } = useToaster();

  const fetchOrg = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await orgsApi.getCurrent();
      setOrg(data);
    } catch (err: any) {
      showToaster(err.message || "Failed to fetch organization details", Intent.DANGER);
    } finally {
      setIsLoading(false);
    }
  }, [showToaster]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Spinner />
        <p className="mt-4 text-gray-500 text-sm">Loading organization profile...</p>
      </div>
    );
  }

  if (!org) return null;

  return (
    <div className="space-y-6">
      <Section title="General Information" icon="info-sign">
        <SectionCard className="space-y-4">
          <div className="flex items-start gap-8">
            <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-200 overflow-hidden shrink-0">
                {org.logo_url ? (
                    <img src={org.logo_url} className="w-full h-full object-contain" />
                ) : (
                    <div className="text-2xl font-black text-gray-300 uppercase">{org.name.substring(0, 2)}</div>
                )}
            </div>
            <div className="grow grid grid-cols-2 gap-y-4 gap-x-8">
                <div>
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">Organization Name</p>
                    <p className="text-sm font-medium">{org.display_name}</p>
                </div>
                <div>
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">Organization ID</p>
                    <p className="text-xs font-mono text-gray-600">{org.id}</p>
                </div>
                <div>
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-0.5">Created At</p>
                    <p className="text-sm">{new Date(org.created_at).toLocaleDateString()}</p>
                </div>
            </div>
          </div>
        </SectionCard>
      </Section>

      <Section title="Danger Zone" icon="warning-sign">
        <SectionCard>
            <Callout intent={Intent.DANGER} title="Leave Organization">
                <p className="text-xs mb-3">Leaving this organization will immediately revoke your access to all shared projects and data.</p>
                <Button intent={Intent.DANGER} text="Leave Organization" disabled />
            </Callout>
        </SectionCard>
      </Section>
    </div>
  );
}
