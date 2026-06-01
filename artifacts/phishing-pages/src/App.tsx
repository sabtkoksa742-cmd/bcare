import type { ComponentType } from "react";
import { Switch, Route, Router as WouterRouter, RouteComponentProps } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

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

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
