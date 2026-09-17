import { getWeekdaysInRange } from './dateUtils.js';

/**
 * Calculates pro-rated billing for a subscription cycle based on weekdays served.
 * 
 * Rules:
 * 1. Only Monday-Friday are billable service days.
 * 2. Paused weekdays are not billable.
 * 3. billableAmount = monthlyPrice * servedWeekdays / totalWeekdays.
 * 4. Consistently rounded to 2 decimal places.
 * 
 * @param {Object} subscription 
 * @param {Array} pausePeriods 
 * @returns {Object} Deterministic bill object
 */
export const calculateSubscriptionBill = (subscription, pausePeriods = []) => {
  const { cycleStart, cycleEnd, monthlyPrice, ownershipSegments = [] } = subscription;

  // 1. All weekdays in subscription cycle
  const allCycleWeekdays = getWeekdaysInRange(cycleStart, cycleEnd);
  const totalWeekdays = allCycleWeekdays.length;

  // 2. Collect unique paused weekdays within the cycle (using Set prevents double-counting overlaps)
  const pausedWeekdaysSet = new Set();
  for (const pause of pausePeriods) {
    const pStart = pause.startDate > cycleStart ? pause.startDate : cycleStart;
    const pEnd = pause.endDate < cycleEnd ? pause.endDate : cycleEnd;
    if (pStart <= pEnd) {
      const weekdaysInPause = getWeekdaysInRange(pStart, pEnd);
      for (const day of weekdaysInPause) {
        pausedWeekdaysSet.add(day);
      }
    }
  }

  const pausedWeekdays = pausedWeekdaysSet.size;
  const servedWeekdays = Math.max(0, totalWeekdays - pausedWeekdays);

  // 3. Amount Due
  const amountDue = totalWeekdays > 0 
    ? Math.round((monthlyPrice * servedWeekdays / totalWeekdays) * 100) / 100 
    : 0;

  // 4. Served weekday dates
  const servedWeekdayDates = allCycleWeekdays.filter(date => !pausedWeekdaysSet.has(date));

  // 5. T6 Transfer ownership segments breakdown
  const segmentsBreakdown = [];
  if (ownershipSegments && ownershipSegments.length > 0) {
    for (const segment of ownershipSegments) {
      const segServedDays = servedWeekdayDates.filter(
        d => d >= segment.startDate && d <= segment.endDate
      );
      const segServedCount = segServedDays.length;
      const segAmountDue = totalWeekdays > 0
        ? Math.round((monthlyPrice * segServedCount / totalWeekdays) * 100) / 100
        : 0;

      segmentsBreakdown.push({
        customerId: segment.customerId,
        startDate: segment.startDate,
        endDate: segment.endDate,
        servedWeekdays: segServedCount,
        amountDue: segAmountDue
      });
    }
  }

  return {
    cycleStart,
    cycleEnd,
    monthlyPrice,
    totalWeekdays,
    pausedWeekdays,
    servedWeekdays,
    amountDue,
    pausedWeekdayDates: Array.from(pausedWeekdaysSet).sort(),
    servedWeekdayDates,
    pausePeriodsUsed: pausePeriods.map(p => ({
      startDate: p.startDate,
      endDate: p.endDate,
      reason: p.reason || ''
    })),
    segmentsBreakdown
  };
};
