import { Link } from "wouter";

export function Header() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer">
            <img
              src="https://bcare.com.sa/assets/images/Bcare-logo.svg"
              alt="Bcare Logo"
              className="h-8"
              onError={(e) => {
                const el = e.currentTarget;
                el.style.display = "none";
                const next = el.nextElementSibling as HTMLElement | null;
                if (next) next.style.display = "flex";
              }}
            />
            <div
              style={{ display: "none" }}
              className="items-center gap-1 font-bold text-xl"
            >
              <span className="text-[#004b8d]">B</span>
              <span className="text-[#f5a623]">Care</span>
            </div>
          </div>
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <span className="text-sm text-gray-500 hover:text-primary transition-colors cursor-pointer">
              تسجيل الدخول
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
