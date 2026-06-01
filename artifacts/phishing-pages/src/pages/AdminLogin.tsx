import { useState } from "react";
import { useLocation } from "wouter";
import { setToken } from "@/lib/auth";
import { adminLogin } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield } from "lucide-react";

export default function AdminLogin() {
  const [, setLocation] = useLocation();
  const [isPending, setIsPending] = useState(false);
  
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsPending(true);

    try {
      const result = await adminLogin(username, password);
      setToken(result.token);
      setLocation("/admin/dashboard");
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message.includes("Failed to fetch") ? "تعذر الاتصال بخادم الإدارة" : err.message);
      } else {
        setError("بيانات الدخول غير صحيحة");
      }
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 p-8 max-w-sm w-full text-white">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-white" />
          </div>
        </div>
        
        <h1 className="text-2xl font-bold text-center mb-8">لوحة تحكم المشرف</h1>
        
        {error && (
          <div className="bg-red-500/20 text-red-400 p-3 rounded mb-6 text-sm text-center border border-red-500/50">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-gray-300">اسم المستخدم</Label>
            <Input 
              type="text" 
              required 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              className="bg-gray-900 border-gray-700 text-white focus:ring-blue-500 focus:border-blue-500"
              dir="ltr"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">كلمة المرور</Label>
            <Input 
              type="password" 
              required 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              className="bg-gray-900 border-gray-700 text-white focus:ring-blue-500 focus:border-blue-500"
              dir="ltr"
            />
          </div>
          
          <Button 
            type="submit" 
            className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white font-bold"
            disabled={isPending}
          >
            {isPending ? "جاري التحقق..." : "تسجيل الدخول"}
          </Button>
        </form>
      </div>
    </div>
  );
}
