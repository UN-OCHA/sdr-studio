import {
  Button,
  Callout,
  Code,
  Dialog,
  FormGroup,
  HTMLTable,
  Icon,
  InputGroup,
  Intent,
  NonIdealState,
  Section,
  SectionCard,
  Spinner,
} from "@blueprintjs/core";
import { useCallback, useEffect, useState } from "react";
import { projectsApi } from "../../api";
import { useToaster } from "../../hooks/useToaster";
import type { ApiKey, Project } from "../../types";

type ApiKeyManagerProps = {
  project: Project;
};

export function ApiKeyManager({ project }: ApiKeyManagerProps) {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const { showToaster } = useToaster();

  const fetchKeys = useCallback(async () => {
    try {
      const data = await projectsApi.listApiKeys(project.id);
      setKeys(data);
    } catch {
      showToaster("Failed to fetch API keys", Intent.DANGER);
    } finally {
      setIsLoading(false);
    }
  }, [project.id, showToaster]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  const handleCreate = async () => {
    if (!newKeyName) return;
    setIsCreating(true);
    try {
      await projectsApi.createApiKey(project.id, { name: newKeyName });
      showToaster("API Key created successfully", Intent.SUCCESS);
      setIsCreateDialogOpen(false);
      setNewKeyName("");
      fetchKeys();
    } catch {
      showToaster("Failed to create API key", Intent.DANGER);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (keyId: string) => {
    if (!confirm("Are you sure you want to delete this API key? This will break any external integrations using it.")) return;
    try {
      await projectsApi.deleteApiKey(keyId);
      showToaster("API Key deleted", Intent.SUCCESS);
      fetchKeys();
    } catch {
      showToaster("Failed to delete API key", Intent.DANGER);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showToaster("Copied to clipboard", Intent.PRIMARY);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Spinner />
        <p className="mt-4 text-gray-500">Loading API keys...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Callout intent={Intent.PRIMARY} icon="key" title="How to use External API Access">
        Persistent API keys allow external services (like dashboards, automated pipelines, or other OCHA tools) to fetch your project's reports without requiring a user login.
        <div className="mt-2 text-[11px] leading-relaxed">
          <strong>Authentication:</strong> Pass the key in the <Code>X-API-Key</Code> HTTP header.
        </div>
      </Callout>

      <Section
        title="Active API Keys"
        icon="key-control"
        rightElement={
          <Button
            intent={Intent.PRIMARY}
            icon="plus"
            text="Generate New Key"
            onClick={() => setIsCreateDialogOpen(true)}
            minimal
            small
          />
        }
      >
        {keys.length === 0 ? (
          <SectionCard>
            <NonIdealState
              icon="key"
              title="No API Keys"
              description="Create a key to enable external access to this project."
              action={
                <Button
                  intent={Intent.PRIMARY}
                  icon="plus"
                  text="Generate New Key"
                  onClick={() => setIsCreateDialogOpen(true)}
                />
              }
            />
          </SectionCard>
        ) : (
          <SectionCard padded={false}>
            <HTMLTable striped interactive className="w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Key Preview</th>
                  <th>Last Used</th>
                  <th>Created</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => (
                  <tr key={k.id}>
                    <td className="font-bold">{k.name}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <Code className="text-[10px]">{k.key.substring(0, 12)}...</Code>
                        <Button
                          minimal
                          small
                          icon="clipboard"
                          onClick={() => copyToClipboard(k.key)}
                          title="Copy Full Key"
                        />
                      </div>
                    </td>
                    <td className="text-xs text-gray-500">
                      {k.last_used ? new Date(k.last_used).toLocaleString() : "Never"}
                    </td>
                    <td className="text-xs text-gray-500">
                      {new Date(k.created_at).toLocaleDateString()}
                    </td>
                    <td className="text-right">
                      <Button
                        minimal
                        small
                        intent={Intent.DANGER}
                        icon="trash"
                        onClick={() => handleDelete(k.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </HTMLTable>
          </SectionCard>
        )}
      </Section>

      {keys.length > 0 && (
        <Section title="External Export URLs" icon="link">
          <SectionCard className="space-y-4">
            <p className="text-xs text-gray-500">
              Use these URLs to integrate your data into external applications. All requests must include a valid <Code>X-API-Key</Code> header.
            </p>
            <div className="space-y-2">
              {[
                { label: "JSON Data", format: "json", icon: "code" },
                { label: "CSV Table", format: "csv", icon: "th" },
                { label: "Markdown Report", format: "md", icon: "document" },
                { label: "PDF Report", format: "pdf", icon: "print" },
              ].map((fmt) => {
                const url = projectsApi.externalExportUrl(project.id, "REPLACE_WITH_KEY", fmt.format);
                return (
                  <div key={fmt.format} className="flex items-center justify-between p-2 bg-gray-50 rounded border border-gray-100">
                    <div className="flex items-center gap-2">
                      <Icon icon={fmt.icon as any} size={14} className="text-gray-400" />
                      <span className="text-xs font-bold">{fmt.label}</span>
                    </div>
                    <div className="flex items-center gap-2 max-w-[60%]">
                      <Code className="truncate text-[10px] bg-transparent p-0">{url}</Code>
                      <Button
                        minimal
                        small
                        icon="clipboard"
                        onClick={() => copyToClipboard(url)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        </Section>
      )}

      <Dialog
        title="Generate API Key"
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
      >
        <div className="p-6 space-y-4">
          <Callout intent={Intent.WARNING} icon="warning-sign">
            Treat API keys as passwords. They provide full read access to this project's extracted data and reports.
          </Callout>
          <FormGroup label="Key Name" labelInfo="(required)" helperText="e.g. Humanitarian Dashboard Integration">
            <InputGroup
              placeholder="Give your key a name..."
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
            />
          </FormGroup>
          <div className="flex justify-end gap-2 pt-2">
            <Button text="Cancel" onClick={() => setIsCreateDialogOpen(false)} />
            <Button
              intent={Intent.PRIMARY}
              text="Generate Key"
              loading={isCreating}
              onClick={handleCreate}
              disabled={!newKeyName}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}
