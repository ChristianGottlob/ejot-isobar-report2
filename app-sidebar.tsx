"use client"
import * as React from "react"
import {
  LayoutDashboard,
  BookOpen,
  Leaf,
} from "lucide-react"
import { NavMain } from "@/components/nav-main"
// import { NavUser } from "@/components/nav-user"
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarRail,
} from "@/components/ui/sidebar"
// Sample Data (Keep for now)
// const sampleUserData = {
//   name: "Username",
//   email: "username@ejot.com",
//   avatar: "/avatars/placeholder.png",
// }
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const navData = [
    { url: "dashboard", title: "Dashboard", icon: LayoutDashboard },
    { url: "isobar", title: "Iso-Bar ECO", icon: Leaf },
    { url: "docs", title: "Docs", icon: BookOpen },
  ];
  return (
    <Sidebar collapsible="icon" {...props} className="sticky">
      <SidebarContent>
        <NavMain items={navData} />
      </SidebarContent>
      <SidebarFooter>
        {/* <NavUser user={sampleUserData} /> */}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
