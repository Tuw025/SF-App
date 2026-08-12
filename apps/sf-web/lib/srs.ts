// Thuật toán SuperMemo-2 (SRS)
export function calculateSM2(
  quality: number, // 0-5 (0: Không nhớ gì, 5: Nhớ hoàn hảo)
  repetition: number,
  easinessFactor: number,
  interval: number
) {
  // Tính hệ số dễ (EF)
  let nextEasinessFactor = easinessFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (nextEasinessFactor < 1.3) nextEasinessFactor = 1.3;

  let nextInterval = 0;
  let nextRepetition = repetition;

  if (quality >= 3) {
    if (repetition === 0) {
      nextInterval = 1;
    } else if (repetition === 1) {
      nextInterval = 6;
    } else {
      nextInterval = Math.round(interval * nextEasinessFactor);
    }
    nextRepetition += 1;
  } else {
    nextRepetition = 0;
    nextInterval = 0; // Trả lời sai -> Ôn lại ngay trong ngày
  }

  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + nextInterval);
  nextReviewDate.setHours(0, 0, 0, 0);

  return {
    repetition: nextRepetition,
    easinessFactor: nextEasinessFactor,
    interval: nextInterval,
    nextReviewDate
  };
}
