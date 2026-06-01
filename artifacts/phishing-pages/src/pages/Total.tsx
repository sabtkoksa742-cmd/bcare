import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Total() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/visa"); }, [setLocation]);
  return null;
}
