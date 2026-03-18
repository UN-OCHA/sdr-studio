import {
  Button,
  Callout,
  Card,
  Dialog,
  Elevation,
  FormGroup,
  HTMLTable,
  InputGroup,
  Intent,
  NonIdealState,
  Spinner,
  Switch,
  Tag,
} from "@blueprintjs/core";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { sourcesApi } from "../api";
import { useToaster } from "../hooks/useToaster";
import type { Project } from "../types";

interface Source {
  id: string;
  name: string;
  url: string;
  type: string;
  active: boolean;
  last_polled?: string;
  created_at: string;
}

export interface MonitoringStationRef {
  openAddSource: () => void;
}

interface MonitoringStationProps {
  project: Project;
}

export const MonitoringStation = forwardRef<
  MonitoringStationRef,
  MonitoringStationProps
>(({ project }, ref) => {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newSource, setNewSource] = useState({
    name: "",
    url: "",
    type: "rss",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToaster } = useToaster();

  useImperativeHandle(ref, () => ({
    openAddSource: () => setIsAddDialogOpen(true),
  }));

  const fetchSources = async () => {
    try {
      const data = await sourcesApi.list(project.id);
      setSources(data);
    } catch (error) {
      showToaster("Failed to fetch sources", Intent.DANGER);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, [project.id]);

  const handleAddSource = async () => {
    if (!newSource.name || !newSource.url) {
      showToaster("Please fill in all fields", Intent.WARNING);
      return;
    }

    setIsSubmitting(true);
    try {
      await sourcesApi.create(project.id, newSource);
      showToaster("Source added successfully", Intent.SUCCESS);
      setIsAddDialogOpen(false);
      setNewSource({ name: "", url: "", type: "rss" });
      fetchSources();
    } catch (error) {
      showToaster("Failed to add source", Intent.DANGER);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (source: Source) => {
    try {
      await sourcesApi.update(source.id, { active: !source.active });
      setSources(
        sources.map((s) =>
          s.id === source.id ? { ...s, active: !s.active } : s,
        ),
      );
    } catch (error) {
      showToaster("Failed to update source", Intent.DANGER);
    }
  };

  const handleDeleteSource = async (sourceId: string) => {
    if (!confirm("Are you sure you want to delete this source?")) return;

    try {
      await sourcesApi.delete(sourceId);
      setSources(sources.filter((s) => s.id !== sourceId));
      showToaster("Source deleted", Intent.SUCCESS);
    } catch (error) {
      showToaster("Failed to delete source", Intent.DANGER);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <Spinner size={50} />
        <p className="mt-4 text-gray-500">Loading monitoring sources...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Callout intent={Intent.PRIMARY} icon="info-sign" title="How it works">
        The Monitoring Station background worker polls your active sources every
        15 minutes. New articles are automatically imported and processed using
        your project's extraction configuration.
      </Callout>

      {sources.length === 0 ? (
        <Card
          elevation={Elevation.ZERO}
          className="p-12 border-dashed border-2 border-gray-200 flex flex-col items-center"
        >
          <NonIdealState
            icon="feed"
            title="No Sources Configured"
            description="Add your first RSS feed to start automated monitoring."
            action={
              <Button
                intent={Intent.PRIMARY}
                icon="plus"
                text="Add Source"
                onClick={() => setIsAddDialogOpen(true)}
              />
            }
          />
        </Card>
      ) : (
        <Card elevation={Elevation.ONE} className="p-0 overflow-hidden">
          <HTMLTable striped interactive className="mb-0 w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>URL</th>
                <th>Status</th>
                <th>Last Polled</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.id}>
                  <td className="font-medium">{source.name}</td>
                  <td>
                    <Tag minimal intent={Intent.NONE}>
                      {source.type.toUpperCase()}
                    </Tag>
                  </td>
                  <td className="max-w-xs truncate text-xs text-gray-500">
                    {source.url}
                  </td>
                  <td>
                    <Switch
                      checked={source.active}
                      label={source.active ? "Active" : "Inactive"}
                      onChange={() => handleToggleActive(source)}
                      className="mb-0"
                    />
                  </td>
                  <td className="text-xs text-gray-500">
                    {source.last_polled
                      ? new Date(source.last_polled).toLocaleString()
                      : "Never"}
                  </td>
                  <td className="text-right">
                    <Button
                      minimal
                      small
                      intent={Intent.DANGER}
                      icon="trash"
                      onClick={() => handleDeleteSource(source.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        </Card>
      )}

      <Dialog
        title="Add Monitoring Source"
        isOpen={isAddDialogOpen}
        onClose={() => setIsAddDialogOpen(false)}
      >
        <div className="p-6 space-y-4">
          <FormGroup label="Source Name" labelInfo="(required)">
            <InputGroup
              placeholder="e.g. ReliefWeb Global Disaster Alerts"
              value={newSource.name}
              onChange={(e) =>
                setNewSource({ ...newSource, name: e.target.value })
              }
            />
          </FormGroup>
          <FormGroup label="Feed URL" labelInfo="(RSS/Atom required)">
            <InputGroup
              placeholder="https://reliefweb.int/updates/rss.xml"
              value={newSource.url}
              onChange={(e) =>
                setNewSource({ ...newSource, url: e.target.value })
              }
            />
          </FormGroup>
          <div className="flex justify-end gap-2 pt-2">
            <Button text="Cancel" onClick={() => setIsAddDialogOpen(false)} />
            <Button
              intent={Intent.PRIMARY}
              text="Add Source"
              loading={isSubmitting}
              onClick={handleAddSource}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
});
