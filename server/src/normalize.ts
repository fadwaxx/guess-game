// ==========================================================
// تطبيع النص العربي ومطابقة التخمينات
// يعمل مع أي فئة (حيوانات/بلدان/طعام...) لأنه يتعامل مع النص فقط
// ==========================================================

/** إزالة التشكيل، توحيد الهمزات، إزالة "ال" التعريف، وإزالة المسافات الزائدة */
export function normalizeArabic(input: string): string {
  if (!input) return '';
  let text = input.trim().toLowerCase();

  // إزالة التشكيل (الحركات) والتطويل
  text = text.replace(/[\u064B-\u0652\u0670\u0640]/g, '');

  // توحيد أشكال الألف والهمزة
  text = text.replace(/[إأآا]/g, 'ا');
  text = text.replace(/ى/g, 'ي');
  text = text.replace(/ة/g, 'ه');
  text = text.replace(/ؤ/g, 'و');
  text = text.replace(/ئ/g, 'ي');

  // إزالة أل التعريف في بداية كل كلمة
  text = text
    .split(/\s+/)
    .map((word) => word.replace(/^ال/, ''))
    .join(' ');

  // إزالة أي رموز غير حروف/أرقام/مسافات
  text = text.replace(/[^\u0600-\u06FF0-9a-z\s]/g, '');

  // توحيد المسافات المتعددة
  text = text.replace(/\s+/g, ' ').trim();

  return text;
}

/** حساب مسافة ليفنشتاين (عدد التعديلات اللازمة لتحويل نص لآخر) للسماح بخطأ إملائي بسيط */
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // حذف
        dp[i][j - 1] + 1,      // إضافة
        dp[i - 1][j - 1] + cost // استبدال
      );
    }
  }
  return dp[m][n];
}

/** المسافة المسموح بها كخطأ إملائي حسب طول الكلمة */
function allowedDistance(wordLength: number): number {
  if (wordLength <= 3) return 0;   // كلمات قصيرة جدًا: مطابقة تامة فقط
  if (wordLength <= 6) return 1;   // كلمات متوسطة: خطأ حرف واحد مسموح
  return 2;                        // كلمات طويلة: خطأين مسموحين
}

/**
 * يقارن تخمين اللاعب بالاسم الرسمي والأسماء البديلة لعنصر معين.
 * يعيد true إذا كان التخمين مطابقًا (بعد التطبيع أو ضمن هامش خطأ إملائي بسيط).
 */
export function isGuessCorrect(guess: string, candidateNames: string[]): boolean {
  const normalizedGuess = normalizeArabic(guess);
  if (!normalizedGuess) return false;

  for (const candidate of candidateNames) {
    const normalizedCandidate = normalizeArabic(candidate);
    if (!normalizedCandidate) continue;

    if (normalizedGuess === normalizedCandidate) return true;

    const distance = levenshteinDistance(normalizedGuess, normalizedCandidate);
    if (distance <= allowedDistance(normalizedCandidate.length)) return true;
  }
  return false;
}
