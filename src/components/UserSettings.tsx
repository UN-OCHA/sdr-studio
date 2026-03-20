import { Button, Callout, EntityTitle, H5, Icon, Menu, MenuItem, Section, SectionCard, Intent } from "@blueprintjs/core";
import { useState } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import type { SettingsSection } from "../types";
import { UserSessions } from "./UserSettings/UserSessions";
import { UserProfile } from "./UserSettings/UserProfile";
import { usersApi } from "../api";
import { useToaster } from "../hooks/useToaster";

type UserSettingsProps = {
  onBack: () => void;
  initialSection?: SettingsSection;
};

export function UserSettings({ onBack, initialSection = "user-profile" }: UserSettingsProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>(initialSection);
  const [isResetting, setIsResetting] = useState(false);
  const { showToaster } = useToaster();

  const handlePasswordReset = async () => {
    setIsResetting(true);
    try {
        await usersApi.requestPasswordReset();
        showToaster("Password reset email sent. Please check your inbox.", Intent.SUCCESS);
    } catch (err: any) {
        showToaster(err.message || "Failed to trigger reset", Intent.DANGER);
    } finally {
        setIsResetting(false);
    }
  };

  const getTitle = () => {
    switch (activeSection) {
      case "user-profile":
        return "Personal Profile";
      case "user-security":
        return "Account Security";
      case "user-sessions":
        return "Active Sessions";
      default:
        return "User Settings";
    }
  };

  const getSubtitle = () => {
    switch (activeSection) {
      case "user-profile":
        return "Manage your display name and preferences.";
      case "user-security":
        return "Update your password and MFA settings.";
      case "user-sessions":
        return "Monitor and manage your active device logins.";
      default:
        return "";
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Header */}
      <div className="h-12 shrink-0 flex items-center px-3 border-b border-gray-200 bg-gray-50 gap-1 shadow-sm z-10">
        <Button icon="arrow-left" onClick={onBack} minimal small />
        <Icon icon="user" size={18} className="text-gray-500 ml-1" />
        <EntityTitle 
          title="User Settings" 
          subtitle="Manage your personal account and security" 
          heading={H5}
          className="ml-1"
        />
      </div>

      <PanelGroup direction="horizontal" className="grow overflow-hidden">
        {/* Sidebar */}
        <Panel
          defaultSize={25}
          minSize={20}
          maxSize={40}
          className="flex flex-col bg-gray-50 border-r border-gray-200"
        >
          <div className="p-4 space-y-4">
            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold mb-2 pl-2 tracking-wider">
                Identity
              </p>
              <Menu className="bg-transparent p-0">
                <MenuItem
                  icon="id-number"
                  text="Profile"
                  active={activeSection === "user-profile"}
                  onClick={() => setActiveSection("user-profile")}
                />
              </Menu>
            </div>

            <div>
              <p className="text-[10px] text-gray-500 uppercase font-bold mb-2 pl-2 tracking-wider">
                Account
              </p>
              <Menu className="bg-transparent p-0">
                <MenuItem
                  icon="shield"
                  text="Security"
                  active={activeSection === "user-security"}
                  onClick={() => setActiveSection("user-security")}
                />
                <MenuItem
                  icon="log-in"
                  text="Active Sessions"
                  active={activeSection === "user-sessions"}
                  onClick={() => setActiveSection("user-sessions")}
                />
              </Menu>
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-1.5 bg-gray-100 hover:bg-blue-200 transition-colors border-x border-gray-200 flex items-center justify-center group cursor-col-resize">
            <div className="w-0.5 h-8 bg-gray-300 group-hover:bg-blue-400 rounded-full" />
        </PanelResizeHandle>

        {/* Content */}
        <Panel className="bg-white flex flex-col overflow-hidden">
          <div className="grow overflow-y-auto p-6">
            <div className="mx-auto">
              {activeSection === "user-profile" && (
                <>
                  <div className="mb-6">
                    <EntityTitle title={getTitle()} subtitle={getSubtitle()} heading={H5} />
                  </div>
                  <UserProfile />
                </>
              )}
              
              {activeSection === "user-sessions" && (
                <>
                  <div className="mb-6">
                    <EntityTitle title={getTitle()} subtitle={getSubtitle()} heading={H5} />
                  </div>
                  <UserSessions />
                </>
              )}

              {activeSection === "user-security" && (
                <>
                  <div className="mb-6">
                    <EntityTitle title={getTitle()} subtitle={getSubtitle()} heading={H5} />
                  </div>
                  <Section title="Authentication" icon="shield">
                      <SectionCard className="space-y-4">
                          <Callout intent={Intent.WARNING} icon="lock">
                              We use OCHA's global identity service for authentication. Changing your password here will affect all your OCHA-linked applications.
                          </Callout>
                          <div>
                              <p className="text-sm font-bold mb-1">Change Password</p>
                              <p className="text-xs text-gray-500 mb-3">Trigger a secure password reset email to your OCHA address.</p>
                              <Button
                                  intent={Intent.DANGER}
                                  text="Send Reset Email"
                                  onClick={handlePasswordReset}
                                  loading={isResetting}
                              />
                          </div>
                      </SectionCard>
                  </Section>
                </>
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
