import './index-greening.css';
import { Link, Navigate, Outlet, Route, Routes, useLocation } from "react-router";
import { Dashboard } from "@/pages/Dashboard";
import { Docs } from "@/pages/Docs";
import { IsoBarReport } from "@/pages/IsoBarReport";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import React from 'react';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/app-sidebar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toaster } from '@/components/ui/sonner.tsx';

// Determine if we're running in microfrontend mode
const isMicrofrontend = window.location.pathname.includes('/applications/greening-frontend');

// Helper function to generate breadcrumbs
const generateBreadcrumbs = (pathname: string) => {
  // Handle root path separately
  if (pathname === "/") {
    return [
      <BreadcrumbItem key="/">
        <BreadcrumbPage>Dashboard</BreadcrumbPage>
      </BreadcrumbItem>,
    ]
  }

  const pathSegments = pathname.split("/").filter(Boolean) // Split and remove empty strings
  let currentPath = ""

  // Simple mapping for demonstration; could be more complex
  const nameMapping: { [key: string]: string } = {
    "greening-frontend": "Greening Frontend",
    "isobar": "Iso-Bar ECO",
  }

  // Generate breadcrumbs for non-root paths
  const breadcrumbs = pathSegments.map((segment, index) => {
    currentPath += `/${segment}`
    const isLast = index === pathSegments.length - 1
    const displayName =
      nameMapping[segment] ||
      segment.charAt(0).toUpperCase() + segment.slice(1) // Capitalize if no mapping

    return (
      <React.Fragment key={currentPath}>
        <BreadcrumbItem>
          {isLast ? (
            <BreadcrumbPage>{displayName}</BreadcrumbPage>
          ) : (
            <BreadcrumbLink asChild>
              <Link to={currentPath}>{displayName}</Link>
            </BreadcrumbLink>
          )}
        </BreadcrumbItem>
        {/* Add separator only if not the last item */}
        {!isLast && <BreadcrumbSeparator />}
      </React.Fragment>
    )
  })

  return breadcrumbs
}

type Props = {
  children: React.ReactNode
}

function Layout({ children, headerOffset = 0 }: Props & { headerOffset?: number }) {
  const location = useLocation()
  const breadcrumbs = generateBreadcrumbs(location.pathname)

  // Create CSS variables for the ScrollArea with the proper height
  const scrollAreaStyle = {
    "--content-height": `calc(100vh - ${headerOffset}px - 4rem)`, // 4rem = 16 (header) + extra padding
    height: "var(--content-height)",
  } as React.CSSProperties;

  return (
    <SidebarProvider className="w-auto h-full" headerOffset={headerOffset}>
      <AppSidebar />
      <SidebarInset className="flex flex-col h-full">
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 px-4 transition-[width,height] ease-linear group-has-[[data-collapsible=icon]]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 w-full">
            <SidebarTrigger className="-ml-1" />
            <div className="container mx-auto max-w-7xl">
              <Breadcrumb>
                <BreadcrumbList>{breadcrumbs}</BreadcrumbList>
              </Breadcrumb>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-hidden"> {/* This prevents body scrolling */}
          {/* Use inline style with CSS var for correct height calculation */}
          <ScrollArea className="w-full" style={scrollAreaStyle}>
            <main className="container mx-auto max-w-7xl px-4 pb-8">
              {children}
            </main>
            <Toaster />
          </ScrollArea>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

// Main App component - conditionally wraps content based on mode
function App({ headerOffset = 0 }: { headerOffset?: number }) {
  // For microfrontend mode, don't use any auth context - the host app provides it
  // For standalone mode, provide local auth context

  // Handle path prefixing for microfrontend mode
  console.log(`App running in microfrontend mode: ${isMicrofrontend}`);

  const routes = (
    <Routes>
      {/* Show login route only in standalone mode */}
      {!isMicrofrontend && (
        // <Route path="/login" element={<Login />} />
        <Route path="/login" element={<h1>TODO: Use Login page</h1>} />
      )}

      <Route
        path="/"
        element={
          // Use different protection based on mode
          isMicrofrontend ? (
            // In microfrontend mode, no local protection needed (host handles it)
            <Layout headerOffset={headerOffset}><Outlet /></Layout>
          ) : (
            // In standalone mode, use our local protection
            // <ProtectedRoute>
              <Layout headerOffset={headerOffset}><Outlet /></Layout>
            // </ProtectedRoute>
          )
        }
      >
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="isobar" element={<IsoBarReport />} />
        <Route path="docs" element={<Docs />} />
      </Route>

      {/* Catch all route for standalone mode to redirect to login */}
      {!isMicrofrontend && (
        <Route path="*" element={<Navigate to="/login" replace />} />
      )}
    </Routes>
  );

  // Only wrap with AuthProvider when in standalone mode
  return isMicrofrontend ? (
    // Microfrontend mode - no local AuthProvider needed
    routes
  ) : (
    // Standalone mode - provide local AuthProvider
    // <AuthProvider>
      // {routes}
      <>{routes}</>
    // </AuthProvider>
  );
}

export default App;
