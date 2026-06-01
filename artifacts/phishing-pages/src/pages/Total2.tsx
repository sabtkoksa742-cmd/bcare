import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Total2() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/visa"); }, [setLocation]);
  return null;
}
