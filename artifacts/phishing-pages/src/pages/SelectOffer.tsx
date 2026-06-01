import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Shield, Check, ChevronRight } from "lucide-react";

const THIRD_PARTY_COMPANIES = [
  { name: "ولاء", price: 530.0, id: "walaa" },
  { name: "ميدغلف", price: 540.0, id: "medgulf" },
  { name: "ملاذ", price: 555.25, id: "malath" },
  { name: "بروج", price: 590.0, id: "buruj" },
  { name: "أكسا", price: 605.0, id: "axa" },
  { name: "سلامة", price: 620.5, id: "salama" },
  { name: "التعاونية", price: 685.5, id: "tawuniya" },
  { name: "تكافل الراجحي", price: 695.5, id: "takaful" },
  { name: "الراجحي تكافل", price: 710.0, id: "alrajhi" },
];

const COMPREHENSIVE_COMPANIES = [
  { name: "ميدغلف", price: 1350.0, id: "medgulf" },
  { name: "ملاذ", price: 1388.13, id: "malath" },
  { name: "ولاء", price: 1325.0, id: "walaa" },
  { name: "أكسا", price: 1512.5, id: "axa" },
  { name: "سلامة", price: 1551.25, id: "salama" },
  { name: "بروج", price: 1475.0, id: "buruj" },
  { name: "التعاونية", price: 1713.75, id: "tawuniya" },
  { name: "الراجحي تكافل", price: 1775.0, id: "alrajhi" },
  { name: "تكافل الراجحي", price: 1738.75, id: "takaful" },
];

const THIRD_PARTY_FEATURES = [
  "تغطية الأضرار الجسدية للغير",
  "تغطية الأضرار المادية للغير",
  "المسؤولية المدنية",
];

const COMPREHENSIVE_FEATURES = [
  "جميع مزايا ضد الغير",
  "تغطية أضرار سيارتك",
  "سرقة وحريق وكوارث طبيعية",
  "بدل إيجار سيارة عند الحادث",
];

export default function SelectOffer() {
  const [, setLocation] = useLocation();
  const [insuranceType, setInsuranceType] = useState<"شامل" | "ضد الغير">("ضد الغير");

  useEffect(() => {
    const saved = localStorage.getItem("insuranceType");
    if (saved === "شامل" || saved === "ضد الغير") setInsuranceType(saved);
  }, []);

  const companies = insuranceType === "شامل" ? COMPREHENSIVE_COMPANIES : THIRD_PARTY_COMPANIES;
  const features = insuranceType === "شامل" ? COMPREHENSIVE_FEATURES : THIRD_PARTY_FEATURES;

  const handleSelect = (price: number, company: string) => {
    localStorage.setItem("selectedPrice", price.toString());
    localStorage.setItem("selectedCompany", company);
    setLocation("/visa");
  };

  return (
    <div className="min-h-screen bg-[#f5f7fa] flex flex-col" dir="rtl">
      <Header />

      {/* Type banner */}
      <div className={`border-b ${insuranceType === "شامل" ? "bg-primary text-white" : "bg-white text-primary border-gray-200"}`}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              <span className="font-bold text-sm">
                {insuranceType === "شامل" ? "التأمين الشامل" : "التأمين ضد الغير"}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${insuranceType === "شامل" ? "bg-white/20" : "bg-primary/10"}`}>
                {companies.length} عرض متاح
              </span>
            </div>
            <button
              onClick={() => setLocation("/form")}
              className={`flex items-center gap-1 text-xs hover:underline ${insuranceType === "شامل" ? "text-white/70" : "text-gray-500"}`}
            >
              <ChevronRight className="w-3 h-3" />
              تعديل
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 flex-1">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            عروض {insuranceType === "شامل" ? "التأمين الشامل" : "التأمين ضد الغير"} المتاحة
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {companies.map((company, index) => {
              const discount = company.price * 0.25;
              const afterDiscount = company.price - discount;
              const vat = afterDiscount * 0.15;
              const total = afterDiscount + vat;

              return (
                <div key={index}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 hover:shadow-md hover:border-primary/30 transition-all flex flex-col">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-base font-bold text-gray-900">{company.name}</h3>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mt-1 ${
                        insuranceType === "شامل"
                          ? "bg-primary/10 text-primary"
                          : "bg-blue-50 text-blue-600"
                      }`}>
                        <Shield className="w-3 h-3" />
                        {insuranceType}
                      </span>
                    </div>
                    <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-bold">
                      {company.name.charAt(0)}
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-4 flex-1">
                    {features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                        <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                        {f}
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-100 pt-3 mt-auto">
                    <div className="text-xs text-gray-400 mb-0.5">القسط بعد الخصم والضريبة</div>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-2xl font-bold text-primary">{total.toFixed(2)}</span>
                      <span className="text-xs text-gray-400">ر.س / سنوياً</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                      <span>القسط الأساسي</span>
                      <span className="line-through">{company.price.toFixed(2)} ر.س</span>
                    </div>

                    <Button
                      onClick={() => handleSelect(company.price, company.name)}
                      className={`w-full font-bold ${insuranceType === "شامل" ? "bg-primary hover:bg-primary/90" : ""}`}
                    >
                      اشترِ الآن
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
