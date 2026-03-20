import {
  Button,
  Dialog,
  EntityTitle,
  FormGroup,
  HTMLTable,
  H3,
  H5,
  InputGroup,
  Intent,
  Section,
  SectionCard,
  Spinner,
  Tab,
  Tabs,
  Tag,
  Tooltip,
} from "@blueprintjs/core";
import { useCallback, useEffect, useState } from "react";
import { orgsApi } from "../../api";
import { useToaster } from "../../hooks/useToaster";
import type { Member, Invitation } from "../../types";

interface MemberManagerProps {
  title: string;
  subtitle: string;
}

export function MemberManager({ title, subtitle }: MemberManagerProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [isInviting, setIsInviting] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "pending">("active");
  const { showToaster } = useToaster();

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [membersData, invitesData] = await Promise.all([
        orgsApi.listMembers(),
        orgsApi.listInvitations(),
      ]);
      setMembers(membersData);
      setInvitations(invitesData);
    } catch (err: any) {
      showToaster(err.message || "Failed to fetch team data", Intent.DANGER);
    } finally {
      setIsLoading(false);
    }
  }, [showToaster]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleInvite = async () => {
    if (!inviteEmail) return;
    setIsInviting(true);
    try {
      await orgsApi.inviteMember(inviteEmail);
      showToaster(`Invitation sent to ${inviteEmail}`, Intent.SUCCESS);
      setIsInviteOpen(false);
      setInviteEmail("");
      fetchData();
    } catch (err: any) {
      showToaster(err.message || "Failed to send invitation", Intent.DANGER);
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    try {
      await orgsApi.removeMember(memberId);
      showToaster("Member removed successfully", Intent.SUCCESS);
      fetchData();
    } catch (err: any) {
      showToaster(err.message || "Failed to remove member", Intent.DANGER);
    }
  };

  const handleResend = async (inviteId: string) => {
    try {
        await orgsApi.resendInvitation(inviteId);
        showToaster("Invitation resent successfully", Intent.SUCCESS);
        fetchData();
    } catch (err: any) {
        showToaster(err.message || "Failed to resend invitation", Intent.DANGER);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    if (!confirm("Are you sure you want to revoke this invitation?")) return;
    try {
        await orgsApi.revokeInvitation(inviteId);
        showToaster("Invitation revoked successfully", Intent.SUCCESS);
        fetchData();
    } catch (err: any) {
        showToaster(err.message || "Failed to revoke invitation", Intent.DANGER);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Spinner />
        <p className="mt-4 text-gray-500 text-sm">Loading team members...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <EntityTitle title={title} subtitle={subtitle} heading={H5} />
        <Button
          intent={Intent.PRIMARY}
          icon="plus"
          text="Invite Member"
          onClick={() => setIsInviteOpen(true)}
        />
      </div>

      <Tabs
        id="MemberTabs"
        selectedTabId={activeTab}
        onChange={(id) => setActiveTab(id as any)}
        className="mb-4"
      >
        <Tab id="active" title="Active Members" icon="people" tagContent={members.length} />
        <Tab id="pending" title="Pending Invitations" icon="envelope" tagContent={invitations.length} />
      </Tabs>

      {activeTab === "active" ? (
        <SectionCard padded={false}>
          <HTMLTable striped interactive className="w-full">
            <thead>
              <tr>
                <th>Member</th>
                <th>Email</th>
                <th>Last Login</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <EntityTitle
                      icon="user"
                      title={m.name}
                      subtitle="Active Member"
                    />
                  </td>
                  <td className="text-xs">{m.email}</td>
                  <td className="text-xs text-gray-500">
                    {m.last_login ? new Date(m.last_login).toLocaleString() : "Never"}
                  </td>
                  <td className="text-right">
                    <Tooltip content="Remove Member" intent={Intent.DANGER}>
                        <Button
                            minimal
                            small
                            intent={Intent.DANGER}
                            icon="trash"
                            onClick={() => handleRemove(m.id)}
                        />
                    </Tooltip>
                  </td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        </SectionCard>
      ) : (
        <SectionCard padded={false}>
          <HTMLTable striped interactive className="w-full">
            <thead>
              <tr>
                <th>Invitee</th>
                <th>Invited By</th>
                <th>Expires At</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invitations.map((i) => (
                <tr key={i.id}>
                  <td>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{i.email}</span>
                        {new Date(i.expires_at) < new Date() && (
                            <Tag intent={Intent.DANGER} minimal round>Expired</Tag>
                        )}
                    </div>
                  </td>
                  <td className="text-xs">{i.inviter_name}</td>
                  <td className="text-xs text-gray-500">
                    {new Date(i.expires_at).toLocaleDateString()}
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                        <Tooltip content="Resend Invitation">
                            <Button
                                minimal
                                small
                                intent={Intent.PRIMARY}
                                icon="repeat"
                                onClick={() => handleResend(i.id)}
                            />
                        </Tooltip>
                        <Tooltip content="Revoke Invitation" intent={Intent.DANGER}>
                            <Button
                                minimal
                                small
                                intent={Intent.DANGER}
                                icon="cross"
                                onClick={() => handleRevoke(i.id)}
                            />
                        </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
              {invitations.length === 0 && (
                <tr>
                    <td colSpan={4} className="text-center p-8 text-gray-500 italic">
                        No pending invitations.
                    </td>
                </tr>
              )}
            </tbody>
          </HTMLTable>
        </SectionCard>
      )}

      <Dialog
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title="Invite Team Member"
        icon="plus"
      >
        <div className="p-6 space-y-4">
          <FormGroup
            label="Email Address"
            helperText="An invitation will be sent to this email address."
          >
            <InputGroup
              placeholder="user@ocha.org"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
            />
          </FormGroup>
          <div className="flex justify-end gap-2 pt-4">
            <Button text="Cancel" onClick={() => setIsInviteOpen(false)} />
            <Button
              intent={Intent.PRIMARY}
              text="Send Invitation"
              loading={isInviting}
              onClick={handleInvite}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
