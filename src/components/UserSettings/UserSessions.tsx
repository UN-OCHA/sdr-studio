import {
  Button,
  Callout,
  HTMLTable,
  Intent,
  NonIdealState,
  Section,
  SectionCard,
  Spinner,
  Tag,
  Tooltip,
} from "@blueprintjs/core";
import { useCallback, useEffect, useState } from "react";
import { usersApi } from "../../api";
import { useToaster } from "../../hooks/useToaster";

interface SessionInfo {
  id: string;
  device: string;
  location: string;
  last_active: string;
  current: boolean;
}

export function UserSessions() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { showToaster } = useToaster();

  const fetchSessions = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await usersApi.listSessions();
      setSessions(data);
    } catch (err: any) {
      showToaster(err.message || "Failed to fetch sessions", Intent.DANGER);
    } finally {
      setIsLoading(false);
    }
  }, [showToaster]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleRevoke = async (sessionId: string) => {
    if (!confirm("Are you sure you want to end this session? You will be logged out on that device.")) return;
    try {
      await usersApi.revokeSession(sessionId);
      showToaster("Session revoked successfully", Intent.SUCCESS);
      fetchSessions();
    } catch (err: any) {
      showToaster(err.message || "Failed to revoke session", Intent.DANGER);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Spinner />
        <p className="mt-4 text-gray-500 text-sm">Loading active sessions...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Callout intent={Intent.PRIMARY} icon="info-sign" title="Security Information">
        These are the devices that are currently logged into your OCHA account. 
        If you see a device you don't recognize, revoke the session and change your password immediately.
      </Callout>

      <Section title="Active Device Sessions" icon="mobile-phone">
        {sessions.length === 0 ? (
            <SectionCard>
                <NonIdealState
                    icon="shield"
                    title="No Other Active Sessions"
                    description="This device is currently the only one logged into your account."
                />
            </SectionCard>
        ) : (
            <SectionCard padded={false}>
                <HTMLTable striped interactive className="w-full">
                    <thead>
                    <tr>
                        <th>Device</th>
                        <th>Location / IP</th>
                        <th>Last Active</th>
                        <th className="text-right">Actions</th>
                    </tr>
                    </thead>
                    <tbody>
                    {sessions.map((s) => (
                        <tr key={s.id}>
                        <td>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-sm">{s.device}</span>
                                {s.current && <Tag intent={Intent.SUCCESS} minimal round>This Device</Tag>}
                            </div>
                        </td>
                        <td className="text-xs">{s.location}</td>
                        <td className="text-xs text-gray-500">
                            {new Date(s.last_active).toLocaleString()}
                        </td>
                        <td className="text-right">
                            {!s.current && (
                                <Tooltip content="End Session" intent={Intent.DANGER}>
                                    <Button
                                        minimal
                                        small
                                        intent={Intent.DANGER}
                                        icon="log-out"
                                        onClick={() => handleRevoke(s.id)}
                                    />
                                </Tooltip>
                            )}
                        </td>
                        </tr>
                    ))}
                    </tbody>
                </HTMLTable>
            </SectionCard>
        )}
      </Section>
    </div>
  );
}
