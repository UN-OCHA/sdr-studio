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
import { useEffect, useState, useCallback } from "react";
import { setAuthToken, setOnUnauthorized } from "./api";
import { Dashboard } from "./components/Dashboard";
import { ProjectDetail } from "./components/ProjectDetail";
import { TemplateManager } from "./components/TemplateManager";
import { OrgSettings } from "./components/OrgSettings";
import { UserSettings } from "./components/UserSettings";
import { useStore } from "./store";
import { useProjects, useCreateProject, useDeleteProject } from "./hooks/queries";
import type { ProjectCreate } from "./types";

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
    currentProjectId,
    isDarkMode,
    setCurrentProjectId,
    toggleDarkMode,
  } = useStore();

  const { data: projects = [], isLoading: isLoadingProjects, error: errorProjects, refetch: fetchProjects } = useProjects(isTokenReady);
  const createProjectMutation = useCreateProject();
  const deleteProjectMutation = useDeleteProject();
  const refresh = useCallback(
    async (options: { cacheMode?: "on" | "off" | "cache-only" } = {}) => {
      try {
        const t = await getAccessTokenSilently(options);
        setAuthToken(t);
        setIsTokenReady(true);
        return t;
      } catch (err: any) {
        console.error("Token refresh failed:", err);
        setAuthToken(null);

        // If the error suggests we need to log in again, we should do it
        if (
          err.error === "login_required" ||
          err.error === "consent_required" ||
          err.error === "invalid_grant"
        ) {
          console.warn("Session expired, forcing re-authentication");
          void loginWithRedirect();
        }

        setIsTokenReady(true); // Release the spinner even on failure
        return null;
      }
    },
    [getAccessTokenSilently, loginWithRedirect]
  );

  useEffect(() => {
    if (isAuthenticated) {
      void refresh();

      // Handle 401s by attempting to refresh the token, bypassing the cache
      setOnUnauthorized(() => {
        console.warn("401 detected, attempting token refresh...");
        void refresh({ cacheMode: "off" });
      });

      // Refresh every 10 minutes to keep session alive
      const interval = setInterval(() => void refresh(), 1000 * 60 * 10);
      return () => {
        clearInterval(interval);
        setOnUnauthorized(() => {});
      };
    } else {
      setAuthToken(null);
      setOnUnauthorized(() => {});
      // Avoid calling setState synchronously within the effect
      Promise.resolve().then(() => setIsTokenReady(false));
    }
  }, [isAuthenticated, refresh]);

  const currentProject = projects.find((p) => p.id === currentProjectId);

  const handleCreateProject = async (projectData: ProjectCreate) => {
    try {
      const newProject = await createProjectMutation.mutateAsync(projectData);
      setCurrentProjectId(newProject.id);
    } catch (error) {
      console.error("Failed to create project:", error);
    }
  };

  const handleUpdateProject = () => {
    // This will be handled by mutation in components or we can invalidate here
    // For now, let's just make sure we refetch
    void fetchProjects();
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await deleteProjectMutation.mutateAsync(id);
      if (currentProjectId === id) {
        setCurrentProjectId(null);
      }
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
              error={errorProjects ? (errorProjects as Error).message : null}
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
