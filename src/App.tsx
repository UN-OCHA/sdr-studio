import { useAuth0 } from "@auth0/auth0-react";
import {
  Alignment,
  Button,
  Classes,
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
import { OrgSettings } from "./components/OrgSettings";
import { UserSettings } from "./components/UserSettings";
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

  const [activeView, setActiveView] = useState<
    "projects" | "templates" | "org-settings" | "user-settings"
  >("projects");
  const [isTokenReady, setIsTokenReady] = useState(false);

  const {
    projects,
    currentProjectId,
    isLoadingProjects,
    errorProjects,
    isDarkMode,
    fetchProjects,
    setCurrentProjectId,
    updateProject,
    deleteProject,
    toggleDarkMode,
  } = useStore();

  useEffect(() => {
    if (isAuthenticated) {
      const refresh = async () => {
        try {
          const t = await getAccessTokenSilently();
          setAuthToken(t);
          setIsTokenReady(true);
        } catch (err: any) {
          console.error("Token refresh failed:", err);
          setAuthToken(null);
          setIsTokenReady(true); // Release the spinner even on failure
        }
      };

      void refresh();
      // Refresh every 10 minutes to keep session alive
      const interval = setInterval(() => void refresh(), 1000 * 60 * 10);
      return () => clearInterval(interval);
    } else {
      setAuthToken(null);
      setIsTokenReady(false);
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  // Only fetch projects once token is ready
  useEffect(() => {
    if (isTokenReady && isAuthenticated) {
      void fetchProjects();
    }
  }, [isTokenReady, isAuthenticated, fetchProjects]);

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

  useEffect(() => {
    if (isDarkMode) {
      document.body.classList.add(Classes.DARK, "dark");
    } else {
      document.body.classList.remove(Classes.DARK, "dark");
    }
  }, [isDarkMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        toggleDarkMode();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleDarkMode]);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Spinner size={50} />
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-screen overflow-hidden ${isDarkMode ? "dark " + Classes.DARK : ""} bg-white dark:bg-bp-dark-bg text-gray-900 dark:text-white`}>
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
                      <span className="text-xs font-bold text-gray-900 dark:text-white truncate">
                        {user?.name}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-gray-400 truncate">
                        {user?.email}
                      </span>
                    </div>
                    <MenuDivider />
                    <MenuItem
                      icon="user"
                      text="Profile Settings"
                      onClick={() => {
                        setCurrentProjectId(null);
                        setActiveView("user-settings");
                      }}
                    />
                    <MenuItem
                      icon="cog"
                      text="Organization Settings"
                      onClick={() => {
                        setCurrentProjectId(null);
                        setActiveView("org-settings");
                      }}
                    />
                    <MenuDivider />
                    <MenuItem
                      icon={isDarkMode ? "flash" : "moon"}
                      text={isDarkMode ? "Light Mode" : "Dark Mode"}
                      onClick={toggleDarkMode}
                      labelElement={<span className="text-[9px] text-gray-400">ALT+D</span>}
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
                <button className="flex items-center gap-2 hover:bg-gray-100 dark:hover:bg-gray-700 p-1 px-2 rounded-lg transition-colors group cursor-pointer border-none bg-transparent outline-none">
                  <div className="w-7 h-7 rounded-full bg-blue-400 flex items-center justify-center text-[10px] font-bold text-white shadow-sm ring-2 ring-white group-hover:bg-blue-600 transition-colors">
                    {getInitials(user?.name)}
                  </div>
                  <div className="flex flex-col items-start leading-none pr-1">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
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
        ) : !isTokenReady ? (
          <div className="flex h-full items-center justify-center">
            <Spinner size={32} />
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
        ) : activeView === "org-settings" ? (
          <OrgSettings onBack={() => setActiveView("projects")} />
        ) : activeView === "user-settings" ? (
          <UserSettings onBack={() => setActiveView("projects")} />
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
