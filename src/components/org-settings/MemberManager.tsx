import {
  Button,
  Dialog,
  EntityTitle,
  FormGroup,
  HTMLTable,
  H5,
  InputGroup,
  Intent,
  SectionCard,
  Spinner,
  Tab,
  Tabs,
  Tag,
  Tooltip,
} from "@blueprintjs/core";
import { useState } from "react";
import { useToaster } from "../../hooks/useToaster";
import { ensureError } from "../../utils/errorUtils";
import { 
  useOrgMembers, 
  useOrgInvitations, 
  useInviteMember, 
  useRemoveMember, 
  useResendInvitation, 
  useRevokeInvitation 
} from "../../hooks/queries";

interface MemberManagerProps {
  title: string;
  subtitle: string;
}

export function MemberManager({ title, subtitle }: MemberManagerProps) {
  const { data: members = [], isLoading: isLoadingMembers } = useOrgMembers();
  const { data: invitations = [], isLoading: isLoadingInvites } = useOrgInvitations();
  
  const inviteMutation = useInviteMember();
  const removeMutation = useRemoveMember();
  const resendMutation = useResendInvitation();
  const revokeMutation = useRevokeInvitation();

  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [activeTab, setActiveTab] = useState<"active" | "pending">("active");
  const { showToaster } = useToaster();

  const isLoading = isLoadingMembers || isLoadingInvites;

  const handleInvite = async () => {
    if (!inviteEmail) return;
    try {
      await inviteMutation.mutateAsync(inviteEmail);
      showToaster(`Invitation sent to ${inviteEmail}`, Intent.SUCCESS);
      setIsInviteOpen(false);
      setInviteEmail("");
    } catch (err: unknown) {
      showToaster(ensureError(err).message || "Failed to send invitation", Intent.DANGER);
    }
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm("Are you sure you want to remove this member?")) return;
    try {
      await removeMutation.mutateAsync(memberId);
      showToaster("Member removed successfully", Intent.SUCCESS);
    } catch (err: unknown) {
      showToaster(ensureError(err).message || "Failed to remove member", Intent.DANGER);
    }
  };

  const handleResend = async (inviteId: string) => {
    try {
        await resendMutation.mutateAsync(inviteId);
        showToaster("Invitation resent successfully", Intent.SUCCESS);
    } catch (err: unknown) {
        showToaster(ensureError(err).message || "Failed to resend invitation", Intent.DANGER);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    if (!confirm("Are you sure you want to revoke this invitation?")) return;
    try {
        await revokeMutation.mutateAsync(inviteId);
        showToaster("Invitation revoked successfully", Intent.SUCCESS);
    } catch (err: unknown) {
        showToaster(ensureError(err).message || "Failed to revoke invitation", Intent.DANGER);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Spinner />
        <p className="mt-4 text-gray-500 dark:text-gray-400 text-sm">Loading team members...</p>
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
        onChange={(id) => setActiveTab(id as "active" | "pending")}
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
                  <td className="text-xs text-gray-500 dark:text-gray-400">
                    {m.last_login ? new Date(m.last_login).toLocaleString() : "Never"}
                  </td>
                  <td className="text-right">
                    <Tooltip content="Remove Member" intent={Intent.DANGER}>
                        <Button
                            minimal
                            small
                            intent={Intent.DANGER}
                            icon="trash"
                            loading={removeMutation.isPending && removeMutation.variables === m.id}
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
                  <td className="text-xs text-gray-500 dark:text-gray-400">
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
                                loading={resendMutation.isPending && resendMutation.variables === i.id}
                                onClick={() => handleResend(i.id)}
                            />
                        </Tooltip>
                        <Tooltip content="Revoke Invitation" intent={Intent.DANGER}>
                            <Button
                                minimal
                                small
                                intent={Intent.DANGER}
                                icon="cross"
                                loading={revokeMutation.isPending && revokeMutation.variables === i.id}
                                onClick={() => handleRevoke(i.id)}
                            />
                        </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
              {invitations.length === 0 && (
                <tr>
                    <td colSpan={4} className="text-center p-8 text-gray-500 dark:text-gray-400 italic">
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
              loading={inviteMutation.isPending}
              onClick={handleInvite}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
