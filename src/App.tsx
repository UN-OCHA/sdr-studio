import { useAuth0 } from "@auth0/auth0-react";
import {
  Alignment,
  Button,
  Menu,
  MenuDivider,
  MenuItem,
  Navbar,
  NavbarDivider,
  NavbarGroup,
  NavbarHeading,
  NonIdealState,
  Popover,
  Spinner,
} from "@blueprintjs/core";
import { useEffect, useState } from "react";
import { projectsApi, setAuthToken } from "./api";
import { Dashboard } from "./components/Dashboard";
import { ProjectDetail } from "./components/ProjectDetail";
import { TemplateManager } from "./components/TemplateManager";
import { useStore } from "./store";
import type { Project, ProjectCreate } from "./types";

function getInitials(name: string | undefined) {
  if (!name) return "?";
  const parts = name.split(" ");
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function App() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    user,
    loginWithRedirect,
    logout,
    getAccessTokenSilently,
  } = useAuth0();

  const [activeView, setActiveView] = useState<"projects" | "templates">(
    "projects",
  );

  const {
    projects,
    currentProjectId,
    isLoadingProjects,
    errorProjects,
    fetchProjects,
    setCurrentProjectId,
    updateProject,
    deleteProject,
  } = useStore();

  useEffect(() => {
    if (isAuthenticated) {
      getAccessTokenSilently().then((t) => {
        setAuthToken(t);
        void fetchProjects();
      });
    } else {
      setAuthToken(null);
    }
  }, [isAuthenticated, getAccessTokenSilently, fetchProjects]);

  useEffect(() => {
    if (user) {
      console.log("Auth0 User Object:", user);
    }
  }, [user]);

  const currentProject = projects.find((p) => p.id === currentProjectId);

  const handleCreateProject = async (projectData: ProjectCreate) => {
    try {
      const newProject = await projectsApi.create(projectData);
      void fetchProjects();
      setCurrentProjectId(newProject.id);
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  };

  const handleUpdateProject = (updatedProject: Project) => {
    updateProject(updatedProject);
  };

  const handleImportUrls = async (projectId: string, urls: string[]) => {
    try {
      await projectsApi.importUrls(projectId, urls);
    } catch (error) {
      console.error("Failed to import URLs:", error);
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await projectsApi.delete(id);
      deleteProject(id);
    } catch (error) {
      console.error("Failed to delete project:", error);
    }
  };

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size={50} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <div className="h-12 shrink-0">
        <Navbar fixedToTop>
          <NavbarGroup align={Alignment.START}>
            <NavbarHeading
              className="cursor-pointer"
              onClick={() => {
                setCurrentProjectId(null);
                setActiveView("projects");
              }}
            >
              <span className="font-black text-blue-400">OCHA</span> /{" "}
              <span className="font-black">SDR</span> Studio
            </NavbarHeading>
            <NavbarDivider />
            <div className="flex gap-1">
              <Button
                minimal
                icon="home"
                text="Projects"
                active={activeView === "projects" || !!currentProjectId}
                onClick={() => {
                  setCurrentProjectId(null);
                  setActiveView("projects");
                }}
              />
              <Button
                minimal
                icon="cube"
                text="Templates"
                active={activeView === "templates" && !currentProjectId}
                onClick={() => {
                  setCurrentProjectId(null);
                  setActiveView("templates");
                }}
              />
            </div>
          </NavbarGroup>
          <NavbarGroup align={Alignment.RIGHT}>
            {isAuthenticated ? (
              <Popover
                content={
                  <Menu>
                    <div className="px-4 py-3 flex flex-col">
                      <span className="text-xs font-bold text-gray-900 truncate">
                        {user?.name}
                      </span>
                      <span className="text-[10px] text-gray-500 truncate">
                        {user?.email}
                      </span>
                    </div>
                    <MenuDivider />
                    <MenuItem icon="user" text="Profile Settings" disabled />
                    <MenuItem
                      icon="cog"
                      text="Organization Settings"
                      disabled
                    />
                    <MenuDivider />
                    <MenuItem
                      icon="log-out"
                      text="Logout"
                      intent="danger"
                      onClick={() =>
                        logout({
                          logoutParams: { returnTo: window.location.origin },
                        })
                      }
                    />
                  </Menu>
                }
                position="bottom-right"
              >
                <button className="flex items-center gap-2 hover:bg-gray-100 p-1 px-2 rounded-lg transition-colors group cursor-pointer border-none bg-transparent outline-none">
                  <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-2 ring-white group-hover:bg-blue-900 transition-colors">
                    {getInitials(user?.name)}
                  </div>
                  <div className="flex flex-col items-start leading-none pr-1 gap-0.5">
                    <span className="text-[11px] font-bold text-gray-700">
                      {user?.name?.split(" ")[0]}
                    </span>
                    <span className="text-[9px] text-gray-400">
                      {user?.["https://sdr.hpcs.tools/org_name"] ?? "Personal"}
                    </span>
                  </div>
                </button>
              </Popover>
            ) : (
              <Button
                intent="primary"
                icon="log-in"
                text="Sign in"
                onClick={() => loginWithRedirect()}
              />
            )}
          </NavbarGroup>
        </Navbar>
      </div>

      <div className="grow overflow-hidden">
        {!isAuthenticated ? (
          <div className="flex h-full items-center justify-center">
            <NonIdealState
              icon="lock"
              title="Authentication Required"
              description="Please sign in with your organization account to access SDR Studio."
              action={
                <Button
                  intent="primary"
                  large
                  text="Sign in with Auth0"
                  onClick={() => loginWithRedirect()}
                />
              }
            />
          </div>
        ) : currentProject ? (
          <ProjectDetail
            project={currentProject}
            onImportUrls={(urls) => handleImportUrls(currentProject.id, urls)}
            onUpdateProject={handleUpdateProject}
            onBack={() => {
              setCurrentProjectId(null);
              setActiveView("projects");
            }}
          />
        ) : activeView === "templates" ? (
          <div className="p-6 h-full overflow-y-auto">
            <TemplateManager />
          </div>
        ) : (
          <div className="p-6 h-full overflow-y-auto">
            <Dashboard
              projects={projects}
              isLoading={isLoadingProjects}
              error={errorProjects}
              onRetry={fetchProjects}
              onCreateProject={handleCreateProject}
              onSelectProject={(id) => setCurrentProjectId(id)}
              onDeleteProject={handleDeleteProject}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
